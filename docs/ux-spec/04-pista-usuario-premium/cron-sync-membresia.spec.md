# Cron sync membresía (Lote E)

Spec del cron que sincroniza la membresía del WhatsApp Channel con el estado real de las suscripciones en BD. Detecta inconsistencias (suscriptor activo sin acceso, o user cancelado con acceso aún), procesa expiraciones automáticas, gestiona reinvites.

## Lote responsable

**Lote E** — Premium backend automatización.

## Estado actual del repo

NUEVO — sin cron de sync de membresía.

## Por qué este cron es necesario

Hay varios escenarios donde la BD y el Channel pueden estar desincronizados:

1. **Usuario se suscribió pero NO clickeó el invite link** → en BD está activo, pero NO está en el Channel. Solución: re-enviar invite a las 24h.
2. **Suscripción venció** (no renovó) → todavía aparece en el Channel viendo picks. Solución: detectar y marcarcomo VENCIDA + log para acción manual del admin.
3. **User canceló y ya pasó la fecha de vencimiento** → debe perder acceso. Solución: marcarcomo CANCELADO_EFECTIVO en BD + log para que admin lo remueva del Channel manualmente.
4. **Pago recurrente falló** y OpenPay agotó reintentos → suscripción debe pasar a FALLIDA. Solución: detectar y marcar.
5. **Email del usuario cambió** → invite link futuro debe usar email nuevo.

WhatsApp Channels NO tiene API para listar miembros automáticamente (al momento de este spec). Por eso muchas sync son **detección + log para acción manual del admin**.

## Cambios necesarios

### 1. Cron principal cada hora

`apps/web/lib/cron/sync-membresia.ts`:

```typescript
import { prisma } from '@habla/db';
import { logger } from '@/lib/logger';
import { WhatsAppBusinessClient } from '@/lib/services/whatsapp/wa-business-client';
import { reenviarInviteChannel } from '@/lib/services/whatsapp/picks-distribuidor.service';

export async function syncMembresiaChannel() {
  const inicio = Date.now();
  logger.info('Cron sync membresía iniciado');

  const reportes = {
    suscripciones_revisadas: 0,
    invites_reenviados: 0,
    vencimientos_procesados: 0,
    cancelaciones_efectivas: 0,
    pagos_fallidos_marcados: 0,
    errores: 0,
  };

  try {
    // 1. Detectar suscriptores ACTIVOS que NO se unieron al Channel después de 24h
    await procesarInvitesPendientes(reportes);

    // 2. Detectar suscripciones VENCIDAS sin renovación
    await procesarVencimientos(reportes);

    // 3. Detectar cancelaciones que ya pasaron fecha de vencimiento
    await procesarCancelacionesEfectivas(reportes);

    // 4. Detectar pagos fallidos persistentes (>3 reintentos OpenPay)
    await procesarPagosFallidos(reportes);

  } catch (err) {
    logger.error({ err }, 'Error en sync membresía');
    reportes.errores++;
  }

  const duracionMs = Date.now() - inicio;
  logger.info({ ...reportes, duracionMs }, 'Cron sync membresía finalizado');

  return reportes;
}
```

### 2. Sub-task: invites pendientes

```typescript
async function procesarInvitesPendientes(reportes: ReporteCron) {
  // Buscar MiembroChannel en estado INVITADO desde hace >24h, sin haberse UNIDO
  const pendientes = await prisma.miembroChannel.findMany({
    where: {
      estado: 'INVITADO',
      ultimoInviteAt: { lt: subHours(new Date(), 24) },
      invitesEnviados: { lt: 3 },  // Max 3 reinvites
    },
    include: { suscripcion: { include: { usuario: true } } },
  });

  for (const miembro of pendientes) {
    if (!miembro.suscripcion.activa) continue;  // Skip si ya no es activa

    try {
      // Re-enviar invite via bot 1:1
      await reenviarInviteChannel({
        usuarioId: miembro.suscripcion.usuarioId,
        telefono: miembro.suscripcion.usuario.telefono!,
        nombre: miembro.suscripcion.usuario.nombre,
      });

      await prisma.miembroChannel.update({
        where: { id: miembro.id },
        data: {
          estado: 'REINVITADO',
          invitesEnviados: { increment: 1 },
          ultimoInviteAt: new Date(),
        },
      });

      reportes.invites_reenviados++;
    } catch (err) {
      logger.error({ err, miembroId: miembro.id }, 'Error reenviando invite');
      reportes.errores++;
    }
  }

  reportes.suscripciones_revisadas += pendientes.length;
}
```

### 3. Sub-task: vencimientos

```typescript
async function procesarVencimientos(reportes: ReporteCron) {
  // Suscripciones activas con vencimiento ya pasado y sin renovar
  const vencidas = await prisma.suscripcion.findMany({
    where: {
      activa: true,
      vencimiento: { lt: new Date() },
      // NO está cancelando (cancelando se procesa en otra sub-task)
      cancelada: false,
      // El próximo cobro debería haber sido procesado por OpenPay; si no, hay problema
    },
    include: { usuario: true },
  });

  for (const sub of vencidas) {
    try {
      // Marcar como VENCIDA + activa=false
      await prisma.$transaction(async (tx) => {
        await tx.suscripcion.update({
          where: { id: sub.id },
          data: { estado: 'VENCIDA', activa: false },
        });

        await tx.miembroChannel.updateMany({
          where: { suscripcionId: sub.id, estado: 'UNIDO' },
          data: { estado: 'REMOVIDO', removidoEn: new Date() },
        });
      });

      // Log critical: requiere acción manual del admin (remover del Channel)
      logger.warn(
        { suscripcionId: sub.id, usuarioId: sub.usuarioId, email: sub.usuario.email },
        'Suscripción vencida sin renovar — admin debe remover del Channel'
      );

      // Email al admin con la lista (al final del cron, batch en email)
      reportes.vencimientos_procesados++;
    } catch (err) {
      logger.error({ err, suscripcionId: sub.id }, 'Error procesando vencimiento');
      reportes.errores++;
    }
  }
}
```

### 4. Sub-task: cancelaciones efectivas

```typescript
async function procesarCancelacionesEfectivas(reportes: ReporteCron) {
  // Suscripciones canceladas con vencimiento ya pasado
  const cancelacionesEfectivas = await prisma.suscripcion.findMany({
    where: {
      cancelada: true,
      activa: true,                   // Aún active=true antes del proceso
      vencimiento: { lt: new Date() }, // Ya pasó la fecha
    },
    include: { usuario: true },
  });

  for (const sub of cancelacionesEfectivas) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.suscripcion.update({
          where: { id: sub.id },
          data: { activa: false, estado: 'CANCELANDO' /* ya estaba */ },
        });

        await tx.miembroChannel.updateMany({
          where: { suscripcionId: sub.id, estado: 'UNIDO' },
          data: { estado: 'REMOVIDO', removidoEn: new Date() },
        });
      });

      logger.info(
        { suscripcionId: sub.id, usuarioId: sub.usuarioId },
        'Cancelación efectiva — admin debe remover del Channel'
      );

      reportes.cancelaciones_efectivas++;
    } catch (err) {
      logger.error({ err, suscripcionId: sub.id }, 'Error procesando cancelación efectiva');
      reportes.errores++;
    }
  }
}
```

### 5. Sub-task: pagos fallidos persistentes

```typescript
async function procesarPagosFallidos(reportes: ReporteCron) {
  // Suscripciones con último pago fallido y sin pago exitoso reciente
  // OpenPay reintenta automáticamente 3 veces. Si después de 3 reintentos sigue fallido, marcar.

  const susActivasConPagosFallidos = await prisma.suscripcion.findMany({
    where: {
      activa: true,
      pagos: {
        some: {
          estado: 'RECHAZADO',
          intentos: { gte: 3 },
          fecha: { gte: subDays(new Date(), 7) },
        },
        // Y NO tiene pago exitoso reciente
        none: {
          estado: 'PAGADO',
          fecha: { gte: subDays(new Date(), 7) },
        },
      },
    },
    include: { usuario: true, pagos: true },
  });

  for (const sub of susActivasConPagosFallidos) {
    try {
      await prisma.suscripcion.update({
        where: { id: sub.id },
        data: { estado: 'FALLIDA', activa: false },
      });

      await prisma.miembroChannel.updateMany({
        where: { suscripcionId: sub.id, estado: 'UNIDO' },
        data: { estado: 'REMOVIDO', removidoEn: new Date() },
      });

      // Email al usuario notificando que su suscripción se desactivó
      await enviarEmailFalloPago({
        email: sub.usuario.email,
        nombre: sub.usuario.nombre,
      });

      // Log critical: admin debe remover del Channel
      logger.warn(
        { suscripcionId: sub.id, usuarioId: sub.usuarioId },
        'Suscripción con pagos fallidos persistentes — desactivada'
      );

      reportes.pagos_fallidos_marcados++;
    } catch (err) {
      logger.error({ err, suscripcionId: sub.id }, 'Error procesando pagos fallidos');
      reportes.errores++;
    }
  }
}
```

### 6. Email batch al admin (al final del cron)

Si en una corrida se detectaron vencimientos o cancelaciones efectivas, enviar email al admin con la lista para que remueva manualmente del Channel:

```typescript
async function enviarReporteAdmin(reportes: ReporteCron, vencidasYCanceladas: VencidaORCancelada[]) {
  if (vencidasYCanceladas.length === 0) return;

  const html = `
    <h2>Sync Membresía Channel · ${new Date().toLocaleString('es-PE')}</h2>
    <p>Estos usuarios deben ser removidos manualmente del WhatsApp Channel:</p>
    <ul>
      ${vencidasYCanceladas.map((u) => `
        <li>
          <strong>${u.usuario.nombre}</strong> (${u.usuario.email})<br>
          Phone: ${u.usuario.telefono ?? 'no registrado'}<br>
          Motivo: ${u.motivo} (${u.estadoFinal})
        </li>
      `).join('')}
    </ul>
    <p><strong>Pasos para removerlos:</strong></p>
    <ol>
      <li>Abrir el WhatsApp Channel "Habla! Picks" en tu teléfono.</li>
      <li>Ir a Channel info → Members.</li>
      <li>Para cada usuario de la lista: tap en el nombre → Remove.</li>
    </ol>
  `;

  await enviarEmailAdmin({
    to: process.env.ADMIN_EMAIL!,
    subject: `[Habla!] Sync membresía: ${vencidasYCanceladas.length} usuarios a remover del Channel`,
    body: html,
  });
}
```

### 7. Endpoint del cron

`apps/web/app/api/v1/crons/sync-membresia-channel/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { syncMembresiaChannel } from '@/lib/cron/sync-membresia';

export async function GET(request: Request) {
  // Auth con CRON_SECRET
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reportes = await syncMembresiaChannel();
  return NextResponse.json({ ok: true, reportes });
}
```

### 8. Schedule del cron

En `vercel.json` o Railway cron:

```json
{
  "crons": [
    {
      "path": "/api/v1/crons/sync-membresia-channel",
      "schedule": "0 * * * *"
    }
  ]
}
```

(Cada hora — frecuencia razonable. Cancelaciones se procesan máximo 1h después de la hora de vencimiento.)

## Datos requeridos

Variables de entorno (ya configuradas en specs anteriores del Lote E):

```bash
CRON_SECRET
ADMIN_EMAIL
RESEND_API_KEY  # ya existe Lote 10
```

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Idempotencia.** El cron puede correr 2 veces el mismo evento (ej: un vencimiento procesado en una corrida que aún no terminó cuando empieza la siguiente). Toda lógica verifica `if (suscripcion.estado === 'VENCIDA') continue;` antes de hacer cambios.
- **Logs detallados** en cada sub-task. Stack rastreable.
- **Email al admin SOLO si hay items relevantes.** No spam con "0 cambios esta hora".
- **Transacciones atómicas** (`prisma.$transaction`) en operaciones que tocan suscripcion + miembroChannel.
- **Reintentos** en envío de emails al admin (retry 3x con backoff).
- Eventos analíticos (NUEVO Lote E):
  - `cron_sync_membresia_ejecutado` con metadata de reportes.
  - `suscripcion_vencida_detectada` por cada vencimiento procesado.
  - `suscripcion_cancelacion_efectiva` por cada cancelación efectiva.
  - `suscripcion_pagos_fallidos_marcada` por cada FALLIDA.

## Mockup de referencia

N/A — backend.

## Pasos manuales para Gustavo

### 1. Verificar que CRON_SECRET y ADMIN_EMAIL están configurados

Ya configurados en specs previos del Lote E (`suscripciones-backend.spec.md` y `bot-faq.spec.md`).

### 2. Configurar el cron en Railway/Vercel

Agregar al `vercel.json` o crear cron trigger en Railway dashboard con schedule `0 * * * *` (cada hora).

### 3. Limpiar usuarios manualmente del Channel cuando llegue email batch

Cada hora (o cuando llegue el email del cron), si la lista de "remover del Channel" no está vacía:

1. Abrir WhatsApp en tu teléfono.
2. Channel "Habla! Picks" → Channel info → Members.
3. Por cada usuario en el email del bot: tap → Remove.

Esto es el único proceso manual que el cron NO automatiza, porque WhatsApp Channels no expone API de gestión de membresía. Cuando Meta libere esta API (probable a mediano plazo), Lote E.2 actualiza el cron para hacerlo auto.

### 4. Rotación del invite link cada 6 meses

Adicionalmente, cada 6 meses (mejor el día 1 del mes par), Gustavo debe:

1. Crear un nuevo Channel privado "Habla! Picks v2" en WhatsApp.
2. Subir 3-5 picks históricos para que no esté vacío.
3. Actualizar variable `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK` en Railway con el nuevo link.
4. El cron del próximo día detectará que los suscriptores activos NO están en el nuevo Channel (estado INVITADO en lógica, en realidad no se invitaron al nuevo) y les enviará invite al nuevo link automáticamente.
5. Esperar 7-14 días para que la mayoría migre.
6. Eliminar el Channel viejo cuando ya no haya actividad.

Esto evita leaks acumulados (alguien forwardeando el link del Channel viejo a no-suscriptores). Es práctica estándar de canales de pago.

**Validación post-deploy:**

1. Manualmente disparar el cron: `curl https://hablaplay.com/api/v1/crons/sync-membresia-channel -H "Authorization: Bearer $CRON_SECRET"`.
2. Verificar Railway logs:
   - "Cron sync membresía iniciado"
   - Reporte con counts en cada sub-task
   - "Cron sync membresía finalizado"
3. Si tienes suscripciones de testing: simular un vencimiento manualmente en BD (`UPDATE suscripciones SET vencimiento = now() - interval '1 hour' WHERE id = 'test'`) → ejecutar cron → verificar que se marcó VENCIDA.
4. Verificar que llega email a `ADMIN_EMAIL` con lista de usuarios a remover (si aplica).
5. Verificar transacciones atómicas: forzar error a mitad del cron y verificar que no queda data inconsistente.

---

*Versión 1 · Abril 2026 · Cron sync membresía para Lote E*
