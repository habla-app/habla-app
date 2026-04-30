# Suscripciones backend (Lote E)

Spec backend del sistema de suscripciones Premium. Modelos de BD, services, adapter OpenPay, webhook handler, email de bienvenida, reintentos, sync con Channel WhatsApp. Es la pieza más crítica de Lote E porque sin esto no hay Premium.

## Lote responsable

**Lote E** — Premium backend automatización.

## Estado actual del repo

- `apps/web/lib/services/pasarela-pagos/types.ts`: contrato neutral `PasarelaPagos` con `crearCobroUnico` y `crearSuscripcion`. Sin implementación real (mock-pasarela.ts es solo referencia).
- Sin modelos `Suscripcion`, `PagoSuscripcion`, `MiembroChannel` en `schema.prisma`. Se crean en este lote.
- Sin endpoint de webhook OpenPay. Se crea en este lote.
- Sin email de bienvenida. Se crea en este lote.

## Cambios necesarios

### 1. Migración de Prisma — modelos nuevos

Agregar a `packages/db/prisma/schema.prisma`:

```prisma
// ==========================================
// PREMIUM (Lote E · Mayo 2026)
// ==========================================

model Suscripcion {
  id              String    @id @default(cuid())
  usuarioId       String
  usuario         Usuario   @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  // Plan elegido
  plan            PlanPremium       // MENSUAL | TRIMESTRAL | ANUAL
  precio          Int               // En céntimos de soles (4900, 11900, 39900)

  // OpenPay tracking
  openpaySuscripcionId String? @unique  // ID en OpenPay (e.g. "subc_abc123")
  openpayCustomerId    String?           // ID del customer de OpenPay (para reuso)

  // Estado
  estado          EstadoSuscripcion @default(PENDIENTE)
  activa          Boolean           @default(false)
  cancelada       Boolean           @default(false)

  // Fechas
  iniciada        DateTime  @default(now())
  proximoCobro    DateTime?         // Cuándo se cobra la siguiente vez (null si cancelada)
  vencimiento     DateTime?         // Fin de acceso (puede diferir de proximoCobro si canceló)
  canceladaEn     DateTime?
  motivoCancela   String?           // Texto libre del survey opcional

  // Garantía 7 días
  enGarantia      Boolean   @default(true)  // Cierto durante primeros 7 días
  reembolsoPedido Boolean   @default(false)
  reembolsoEn     DateTime?

  pagos           PagoSuscripcion[]
  miembrosChannel MiembroChannel[]

  creadoEn        DateTime  @default(now())
  actualizadoEn   DateTime  @updatedAt

  @@index([usuarioId, activa])
  @@index([proximoCobro])
  @@map("suscripciones")
}

enum PlanPremium {
  MENSUAL
  TRIMESTRAL
  ANUAL
}

enum EstadoSuscripcion {
  PENDIENTE         // Recién creada, esperando pago
  ACTIVA            // Pago confirmado, acceso vigente
  CANCELANDO        // Cancelada pero aún con acceso (hasta vencimiento)
  VENCIDA           // Vencida sin renovación
  REEMBOLSADA       // Reembolsada en garantía
  FALLIDA           // Pago falló y no se pudo recobrar
}

model PagoSuscripcion {
  id              String    @id @default(cuid())
  suscripcionId   String
  suscripcion     Suscripcion @relation(fields: [suscripcionId], references: [id], onDelete: Cascade)

  // OpenPay tracking
  openpayCobroId  String    @unique  // ID del cobro en OpenPay
  openpayMetodo   String?            // 'card' | 'bank_account' | etc.

  // Datos del pago
  monto           Int                 // céntimos de soles
  estado          EstadoPago
  intentos        Int       @default(1)  // # de reintentos hasta acreditar

  // Fechas
  fecha           DateTime  @default(now())
  acreditadoEn    DateTime?
  rechazadoEn     DateTime?

  // Datos para factura
  ultimosCuatro   String?            // últimos 4 dígitos de tarjeta (para mostrar)
  marcaTarjeta    String?            // 'visa' | 'mastercard'
  codigoError     String?            // si rechazado, código del banco
  mensajeError    String?            // si rechazado, mensaje human-readable

  creadoEn        DateTime  @default(now())

  @@index([suscripcionId, fecha])
  @@map("pagos_suscripcion")
}

enum EstadoPago {
  PENDIENTE
  PAGADO
  RECHAZADO
  REEMBOLSADO
  TIMEOUT       // OpenPay no respondió en >30s
}

// Membresía en el WhatsApp Channel privado.
// Una suscripción activa debería tener al menos una fila MiembroChannel
// con estado UNIDO. Si el cron de sync detecta un suscriptor activo SIN
// MiembroChannel UNIDO, le re-envía el invite link.
model MiembroChannel {
  id              String    @id @default(cuid())
  suscripcionId   String
  suscripcion     Suscripcion @relation(fields: [suscripcionId], references: [id], onDelete: Cascade)
  usuarioId       String     // Denormalizado para queries rápidas

  estado          EstadoMembresia @default(INVITADO)
  invitadoEn      DateTime  @default(now())
  unidoEn         DateTime?           // Cuando confirmamos que está en el Channel
  removidoEn      DateTime?           // Cuando lo removimos por cancelación

  // Tracking de envíos
  invitesEnviados Int       @default(1)  // # de veces que se le mandó el invite
  ultimoInviteAt  DateTime  @default(now())

  @@unique([suscripcionId, estado])  // 1 fila activa por suscripción
  @@index([usuarioId, estado])
  @@map("miembros_channel")
}

enum EstadoMembresia {
  INVITADO          // Invite enviado, no confirmamos que se unió
  UNIDO             // Confirmado en el Channel (via API o cron sync)
  REMOVIDO          // Removido tras cancelación o churn
  REINVITADO        // Re-envió de invite (típicamente porque el usuario no se unió)
}
```

Y agregar a `Usuario`:

```prisma
model Usuario {
  // ... campos existentes ...
  suscripciones    Suscripcion[]
}
```

### 2. OpenPay client adapter

`apps/web/lib/services/pasarela-pagos/openpay-adapter.ts`:

```typescript
// Adapter real de OpenPay BBVA. Implementa el contrato PasarelaPagos.
// Usa el SDK oficial de OpenPay (instalar: pnpm add openpay).

import OpenPay from 'openpay';
import type {
  PasarelaPagos,
  CrearSuscripcionInput,
  CrearSuscripcionResult,
} from './types';

export class OpenPayAdapter implements PasarelaPagos {
  private client: OpenPay;

  constructor() {
    if (!process.env.OPENPAY_MERCHANT_ID) {
      throw new Error('OpenPay no configurado: falta OPENPAY_MERCHANT_ID');
    }

    this.client = new OpenPay(
      process.env.OPENPAY_MERCHANT_ID,
      process.env.OPENPAY_PRIVATE_KEY!,
      process.env.OPENPAY_PRODUCTION === 'true',
    );
  }

  async crearSuscripcion(input: CrearSuscripcionInput): Promise<CrearSuscripcionResult> {
    // 1. Crear o reusar Customer en OpenPay
    let customerId = await this.obtenerCustomerExistente(input.usuarioId);
    if (!customerId) {
      const customer = await this.client.customers.create({
        name: input.nombre,
        email: input.email,
        external_id: input.usuarioId,
      });
      customerId = customer.id;
    }

    // 2. Asociar tarjeta tokenizada al customer
    const card = await this.client.customers.cards.create(customerId, {
      token_id: input.tokenTarjeta,
      device_session_id: input.deviceSessionId,
    });

    // 3. Crear suscripción en OpenPay
    const planOpenPay = mapPlanToOpenPay(input.plan); // 'plan_premium_mensual' etc.
    const subscription = await this.client.customers.subscriptions.create(customerId, {
      plan_id: planOpenPay,
      card_id: card.id,
      trial_end_date: null, // Sin trial — primer cobro inmediato
    });

    return {
      suscripcionId: subscription.id,
      customerId,
      estado: subscription.status === 'active' ? 'activa' : 'pendiente',
    };
  }

  async cancelarSuscripcion(openpaySuscripcionId: string): Promise<void> {
    // Cancelación al fin del periodo actual
    await this.client.subscriptions.delete(openpaySuscripcionId);
  }

  async reembolsar(openpayCobroId: string): Promise<void> {
    await this.client.charges.refund(openpayCobroId);
  }

  // ... otros métodos auxiliares
}
```

**Plan IDs en OpenPay** (Gustavo crea estos planes manualmente en el dashboard de OpenPay):
- `plan_premium_mensual` — S/ 49 / mes
- `plan_premium_trimestral` — S/ 119 / 3 meses
- `plan_premium_anual` — S/ 399 / año

### 3. Service `suscripciones.service.ts`

`apps/web/lib/services/suscripciones.service.ts`:

```typescript
import { prisma } from '@habla/db';
import { OpenPayAdapter } from './pasarela-pagos/openpay-adapter';
import { enviarEmailBienvenida } from './email.service';
import { logger } from '@/lib/logger';

const PLANES_PRECIO = {
  MENSUAL: 4900,         // céntimos
  TRIMESTRAL: 11900,
  ANUAL: 39900,
} as const;

const PLANES_DURACION_DIAS = {
  MENSUAL: 30,
  TRIMESTRAL: 90,
  ANUAL: 365,
} as const;

export async function crearSuscripcion(input: {
  usuarioId: string;
  plan: 'mensual' | 'trimestral' | 'anual';
  tokenTarjeta: string;
  deviceSessionId: string;
  nombre: string;
  email: string;
}) {
  const planEnum = input.plan.toUpperCase() as 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
  const precio = PLANES_PRECIO[planEnum];

  // 1. Verificar que no tiene una suscripción activa ya
  const existente = await prisma.suscripcion.findFirst({
    where: { usuarioId: input.usuarioId, activa: true },
  });
  if (existente) throw new Error('Ya tienes una suscripción activa');

  // 2. Crear suscripción en OpenPay
  const openpay = new OpenPayAdapter();
  const result = await openpay.crearSuscripcion({
    usuarioId: input.usuarioId,
    plan: planEnum,
    tokenTarjeta: input.tokenTarjeta,
    deviceSessionId: input.deviceSessionId,
    nombre: input.nombre,
    email: input.email,
  });

  // 3. Crear fila en BD (estado PENDIENTE hasta que webhook confirme)
  const proximoCobro = new Date();
  proximoCobro.setDate(proximoCobro.getDate() + PLANES_DURACION_DIAS[planEnum]);

  const suscripcion = await prisma.suscripcion.create({
    data: {
      usuarioId: input.usuarioId,
      plan: planEnum,
      precio,
      openpaySuscripcionId: result.suscripcionId,
      openpayCustomerId: result.customerId,
      estado: 'PENDIENTE',
      activa: false,
      proximoCobro,
      vencimiento: proximoCobro,
    },
  });

  return suscripcion;
}

// Activación llamada desde el webhook OpenPay cuando el primer cobro acredita
export async function activarSuscripcion(openpaySuscripcionId: string, openpayCobroId: string) {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { openpaySuscripcionId },
    include: { usuario: true },
  });
  if (!suscripcion) {
    logger.warn({ openpaySuscripcionId }, 'Suscripción no encontrada al activar');
    return null;
  }

  // Idempotencia: si ya está activa, no hacer nada
  if (suscripcion.activa) return suscripcion;

  // Marcar activa + crear PagoSuscripcion + crear MiembroChannel(INVITADO)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.suscripcion.update({
      where: { id: suscripcion.id },
      data: { estado: 'ACTIVA', activa: true },
    });

    await tx.pagoSuscripcion.create({
      data: {
        suscripcionId: suscripcion.id,
        openpayCobroId,
        monto: suscripcion.precio,
        estado: 'PAGADO',
        acreditadoEn: new Date(),
      },
    });

    await tx.miembroChannel.create({
      data: {
        suscripcionId: suscripcion.id,
        usuarioId: suscripcion.usuarioId,
        estado: 'INVITADO',
      },
    });

    return tx.suscripcion.findUnique({
      where: { id: suscripcion.id },
      include: { usuario: true },
    });
  });

  // Email de bienvenida (fire-and-forget con retry)
  enviarEmailBienvenida({
    email: suscripcion.usuario.email,
    nombre: suscripcion.usuario.nombre,
    plan: suscripcion.plan,
    proximoCobro: suscripcion.proximoCobro!,
  }).catch((err) => {
    logger.error({ err, suscripcionId: suscripcion.id }, 'Error enviando email bienvenida');
  });

  return updated;
}

// Cancelar suscripción
export async function cancelarSuscripcion(suscripcionId: string, motivo?: string) {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: suscripcionId },
  });
  if (!suscripcion) throw new Error('Suscripción no encontrada');
  if (!suscripcion.openpaySuscripcionId) throw new Error('Sin ID OpenPay');

  // 1. Cancelar en OpenPay (no más cobros)
  const openpay = new OpenPayAdapter();
  await openpay.cancelarSuscripcion(suscripcion.openpaySuscripcionId);

  // 2. Marcar en BD: cancelada=true, mantiene acceso hasta vencimiento
  await prisma.suscripcion.update({
    where: { id: suscripcionId },
    data: {
      estado: 'CANCELANDO',
      cancelada: true,
      canceladaEn: new Date(),
      motivoCancela: motivo,
      // activa SIGUE en true hasta vencimiento — cron sync se encarga después
    },
  });

  return { ok: true };
}

// Procesar reembolso en garantía 7 días
export async function reembolsarEnGarantia(suscripcionId: string) {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { id: suscripcionId },
    include: { pagos: { orderBy: { fecha: 'desc' }, take: 1 } },
  });
  if (!suscripcion) throw new Error('Suscripción no encontrada');
  if (!suscripcion.enGarantia) throw new Error('Fuera de garantía (>7 días)');

  const ultimoPago = suscripcion.pagos[0];
  if (!ultimoPago) throw new Error('Sin pagos para reembolsar');

  const openpay = new OpenPayAdapter();
  await openpay.reembolsar(ultimoPago.openpayCobroId);

  await prisma.$transaction(async (tx) => {
    await tx.suscripcion.update({
      where: { id: suscripcionId },
      data: {
        estado: 'REEMBOLSADA',
        activa: false,
        reembolsoPedido: true,
        reembolsoEn: new Date(),
      },
    });

    await tx.pagoSuscripcion.update({
      where: { id: ultimoPago.id },
      data: { estado: 'REEMBOLSADO' },
    });

    // Remover del Channel
    await tx.miembroChannel.updateMany({
      where: { suscripcionId, estado: 'UNIDO' },
      data: { estado: 'REMOVIDO', removidoEn: new Date() },
    });
  });

  return { ok: true };
}
```

### 4. Webhook OpenPay handler

`apps/web/app/api/v1/openpay/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { activarSuscripcion } from '@/lib/services/suscripciones.service';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-openpay-signature');

  // 1. Verificar firma del webhook
  if (!verificarFirmaOpenPay(rawBody, signature)) {
    logger.warn({ signature }, 'Webhook OpenPay con firma inválida');
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // 2. Handle según tipo de evento
  switch (event.type) {
    case 'charge.succeeded':
      // Pago acreditado (primer pago O cobro recurrente)
      await handleChargeSuccess(event);
      break;

    case 'charge.failed':
      // Pago fallido
      await handleChargeFailed(event);
      break;

    case 'subscription.canceled':
      // Suscripción cancelada (por OpenPay, ej: tarjeta expirada después de retries)
      await handleSubscriptionCanceled(event);
      break;

    case 'subscription.expired':
      // Suscripción venció sin renovación (ej: tarjeta sin fondos por N reintentos)
      await handleSubscriptionExpired(event);
      break;

    default:
      logger.info({ eventType: event.type }, 'Webhook OpenPay tipo no manejado');
  }

  return NextResponse.json({ ok: true });
}

function verificarFirmaOpenPay(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const secret = process.env.OPENPAY_WEBHOOK_SECRET!;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return signature === expected;
}

async function handleChargeSuccess(event: any) {
  const { subscription_id, transaction_id } = event.transaction;
  if (!subscription_id) return; // Cobro único, no es de suscripción

  await activarSuscripcion(subscription_id, transaction_id);
}

async function handleChargeFailed(event: any) {
  // Crear PagoSuscripcion con estado RECHAZADO
  // Si es primer cobro: marcar suscripción como FALLIDA
  // Si es cobro recurrente: incrementar intentos, OpenPay ya reintenta automáticamente
  // ...
}
```

### 5. Email service

`apps/web/lib/services/email.service.ts`:

Reutiliza el cliente de Resend ya existente del Lote 10 (newsletter). Agregar nuevas funciones:

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function enviarEmailBienvenida(input: {
  email: string;
  nombre: string;
  plan: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
  proximoCobro: Date;
}) {
  const channelLink = process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK!;

  await resend.emails.send({
    from: 'Habla! Premium <premium@hablaplay.com>',
    to: input.email,
    subject: '🎉 ¡Bienvenido a Habla! Premium!',
    html: emailBienvenidaTemplate(input, channelLink),
    // Incluir factura PDF como attachment
    attachments: [/* generar factura PDF */],
  });
}

export async function enviarEmailReembolso(...) { ... }
export async function enviarEmailRenovacion(...) { ... }
export async function enviarEmailFalloPago(...) { ... }
```

Template de email de bienvenida (el HTML detallado vive en `07-microcopy-emails-whatsapp/`):

```typescript
function emailBienvenidaTemplate(input: ..., channelLink: string): string {
  return `
    <h1>¡Bienvenido a Premium, ${input.nombre}!</h1>
    <p>Tu plan ${input.plan.toLowerCase()} está activo.</p>
    <a href="${channelLink}" style="...">📱 Unirme al WhatsApp Channel</a>
    <p>Próximo cobro: ${input.proximoCobro.toLocaleDateString('es-PE')}</p>
    ...
  `;
}
```

### 6. Helpers de retry para envíos críticos

`apps/web/lib/utils/retry.ts`:

```typescript
export async function retryConBackoff<T>(
  fn: () => Promise<T>,
  opts: { intentos?: number; delayBaseMs?: number } = {},
): Promise<T> {
  const intentos = opts.intentos ?? 3;
  const delayBase = opts.delayBaseMs ?? 1000;

  let ultimoError: Error;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (err) {
      ultimoError = err as Error;
      const delay = delayBase * Math.pow(2, i); // 1s, 2s, 4s
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw ultimoError!;
}
```

Usado en envío de emails y webhooks de WhatsApp Business API (next spec).

## Datos requeridos

Variables de entorno (Gustavo configura en Railway):

```bash
OPENPAY_MERCHANT_ID
OPENPAY_PRIVATE_KEY
OPENPAY_PUBLIC_KEY
OPENPAY_PRODUCTION              # 'true' en prod
OPENPAY_WEBHOOK_SECRET          # para verificar firma de webhook
RESEND_API_KEY                  # ya existe (Lote 10)
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK
```

## Estados de UI

N/A — esta spec es 100% backend. Los estados de UI están en el Paquete 5A (Lote D).

## Componentes que reutiliza

- Cliente Resend existente del Lote 10.
- Logger existente del Lote 6.
- Patrón de webhooks similar al de afiliados (Lote 7) si lo hay.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Idempotencia obligatoria.** El webhook OpenPay puede reintentar el mismo evento múltiples veces. Toda lógica de webhook debe ser idempotente (verificar si ya está activa, si ya tiene pago con ese `openpayCobroId`, etc.).
- **Verificación de firma** en TODO webhook. Sin firma válida → 401.
- **Atomicidad transaccional** en operaciones que tocan múltiples tablas (`prisma.$transaction`).
- **Logs en cada falla** con contexto suficiente para debug (suscripcionId, openpayCobroId, error).
- **Reintentos para envíos críticos.** Email + sync con WhatsApp: 3 intentos con backoff exponencial. Después → log critical.
- **Cero datos de tarjeta en BD.** Solo guardamos `ultimosCuatro` y `marcaTarjeta` para mostrar al usuario.
- Eventos analíticos (NUEVO en Lote E):
  - `premium_suscripcion_activada` cuando webhook acredita primer pago
  - `premium_pago_cobrado` cuando webhook acredita cobro recurrente
  - `premium_pago_fallido` cuando webhook reporta falla
  - `premium_cancelado` cuando user cancela
  - `premium_reembolsado` cuando se procesa reembolso

## Mockup de referencia

N/A — backend.

## Pasos manuales para Gustavo

### 1. Crear cuenta OpenPay BBVA

1. Ir a https://www.openpay.pe/
2. Crear cuenta empresa (necesitas RUC de la EIRL).
3. Esperar verificación KYC (1-3 días hábiles típicamente).
4. Una vez verificada, ir al Dashboard.

### 2. Configurar planes en OpenPay Dashboard

En el Dashboard de OpenPay → "Productos" → "Planes":

1. Crear plan `plan_premium_mensual`:
   - Nombre: "Habla! Premium Mensual"
   - Precio: 49.00 PEN
   - Frecuencia: Mensual (30 días)
   - Días de gracia: 3
2. Crear plan `plan_premium_trimestral`:
   - Nombre: "Habla! Premium Trimestral"
   - Precio: 119.00 PEN
   - Frecuencia: Cada 90 días
3. Crear plan `plan_premium_anual`:
   - Nombre: "Habla! Premium Anual"
   - Precio: 399.00 PEN
   - Frecuencia: Anual (365 días)

### 3. Obtener credenciales

En el Dashboard → "Configuración" → "API Keys":

1. Copiar **Merchant ID** → variable `OPENPAY_MERCHANT_ID` en Railway.
2. Copiar **Private Key** → variable `OPENPAY_PRIVATE_KEY` en Railway.
3. Copiar **Public Key** → variable `OPENPAY_PUBLIC_KEY` en Railway (cliente lo usa).

Mientras hagas tests, mantén `OPENPAY_PRODUCTION=false`. Cuando todo funcione, cambia a `true`.

### 4. Configurar webhook

En el Dashboard → "Webhooks":

1. URL: `https://hablaplay.com/api/v1/openpay/webhook`
2. Eventos a escuchar:
   - `charge.succeeded`
   - `charge.failed`
   - `subscription.canceled`
   - `subscription.expired`
3. Generar un secret aleatorio (32+ caracteres) → variable `OPENPAY_WEBHOOK_SECRET` en Railway.
4. Pegar el mismo secret en el campo de OpenPay.

### 5. Pruebas con tarjetas de testing

OpenPay provee tarjetas de testing. Probar:

- Tarjeta exitosa: `4111 1111 1111 1111` (CVV cualquiera, fecha futura)
- Tarjeta rechazada: `4000 0000 0000 0002`
- Tarjeta con saldo insuficiente: `4000 0000 0000 0341`

Hacer estas 3 pruebas antes de pasar a producción.

### 6. Email de bienvenida

Crear el template en Resend si no existe ya. El servicio `enviarEmailBienvenida` lo invoca con datos dinámicos. El HTML del template lo escribe Claude Code en `apps/web/lib/email/templates/bienvenida-premium.tsx` (React Email).

**Validación post-deploy:**

1. Hacer una compra de testing con tarjeta `4111...`.
2. Verificar Railway logs:
   - Webhook OpenPay POST recibido
   - Firma verificada
   - `activarSuscripcion()` llamada
   - PagoSuscripcion creado
   - MiembroChannel creado en INVITADO
   - Email enviado a tu email
3. Verificar que `prisma.suscripcion.activa = true` en la BD.
4. Verificar que recibes email con link al Channel.
5. Probar cancelación desde `/premium/mi-suscripcion` → verificar que `cancelada=true` y `estado=CANCELANDO`.
6. Probar reembolso (manual desde admin Lote F): verificar que `reembolsoPedido=true` y se acredita en OpenPay dashboard.

---

*Versión 1 · Abril 2026 · Suscripciones backend para Lote E*
