# Post-pago `/premium/exito`

Vista que aparece inmediatamente después del checkout exitoso. Su función única es **entregar el link al WhatsApp Channel privado** y dar instrucciones claras para unirse. Es un momento crítico — si el usuario no se une al Channel aquí, la fricción aumenta exponencialmente.

## Lote responsable

**Lote D** — Premium WhatsApp Channel UI usuario.

## Estado actual del repo

NUEVA — esta vista no existe en el repo actual.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/(public)/premium/exito/page.tsx`:
  - Server component PROTEGIDO (requiere auth + verificación de suscripción activa).
  - Si no hay suscripción activa: redirect a `/premium`.
  - Renderiza `<PostPagoView>`.
  - `dynamic = 'force-dynamic'`.

- `apps/web/components/premium/PostPagoHero.tsx`:
  - Hero verde con check grande "✓ ¡Bienvenido a Premium!".
  - Sub: "Tu suscripción [Anual] está activa hasta [fecha]."
  - Indicador de progreso completo: ●—●—● (Plan elegido → Pagar → Acceso al Channel).

- `apps/web/components/premium/UnirseChannelBigCTA.tsx`:
  - **Componente más importante de la vista.** Es lo único que el usuario debe ver y hacer aquí.
  - Card grande con:
    - Logo WhatsApp + "Habla! Picks ✓"
    - Mensaje: "Únete al Channel privado para recibir picks"
    - Botón XL verde WhatsApp con deep link al Channel: `https://whatsapp.com/channel/...` (de env var `WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK`)
    - Sub: "El link se abrirá en WhatsApp"
  - Click dispatcha evento `whatsapp_channel_link_clickeado` y abre el deep link en nueva tab/app.

- `apps/web/components/premium/InstruccionesPostPago.tsx`:
  - Lista numerada de "qué pasa ahora":
    1. **Únete al Channel** con el botón de arriba.
    2. **Recibirás 2-4 picks/día** con razonamiento estadístico.
    3. **El primer pick llega en menos de 24h** (excepto domingos cuando hay menos partidos).
    4. **Para FAQ 24/7** envía cualquier mensaje al WhatsApp del bot: [link al bot].

- `apps/web/components/premium/EmailConfirmacionInfo.tsx`:
  - Card info: "📧 Te enviamos un email a [email del usuario] con tu factura y el link al Channel."
  - Si el email aún no se envió (raro pero posible): mensaje "El email tarda hasta 5 min. Si no llega, [reenviar →]" con server-action `reenviarEmailBienvenida()`.

- `apps/web/components/premium/SiguientesPasosPremium.tsx`:
  - Sección secundaria con accesos rápidos:
    - "🤖 Conoce el bot de FAQ" → linkea al WhatsApp del bot
    - "⚙ Gestionar mi suscripción" → `/premium/mi-suscripcion`
    - "📊 Volver al inicio" → `/`
    - "💬 ¿Dudas? Contáctanos" → `/ayuda/faq`

### Archivos a modificar

Ninguno.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/premium/exito/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { suscripcionId?: string };
}

export default async function PostPagoPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const userId = session.user.id;

  // Verificar suscripción activa (más reciente del usuario)
  const suscripcion = await prisma.suscripcion.findFirst({
    where: { usuarioId: userId, activa: true },
    orderBy: { iniciada: 'desc' },
    include: { usuario: { select: { email: true, nombre: true } } },
  });

  if (!suscripcion) {
    // No hay suscripción activa — el webhook OpenPay aún no llegó
    // Mostrar vista de "verificando" en lugar de redirect inmediato
    return <PostPagoVerificando userId={userId} />;
  }

  // Link único al Channel (de env var, igual para todos por ahora)
  const channelInviteLink = process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK;
  const botPhoneNumber = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER; // formato wa.me/

  return (
    <PostPagoView
      suscripcion={suscripcion}
      channelInviteLink={channelInviteLink}
      botPhoneNumber={botPhoneNumber}
    />
  );
}
```

### Vista de verificación (caso edge)

Si el webhook de OpenPay tarda, la vista entra en modo "verificando":

```typescript
// apps/web/components/premium/PostPagoVerificando.tsx
'use client';

export function PostPagoVerificando({ userId }: { userId: string }) {
  // Polling cada 3s a /api/v1/suscripciones/me hasta detectar activa
  // Timeout 60s → mensaje "Tu pago se está procesando. Te enviaremos un email cuando esté listo. [Volver →]"
  ...
}
```

## Estados de UI

### Estructura principal

```
┌──────────────────────────────────┐
│ <PostPagoHero>                   │
│   - ✓ Bienvenido a Premium       │
│   - Plan + fecha vencimiento     │
│   - Progreso ●—●—●               │
├──────────────────────────────────┤
│ <UnirseChannelBigCTA>            │  ← LO PRIMERO Y MÁS IMPORTANTE
├──────────────────────────────────┤
│ <InstruccionesPostPago>          │
├──────────────────────────────────┤
│ <EmailConfirmacionInfo>          │
├──────────────────────────────────┤
│ <SiguientesPasosPremium>         │
└──────────────────────────────────┘
```

### Variantes según contexto

#### Suscripción activa confirmada
- Render normal con todos los componentes.

#### Suscripción NO confirmada aún (webhook tardó)
- Render `<PostPagoVerificando>` con spinner + "Verificando tu pago..."
- Polling al backend cada 3s.
- Al detectar activa → re-render normal sin recargar.
- Si timeout 60s → fallback con mensaje + email de soporte.

#### Usuario llega aquí sin pago (manipulación de URL)
- Si NO hay sesión: redirect a `/auth/signin`.
- Si HAY sesión pero NO suscripción activa NI reciente: redirect a `/premium`.

### Loading

- Server component → render directo si la suscripción ya está confirmada.
- Si está en modo verificando: spinner full-screen.

### Error

- Si la query falla: mostrar fallback "Algo salió mal verificando tu pago. Si pagaste, llegará el email. [Contactar soporte]".

## Componentes que reutiliza

- `<MobileHeader>` (Lote A) — variante simplificada (sin BottomNav que distrae del CTA principal).
- `<Card>`, `<Button>` del design system.
- Token `--whatsapp-green` y `--whatsapp-green-dark` para el botón principal.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **NO mostrar `<BottomNav>`** en esta vista. El usuario debe enfocarse en el CTA del Channel. El `<BottomNav>` aparece de nuevo en `/premium/mi-suscripcion` o `/`.
- Mobile-first riguroso.
- Touch target del CTA principal es muy grande (~64px alto).
- Eventos analíticos:
  - `premium_post_pago_visto` en mount (NUEVO Lote D).
  - `whatsapp_channel_link_clickeado` cuando click en el CTA principal (NUEVO Lote D).
  - `email_bienvenida_reenviado` si usa el reenvío manual (NUEVO Lote D).

## Mockup de referencia

`post-pago.html` en este mismo folder.

## Pasos manuales para Gustavo post-deploy

Ninguno directo en esta vista, pero **antes del primer pago real**, asegurar que estos pasos manuales del Lote E están completos:

1. WhatsApp Channel privado creado (ver pasos en `premium-landing.spec.md`).
2. Variables de entorno OpenPay y WhatsApp configuradas en Railway.
3. Webhook OpenPay registrado en su dashboard apuntando a `https://hablaplay.com/api/v1/openpay/webhook`.
4. Email template de bienvenida creado en Resend (ver `suscripciones-backend.spec.md` del Paquete 5B).

**Validación post-deploy:**
1. Hacer un pago de testing.
2. Verificar redirect a `/premium/exito`.
3. Verificar que el botón verde WhatsApp lleva al Channel.
4. Verificar que llega el email de bienvenida con el mismo link.
5. Probar caso edge: pagar y abrir manualmente `/premium/exito` antes de que llegue webhook → debe entrar en modo "verificando" y eventually mostrar la vista normal.

---

*Versión 1 · Abril 2026 · Post-pago para Lote D*
