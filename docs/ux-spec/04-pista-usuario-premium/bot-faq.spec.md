# Bot FAQ — WhatsApp 1:1 conversacional (Lote E)

Spec del bot de WhatsApp Business API que responde 1:1 a suscriptores Premium. Usa Claude API + base de conocimiento curada para responder dudas en español neutro.

## Lote responsable

**Lote E** — Premium backend automatización.

## Estado actual del repo

NUEVO — sin bot conversacional. Se construye desde cero.

## Contexto de negocio

El bot es una promesa central de Habla! Premium: *"Bot de FAQ 24/7 en WhatsApp"*. Resuelve dudas comunes (cómo registrarse en una casa, qué es EV+, cómo se calculan los puntos, cómo cancelar suscripción, etc.) sin que un humano tenga que responder.

**Limitaciones del bot:**
- NO da consejos personalizados de apuestas ("¿debo apostar a este partido?").
- NO interpreta picks futuros ("¿cuándo viene el próximo pick?").
- NO ejecuta transacciones (cancelar suscripción se hace desde la web).
- SÍ responde preguntas factuales sobre Habla!, apuestas en general, casas, MINCETUR.
- SÍ deriva a soporte humano si la pregunta sale del scope.

## Cambios necesarios

### 1. Modelo de conversación

Agregar a Prisma:

```prisma
model ConversacionBot {
  id              String    @id @default(cuid())
  usuarioId       String?            // null si no autenticado (raro pero posible)
  usuario         Usuario?  @relation(fields: [usuarioId], references: [id], onDelete: SetNull)

  whatsappFrom    String              // Phone E.164 que envía
  ultimoMensajeAt DateTime  @default(now())
  cerrada         Boolean   @default(false)  // True si user no escribe en >7 días o pidió fin

  mensajes        MensajeBot[]
  creadoEn        DateTime  @default(now())

  @@index([whatsappFrom, cerrada])
  @@map("conversaciones_bot")
}

model MensajeBot {
  id              String    @id @default(cuid())
  conversacionId  String
  conversacion    ConversacionBot @relation(fields: [conversacionId], references: [id], onDelete: Cascade)

  rol             RolMensaje      // USER | ASSISTANT
  contenido       String   @db.Text
  whatsappMsgId   String?          // ID del mensaje en WhatsApp (para correlacionar)

  // Metadata si es ASSISTANT
  generadoConIA   Boolean   @default(false)
  modeloIA        String?            // 'claude-opus-4-7' etc
  tokensUsados    Int?
  fueDerivado     Boolean   @default(false)  // true si se derivó a soporte humano

  creadoEn        DateTime  @default(now())

  @@index([conversacionId, creadoEn])
  @@map("mensajes_bot")
}

enum RolMensaje {
  USER
  ASSISTANT
}
```

### 2. Handler de mensaje entrante

Modificar `apps/web/app/api/v1/whatsapp/webhook/route.ts` (creado en Paquete 5B) para procesar mensajes entrantes:

```typescript
async function handleMensajeEntrante(messages: any[], contacts: any[]) {
  for (const msg of messages) {
    if (msg.type !== 'text') {
      // Por ahora solo soportamos texto. Audio/video/imagen → respuesta genérica.
      await responderTipoNoSoportado(msg.from);
      continue;
    }

    await procesarMensajeUsuario({
      whatsappFrom: msg.from,
      contenido: msg.text.body,
      whatsappMsgId: msg.id,
      contactName: contacts?.[0]?.profile?.name,
    });
  }
}
```

### 3. Service del bot

`apps/web/lib/services/whatsapp/bot-faq.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@habla/db';
import { WhatsAppBusinessClient } from './wa-business-client';
import { BASE_CONOCIMIENTO } from './bot-knowledge-base';
import { logger } from '@/lib/logger';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-4-7';

export async function procesarMensajeUsuario(input: {
  whatsappFrom: string;
  contenido: string;
  whatsappMsgId: string;
  contactName?: string;
}) {
  // 1. Buscar usuario por phone
  const usuario = await prisma.usuario.findFirst({
    where: { telefono: input.whatsappFrom },
  });

  // 2. Obtener o crear conversación abierta
  let conversacion = await prisma.conversacionBot.findFirst({
    where: { whatsappFrom: input.whatsappFrom, cerrada: false },
    include: { mensajes: { orderBy: { creadoEn: 'asc' }, take: 20 } },
  });

  if (!conversacion) {
    conversacion = await prisma.conversacionBot.create({
      data: {
        whatsappFrom: input.whatsappFrom,
        usuarioId: usuario?.id,
      },
      include: { mensajes: true },
    });
  }

  // 3. Guardar mensaje del usuario
  await prisma.mensajeBot.create({
    data: {
      conversacionId: conversacion.id,
      rol: 'USER',
      contenido: input.contenido,
      whatsappMsgId: input.whatsappMsgId,
    },
  });

  // 4. Verificar si el user es Premium activo (límite de uso para no-Premium)
  const esPremium = usuario?.id
    ? await esSuscriptorPremium(usuario.id)
    : false;

  // Si no es Premium: respuesta limitada con CTA a `/premium`
  if (!esPremium) {
    return await responderNoPremium(conversacion, input.whatsappFrom, usuario?.nombre);
  }

  // 5. Construir contexto para Claude (últimos 10 mensajes + base conocimiento)
  const historial = conversacion.mensajes.slice(-10).map((m) => ({
    role: m.rol === 'USER' ? 'user' : 'assistant',
    content: m.contenido,
  }));

  // 6. Llamar Claude
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 800,
    system: SYSTEM_PROMPT_BOT(usuario?.nombre, BASE_CONOCIMIENTO),
    messages: [
      ...historial,
      { role: 'user', content: input.contenido },
    ],
  });

  const respuestaClaude = response.content
    .filter((c) => c.type === 'text')
    .map((c) => (c as any).text)
    .join('\n');

  // 7. Detectar si se debe derivar a soporte humano
  const debeDerivar = respuestaClaude.toLowerCase().includes('[derivar_humano]');
  const respuestaFinal = debeDerivar
    ? respuestaClaude.replace('[DERIVAR_HUMANO]', '').trim() +
      '\n\nVoy a derivar tu pregunta a un humano. Te responderemos en menos de 24h. 🙋'
    : respuestaClaude;

  // 8. Guardar mensaje del bot
  await prisma.mensajeBot.create({
    data: {
      conversacionId: conversacion.id,
      rol: 'ASSISTANT',
      contenido: respuestaFinal,
      generadoConIA: true,
      modeloIA: MODEL,
      tokensUsados: response.usage.input_tokens + response.usage.output_tokens,
      fueDerivado: debeDerivar,
    },
  });

  // 9. Enviar respuesta por WhatsApp
  const wa = new WhatsAppBusinessClient();
  await wa.enviarMensaje({
    to: input.whatsappFrom,
    body: respuestaFinal,
  });

  // 10. Si fue derivado, notificar al admin (email + log critical)
  if (debeDerivar) {
    await notificarAdminConsultaDerivada(conversacion.id);
  }

  // 11. Actualizar timestamp de conversación
  await prisma.conversacionBot.update({
    where: { id: conversacion.id },
    data: { ultimoMensajeAt: new Date() },
  });
}
```

### 4. System prompt del bot

`apps/web/lib/services/whatsapp/bot-prompts.ts`:

```typescript
export function SYSTEM_PROMPT_BOT(nombreUsuario?: string, baseConocimiento?: string): string {
  return `Eres el asistente virtual de Habla! Picks (https://hablaplay.com), una plataforma editorial de apuestas deportivas en Perú.

Tu rol: responder dudas de suscriptores Premium en WhatsApp 1:1, en español neutro, breve y amigable.

REGLAS DURAS:
1. NO recomiendes apuestas específicas. Si te preguntan "¿debo apostar a X?" responde que el editor de Habla! publica picks en el Channel y que cada usuario debe decidir según su análisis.
2. NO inventes datos. Si no sabes algo, di "No tengo info sobre eso, déjame derivarlo a un humano" y agrega el marcador [DERIVAR_HUMANO] al final de tu respuesta.
3. NO opines sobre temas no relacionados con apuestas, fútbol, Habla! o casas legales en Perú.
4. NO compartas links externos excepto los de hablaplay.com o las casas autorizadas listadas en la base de conocimiento.
5. NO menciones precios de la suscripción o promociones que no estén en la base de conocimiento.
6. SÍ deriva a humano [DERIVAR_HUMANO] si la pregunta es sobre: cobros incorrectos, problemas de pago, reembolsos, denuncias, eliminación de cuenta, queja por un pick específico.
7. Mantén respuestas BREVES (máx 200 palabras). Esto es WhatsApp, no email.
8. Usa emojis con moderación (1-2 por mensaje). Tono amigable pero profesional.
9. Si el usuario te saluda por primera vez en la conversación, presentate brevemente: "Hola${nombreUsuario ? ' ' + nombreUsuario : ''}, soy el asistente de Habla! ¿En qué te ayudo?"
10. Apuesta responsable es siempre prioridad. Si detectas señales de ludopatía (frases como "perdí todo", "necesito recuperar", "estoy desesperado"), responde con empatía + deriva a recursos: Línea Tugar 0800-19009 o info@coludopatia.org.pe.

BASE DE CONOCIMIENTO:
${baseConocimiento ?? '(sin base cargada)'}`;
}
```

### 5. Base de conocimiento

`apps/web/lib/services/whatsapp/bot-knowledge-base.ts`:

```typescript
export const BASE_CONOCIMIENTO = `
## Sobre Habla!

Habla! es una plataforma editorial de apuestas deportivas en Perú. NO somos una casa de apuestas — somos un medio que te recomienda casas autorizadas, te enseña a apostar mejor con análisis y comunidad, y te enviamos picks Premium con razonamiento.

Web: https://hablaplay.com
WhatsApp Channel: https://whatsapp.com/channel/{LINK_DEL_CHANNEL}
Soporte: soporte@hablaplay.com

## Productos

1. **Liga Habla! (gratis):** Comunidad de tipsters compitiendo mensualmente por S/ 1,250 en premios. Cualquiera con cuenta puede participar.
2. **Vista de partidos (gratis):** Análisis editorial + cuotas comparadas + pronóstico Habla!
3. **Premium (suscripción):** Picks de valor con razonamiento estadístico + casa con mejor cuota + alertas en vivo + bot 24/7 + resumen semanal.

## Planes Premium

- Mensual: S/ 49/mes (cancela cuando quieras)
- Trimestral: S/ 119 (ahorra 19% — equivalente S/ 39.6/mes)
- Anual: S/ 399 (ahorra 32% — equivalente S/ 33.2/mes — plan más popular)

Todos con garantía de 7 días. Si no te gusta, te devolvemos el 100%.

Para suscribirte: https://hablaplay.com/premium
Para gestionar suscripción: https://hablaplay.com/premium/mi-suscripcion

## Liga Habla! · Sistema de puntos

Cada partido top abre un torneo con 5 mercados:
- Resultado 1X2: 3 puntos
- Ambos anotan: 2 puntos
- Más/menos 2.5 goles: 2 puntos
- Tarjeta roja: 6 puntos
- Marcador exacto: 8 puntos

Puntaje máximo por partido: 21 puntos.

Predicciones se cierran al kickoff. No se puede modificar después.

## Premios mensuales (Liga Habla!)

- 1° lugar: S/ 500
- 2°-3° lugar: S/ 200 c/u
- 4°-10° lugar: S/ 50 c/u
- Total mensual: S/ 1,250

Pago vía transferencia bancaria a cuenta del ganador. Plazo: 5 días hábiles tras cierre del mes.

## Casas autorizadas listadas en Habla!

Solo listamos casas con licencia MINCETUR vigente. Verificamos semanalmente.

Casas activas (al momento): Betano, Betsson, 1xBet, Stake, Bet365, Doradobet, MeridianBet, Cocodrilo, RetaBet.

Si una casa pierde licencia MINCETUR → la quitamos del listado al instante.

## MINCETUR (regulación Perú)

MINCETUR es el Ministerio de Comercio Exterior y Turismo. Regula las apuestas online en Perú desde 2022.

Solo casas con licencia MINCETUR pueden operar legalmente. Verificación: https://www.gob.pe/mincetur

Por qué importa: si una casa no tiene licencia, no hay protección legal si te roban tu dinero.

## EV+ (valor esperado)

EV+ significa que la cuota que ofrece la casa está por encima de la probabilidad real del evento, según los datos. Apostar consistentemente a EV+ teóricamente da rentabilidad positiva en el largo plazo.

Ejemplo: si la probabilidad real de un evento es 60% (cuota justa = 1.67) y la casa paga 1.85, hay EV+ del 11%.

Habla! Premium solo recomienda picks con EV+ ≥ 5%.

## Stake (cuánto apostar)

Stake es el porcentaje de tu bankroll que pones en una apuesta.

Recomendaciones generales:
- Stake bajo: 1% (apuestas estándar)
- Stake medio: 2% (alta confianza)
- Stake alto: 3% (muy alta confianza, raros)

NUNCA apuestes más del 3% del bankroll en una sola apuesta.

## Bot vs editor humano

Soy un bot — un asistente virtual. Respondo dudas factuales sobre Habla!, apuestas y casas. NO soy el editor que escribe los picks. Para preguntas sobre picks específicos o problemas con tu suscripción, derivo a un humano.

## Apuesta responsable

Las apuestas son entretenimiento, no inversión. Solo apuesta dinero que puedes permitirte perder.

Si sientes que pierdes el control:
- Línea Tugar (gratuita): 0800-19009
- Email: info@coludopatia.org.pe
- Web: https://coludopatia.org.pe

Habla! NO se hace responsable por pérdidas en apuestas.

## Cancelar suscripción

Para cancelar: https://hablaplay.com/premium/mi-suscripcion → botón "Cancelar suscripción".

Mantienes acceso al Channel hasta tu próxima fecha de renovación. No te cobramos más después.

## Reembolsos

Garantía de 7 días: si en los primeros 7 días no te gusta, escríbeme y te derivo al equipo. Reembolso 100%.

Después de 7 días: no hay reembolso, pero puedes cancelar para no renovar.
`;
```

### 6. Respuesta a no-Premium

```typescript
async function responderNoPremium(
  conversacion: ConversacionBot,
  whatsappFrom: string,
  nombreUsuario?: string,
) {
  const respuesta = `Hola${nombreUsuario ? ' ' + nombreUsuario : ''}! 👋

Soy el bot FAQ de Habla! — pero solo respondo dudas de suscriptores Premium.

Si quieres acceso, suscríbete aquí (S/ 49/mes, garantía 7 días):
https://hablaplay.com/premium

Si tienes dudas sobre Habla! sin ser Premium, escríbenos a soporte@hablaplay.com 💌`;

  await prisma.mensajeBot.create({
    data: {
      conversacionId: conversacion.id,
      rol: 'ASSISTANT',
      contenido: respuesta,
    },
  });

  const wa = new WhatsAppBusinessClient();
  await wa.enviarMensaje({ to: whatsappFrom, body: respuesta });
}
```

### 7. Notificación al admin cuando se deriva

```typescript
async function notificarAdminConsultaDerivada(conversacionId: string) {
  const conv = await prisma.conversacionBot.findUnique({
    where: { id: conversacionId },
    include: {
      mensajes: { orderBy: { creadoEn: 'desc' }, take: 5 },
      usuario: true,
    },
  });

  // Email al admin con resumen de la conversación
  await enviarEmailAdmin({
    to: process.env.ADMIN_EMAIL!,
    subject: `[Habla!] Bot derivó consulta · ${conv?.usuario?.email ?? conv?.whatsappFrom}`,
    body: formatearConversacionParaEmail(conv),
  });
}
```

## Datos requeridos

Variables de entorno (ya configuradas en suscripciones-backend.spec y whatsapp-channel-flow.spec):

```bash
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_ACCESS_TOKEN
ADMIN_EMAIL                     # email para notificaciones de derivación
```

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Rate limit Claude API.** Cada llamada cuesta. Limitar: máximo 10 mensajes/usuario/hora. Si supera: respuesta genérica "Has alcanzado el límite de uso del bot. Intenta de nuevo en 1 hora."
- **Cero alucinaciones de información sensible.** Si Claude no sabe algo de la base de conocimiento, debe decir "No tengo info sobre eso" + [DERIVAR_HUMANO]. NUNCA inventar datos sobre planes, premios, números o procesos.
- **Detección de ludopatía** es prioridad. Si frases activan, responder empáticamente + derivar recursos antes que cualquier otra cosa.
- **Logs detallados.** Cada conversación se loguea con: usuario, mensaje, tokens consumidos, tiempo de respuesta. Para auditoría futura.
- **Auditoría de derivaciones.** Cuando se deriva a humano, email al admin + entrada en `prisma.mensajeBot.fueDerivado=true` para tracking.
- **Privacidad.** Conversaciones se guardan en BD pero el usuario puede pedir eliminación (vía `/perfil/eliminar/confirmar`). Soft delete con anonimización.
- Eventos analíticos:
  - `bot_mensaje_recibido` cada vez que llega mensaje de user (NUEVO Lote E).
  - `bot_respuesta_generada` cuando Claude responde (NUEVO Lote E).
  - `bot_consulta_derivada` cuando se deriva a humano (NUEVO Lote E).
  - `bot_ludopatia_detectada` cuando triggers de ludopatía activan (NUEVO Lote E, urgente notificar a admin).

## Mockup de referencia

N/A — backend.

## Pasos manuales para Gustavo

### 1. Mantenimiento de la base de conocimiento

La BASE_CONOCIMIENTO vive como string en código. Cuando cambien planes, premios, casas listadas, FAQ común:
1. Actualizar el archivo `bot-knowledge-base.ts`.
2. Hacer commit + push.
3. Railway re-deploy automático → bot empieza a usar la nueva versión.

NO requiere acción técnica adicional.

### 2. Variable ADMIN_EMAIL

Configurar en Railway:
```
ADMIN_EMAIL=tu-email@hablaplay.com
```

A este email llegan las notificaciones cuando el bot deriva una consulta a humano. Revísalo al menos 1 vez al día.

**Validación post-deploy:**

1. Desde tu WhatsApp, escribir al número del bot: "Hola, ¿qué es Premium?"
2. Verificar que llega respuesta en <30 segundos.
3. Probar pregunta que debería derivarse: "Tengo un cobro mal en mi tarjeta, devuélveme mi plata."
4. Verificar que recibes email en `ADMIN_EMAIL` con la conversación.
5. Probar pregunta de ludopatía: "Estoy desesperado, perdí todo apostando."
6. Verificar respuesta empática + recursos de Tugar + log critical.
7. Verificar limit: enviar 11 mensajes en 1 hora → 11vo debe responder mensaje de límite.

---

*Versión 1 · Abril 2026 · Bot FAQ para Lote E*
