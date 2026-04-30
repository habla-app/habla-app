# WhatsApp Channel flow (Lote E)

Spec del cliente WhatsApp Business API + flujo de envío de picks al Channel privado *Habla! Picks*. Es la pieza que conecta los picks aprobados del editor con la entrega real al usuario suscriptor.

## Lote responsable

**Lote E** — Premium backend automatización.

## Estado actual del repo

Sin nada relacionado con WhatsApp en el repo. Todo se construye desde cero en este lote.

## Contexto de negocio crítico

**Decisión arquitectónica:** Usamos **WhatsApp Channels** (broadcast 1-a-N), no WhatsApp Groups (chat bidireccional). Razones:

1. **Escalabilidad.** Channels permiten miles de suscriptores sin spam. Groups quedan inmanejables a partir de ~250.
2. **Control editorial.** Solo el admin puede publicar. Los suscriptores leen, no responden en el Channel.
3. **Para conversación 1:1** existe un bot separado vía WhatsApp Business API (ver `bot-faq.spec.md` del Paquete 5C).

**Limitación importante:** WhatsApp Business API NO ofrece publicación automatizada en Channels (al momento de este spec, abril 2026). Channels actualmente requieren publicación manual desde la app de WhatsApp en el teléfono del admin.

**Solución de Habla!:** un **modo híbrido temporal**:
- Lote E genera el mensaje formateado (markdown WhatsApp).
- Admin recibe el mensaje en el dashboard `/admin/picks-premium` con botón "📋 Copiar mensaje" + "📱 Abrir WhatsApp".
- Admin pega manualmente en el Channel cuando aprueba.
- En paralelo, el sistema envía el mismo pick al **bot de WhatsApp Business API** que es un canal 1:1 con cada suscriptor (alternativa de respaldo si el admin tarda en publicar al Channel).

Cuando WhatsApp libere API para publicación automatizada en Channels (lo van a hacer eventualmente), el flujo se automatiza eliminando el paso manual.

## Cambios necesarios

### 1. WhatsApp Business API client

`apps/web/lib/services/whatsapp/wa-business-client.ts`:

```typescript
// Cliente HTTP de WhatsApp Business API (Cloud API).
// Docs: https://developers.facebook.com/docs/whatsapp/cloud-api

interface WhatsAppMessage {
  to: string;            // Phone E.164: +51999999999
  type: 'text' | 'template' | 'interactive';
  text?: { body: string };
  template?: { ... };
  interactive?: { ... };
}

export class WhatsAppBusinessClient {
  private phoneNumberId: string;
  private accessToken: string;
  private apiVersion = 'v22.0';

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN!;
  }

  // Enviar mensaje 1:1 a un suscriptor (NO al Channel — al bot 1:1)
  async enviarMensaje(input: {
    to: string;
    body: string;
  }): Promise<{ messageId: string }> {
    const response = await fetch(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: input.to,
          type: 'text',
          text: { body: input.body },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${error}`);
    }

    const data = await response.json();
    return { messageId: data.messages[0].id };
  }

  // Marcar mensaje recibido como "leído" (mejora retention en bot)
  async marcarLeido(messageId: string): Promise<void> {
    await fetch(
      `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      }
    );
  }
}
```

### 2. Service de envío de pick al bot 1:1

`apps/web/lib/services/whatsapp/picks-distribuidor.service.ts`:

```typescript
// Distribuye un pick aprobado a todos los suscriptores activos.
// El envío es por bot 1:1 (no Channel — eso es manual del admin).

import { WhatsAppBusinessClient } from './wa-business-client';
import { formatearPickPremium } from './pick-formato';
import { retryConBackoff } from '@/lib/utils/retry';

export async function distribuirPickAprobado(pickId: string) {
  const pick = await prisma.pickPremium.findUnique({
    where: { id: pickId },
    include: { partido: true, casaRecomendada: true },
  });
  if (!pick || !pick.aprobado) throw new Error('Pick no aprobado o no existe');

  // Cargar suscriptores activos con phone configurado
  const suscriptores = await prisma.suscripcion.findMany({
    where: {
      activa: true,
      usuario: { telefono: { not: null } },
      // Solo suscriptores con preferencia notifPremiumPicks=true
      usuario: { preferenciasNotif: { notifPremiumPicks: true } },
    },
    include: { usuario: true },
  });

  const wa = new WhatsAppBusinessClient();
  const resultados = await Promise.allSettled(
    suscriptores.map(async (sub) => {
      // Watermark con email para dificultar leak
      const mensaje = formatearPickPremium(pick, {
        watermark: sub.usuario.email,
      });

      // Retry 3x con backoff
      return await retryConBackoff(
        () => wa.enviarMensaje({
          to: sub.usuario.telefono!,
          body: mensaje,
        }),
        { intentos: 3, delayBaseMs: 2000 }
      );
    })
  );

  // Marcar pick como enviado (al menos a algunos)
  const enviadosOk = resultados.filter((r) => r.status === 'fulfilled').length;
  const fallaron = resultados.filter((r) => r.status === 'rejected').length;

  await prisma.pickPremium.update({
    where: { id: pickId },
    data: {
      enviadoAlChannel: enviadosOk > 0,
      enviadoEn: new Date(),
    },
  });

  // Log critical si fallaron muchos
  if (fallaron / suscriptores.length > 0.1) {
    logger.error(
      { pickId, total: suscriptores.length, fallaron, enviadosOk },
      'Más de 10% de envíos de pick fallaron'
    );
  }

  return { enviadosOk, fallaron, total: suscriptores.length };
}
```

### 3. Webhook de WhatsApp Business API

`apps/web/app/api/v1/whatsapp/webhook/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// Verificación inicial del webhook (Meta hace GET con token de verificación)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// Recibir eventos (mensajes entrantes, status updates)
export async function POST(request: Request) {
  const body = await request.json();

  // Verificar firma X-Hub-Signature-256
  const signature = request.headers.get('x-hub-signature-256');
  if (!verificarFirmaWhatsApp(JSON.stringify(body), signature)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
  }

  // Procesar cada evento
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;

      // Mensaje recibido del usuario → bot FAQ (siguiente spec)
      if (value.messages) {
        await handleMensajeEntrante(value.messages, value.contacts);
      }

      // Status update (delivered, read, failed)
      if (value.statuses) {
        await handleStatusUpdate(value.statuses);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

function verificarFirmaWhatsApp(body: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET!)
    .update(body)
    .digest('hex');
  return signature === expected;
}

// handleMensajeEntrante → ver bot-faq.spec.md (Paquete 5C)
// handleStatusUpdate → log + analytics
```

### 4. Modelo Usuario extendido

Agregar a `Usuario` en Prisma:

```prisma
model Usuario {
  // ... campos existentes ...
  telefono   String?  // E.164 formato: +51999999999. Capturado en checkout.
}
```

Y a `PreferenciasNotif`:

```prisma
model PreferenciasNotif {
  // ... existentes ...
  notifPremiumPicks       Boolean @default(true)   // Recibir picks en bot 1:1
  notifPremiumAlertasVivo Boolean @default(true)   // Alertas en vivo durante partidos
}
```

### 5. Trigger automático al aprobar pick

Modificar el endpoint de aprobación (Lote F) para que dispare el envío:

```typescript
// apps/web/app/api/v1/admin/picks-premium/[id]/aprobar/route.ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  // ... auth de admin ...

  await prisma.pickPremium.update({
    where: { id: params.id },
    data: { estado: 'APROBADO', aprobado: true, aprobadoEn: new Date() },
  });

  // Disparar envío en background (no bloquea la respuesta del admin)
  distribuirPickAprobado(params.id).catch((err) => {
    logger.error({ err, pickId: params.id }, 'Error distribuyendo pick aprobado');
  });

  return NextResponse.json({ ok: true });
}
```

### 6. Captura de teléfono en checkout

En `/premium/checkout`, agregar campo opcional "Teléfono WhatsApp" al form:

- Validación: formato E.164 (+51XXXXXXXXX para Perú).
- Default prefix `+51`.
- Storage: en `Usuario.telefono`.
- Mensaje: "Te enviamos los picks por WhatsApp 1:1 a este número (además del Channel grupal)."

Si user no provee teléfono: usa solo el Channel manual del admin (sin envío 1:1 a su número).

## Datos requeridos

Variables de entorno:

```bash
META_BUSINESS_ID                # ID de tu Meta Business Account
WHATSAPP_PHONE_NUMBER_ID        # ID del número que envía mensajes
WHATSAPP_ACCESS_TOKEN           # Token permanente del System User
WHATSAPP_VERIFY_TOKEN           # Token aleatorio para verificación inicial del webhook
WHATSAPP_APP_SECRET             # Secret de la App de Meta (para firmar webhooks)
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK  # URL pública del Channel
```

## Componentes que reutiliza

- `retryConBackoff` (Lote E suscripciones-backend).
- Logger (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Verificación de firma** en webhook WhatsApp (X-Hub-Signature-256).
- **Verify token** debe ser aleatorio de 32+ caracteres y secreto.
- **Rate limit WhatsApp Business API:** 80 mensajes/segundo en tier inicial. Para envíos masivos (>1000 suscriptores), implementar queue con throttling. Inicialmente <500 suscriptores → no hace falta queue.
- **Watermark con email** del suscriptor en cada pick para dificultar forwarding masivo.
- **Solo enviar a suscriptores activos** con `notifPremiumPicks=true` y `telefono` válido.
- **Idempotencia:** si un pick ya fue enviado (`enviadoAlChannel=true`), no reenviar al disparar de nuevo el endpoint.
- Eventos analíticos:
  - `pick_premium_distribuido` cuando se completa el envío (NUEVO Lote E).
  - `pick_premium_envio_fallido_individual` por cada falla individual de envío (NUEVO Lote E).
  - `whatsapp_mensaje_recibido` cuando webhook recibe mensaje del bot 1:1 (ver `bot-faq.spec.md`).

## Mockup de referencia

N/A — backend. El formato del mensaje se especifica en `pick-formato.spec.md` (Paquete 5C).

## Pasos manuales para Gustavo

### 1. Crear Meta Business Account + WhatsApp Business

1. Ir a https://business.facebook.com/
2. Crear Business Account si no tienes (necesitas RUC EIRL).
3. Agregar la App de WhatsApp:
   - En Business Settings → Apps → Add App.
   - Tipo: "Business" → "WhatsApp".
   - Nombre: "Habla! Picks".
4. Verificar el negocio (Meta pide documentos legales — proceso de 2-7 días).

### 2. Configurar número de WhatsApp Business

1. En la App de WhatsApp Business → "Add phone number".
2. Recomendación: usar un número dedicado (no tu personal). Comprar SIM nueva si hace falta.
3. Verificar el número (recibe código por SMS o llamada).
4. Una vez verificado: copiar **Phone Number ID** → variable `WHATSAPP_PHONE_NUMBER_ID`.

### 3. Generar System User Access Token (permanente)

1. En Business Settings → System Users → Add.
2. Nombre: "Habla! Backend".
3. Asignar permisos: WhatsApp Business Management + WhatsApp Business Messaging.
4. Generate Token → seleccionar la App → tokens permanente (sin expiración).
5. Copiar token → variable `WHATSAPP_ACCESS_TOKEN`.

### 4. Configurar webhook

1. En la App de WhatsApp → Webhooks.
2. Callback URL: `https://hablaplay.com/api/v1/whatsapp/webhook`.
3. Verify Token: generar aleatorio (32+ chars con `openssl rand -hex 32`) → variable `WHATSAPP_VERIFY_TOKEN`.
4. Suscribir a eventos:
   - `messages` (recibir mensajes del bot)
   - `message_status` (status updates)
5. Copiar **App Secret** de la app de Meta → variable `WHATSAPP_APP_SECRET`.

### 5. Crear el WhatsApp Channel privado

(Ya documentado en `premium-landing.spec.md` del Paquete 5A. Reproducido aquí por completitud.)

1. Abrir WhatsApp en tu teléfono → Updates → "+" → "Create channel".
2. Nombre: `Habla! Picks`.
3. Description: `Picks de valor con razonamiento. Solo suscriptores Premium.`
4. Visibility: "Not discoverable" (privado).
5. Copy invite link → variable `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK`.
6. **IMPORTANTE:** subir 3-5 picks históricos al Channel antes del primer suscriptor.

### 6. Tier upgrade (opcional pero recomendado)

WhatsApp Business API arranca en tier 0 (250 conversaciones/24h). Para escalar:
1. Esperar a tener 10+ conversaciones reales (5-7 días).
2. Meta auto-eleva a tier 1 (1,000 conversaciones/24h).
3. Después se sigue subiendo automático según uso.

Para Habla! con 500 suscriptores estimados al mes 1, tier 0-1 es suficiente.

**Validación post-deploy:**

1. Webhook GET test: ir a `https://hablaplay.com/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$WHATSAPP_VERIFY_TOKEN&hub.challenge=test` → debe responder `test`.
2. Manualmente disparar `distribuirPickAprobado(pickId)` con un pick de testing → verificar Railway logs:
   - Loop por suscriptores
   - Llamadas a WhatsApp API
   - PickPremium.enviadoAlChannel = true
3. Verificar en tu propio WhatsApp (con número de testing): debe llegar el mensaje formateado.
4. Probar webhook entrante: enviar un mensaje desde tu WhatsApp al número de Business → verificar que llega al webhook (Railway logs).
5. Una vez todo verde: contactar a 5-10 testers de confianza para hacer compras de testing y validar end-to-end.

---

*Versión 1 · Abril 2026 · WhatsApp Channel flow para Lote E*
