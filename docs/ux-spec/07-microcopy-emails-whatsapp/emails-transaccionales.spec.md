# Emails transaccionales

Spec del catálogo completo de emails transaccionales de Habla!. Cada email con su template React Email, lista de variables, trigger, y reglas de envío.

## Lote responsable

**Lote H** — Microcopy + emails + WhatsApp templates.

## Estado actual del repo

- Cliente Resend configurado en Lote 10 con `RESEND_API_KEY`.
- Email del newsletter (suscripción + confirmación doble opt-in) ya existe del Lote 10.
- Sin templates centralizados — cada vez que se necesita un email se construye HTML inline.

## Cambios necesarios

### Decisión arquitectónica

Toda la lógica de email vive en `apps/web/lib/email/`:

```
apps/web/lib/email/
├── client.ts              ← cliente Resend (ya existe Lote 10)
├── send.ts                ← función helper send(opts) con retry y log
├── templates/
│   ├── _components/        ← Header, Footer, Button, Section reusables
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── Button.tsx
│   │   └── Layout.tsx
│   ├── BienvenidaPremium.tsx
│   ├── FacturaPremium.tsx
│   ├── ReembolsoConfirmado.tsx
│   ├── ... (10 templates)
└── types.ts                ← types compartidos
```

Cada template es **React Email** que renderiza HTML inline-style. Resend acepta tanto HTML como React directamente.

### Catálogo de los 11 emails canónicos

| # | Template | Trigger | Categoría | Prioridad |
|---|---|---|---|---|
| 1 | `MagicLinkAuth` | Login con magic link (NextAuth) | Auth | Alta |
| 2 | `BienvenidaRegistro` | Registro completado | Onboarding | Media |
| 3 | `ConfirmacionNewsletter` | Subscribe a newsletter | Newsletter | Alta |
| 4 | `BienvenidaPremium` | Suscripción Premium activada | Transactional | **Crítica** |
| 5 | `FacturaPremium` | Pago Premium acreditado (incluye PDF) | Transactional | **Crítica** |
| 6 | `RenovacionRecordatorio` | 7 días antes de renovación Premium | Transactional | Media |
| 7 | `FalloPagoPremium` | Pago Premium falló > 3 intentos | Transactional | Alta |
| 8 | `ReembolsoConfirmado` | Reembolso procesado | Transactional | Alta |
| 9 | `PremioMensualSolicitarDatos` | Top 10 sin datos bancarios | Transactional | Alta |
| 10 | `PremioMensualPagado` | Premio mensual pagado | Transactional | Alta |
| 11 | `EliminacionConfirmada` | Solicitud eliminación cuenta procesada | Compliance | Media |

### Componentes base (`_components/`)

#### `Layout.tsx`

Wrapper base con header + slot de contenido + footer.

```tsx
interface LayoutProps {
  preview: string;        // Preview text para inbox
  children: React.ReactNode;
}

export function Layout({ preview, children }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#F5F7FC' }}>
        <Container style={{ maxWidth: '600px', margin: '20px auto', backgroundColor: '#fff', borderRadius: '12px', padding: '32px' }}>
          <Header />
          <Section>{children}</Section>
          <Footer />
        </Container>
      </Body>
    </Html>
  );
}
```

#### `Header.tsx`

```tsx
export function Header() {
  return (
    <Section style={{ paddingBottom: '24px', borderBottom: '1px solid #E5E7EB' }}>
      <Img
        src="https://hablaplay.com/logo-email.png"
        width="120"
        alt="Habla!"
      />
    </Section>
  );
}
```

#### `Footer.tsx`

```tsx
export function Footer() {
  return (
    <Section style={{ paddingTop: '32px', borderTop: '1px solid #E5E7EB', fontSize: '12px', color: '#6B7280' }}>
      <Text>
        Habla! · Una plataforma editorial de apuestas en Perú · No somos casa de apuestas.
      </Text>
      <Text>
        Apuesta responsable. Si necesitas ayuda: Línea Tugar 0800-19009.
      </Text>
      <Text>
        <Link href="https://hablaplay.com/perfil/preferencias-notif">Preferencias de email</Link>
        {' · '}
        <Link href="https://hablaplay.com/perfil/eliminar">Eliminar cuenta</Link>
      </Text>
    </Section>
  );
}
```

#### `Button.tsx`

```tsx
interface ButtonProps {
  href: string;
  variant?: 'gold' | 'outline' | 'whatsapp';
  children: React.ReactNode;
}

export function Button({ href, variant = 'gold', children }: ButtonProps) {
  const styles = {
    gold: { backgroundColor: '#FFB800', color: '#001050' },
    outline: { backgroundColor: 'transparent', color: '#001050', border: '2px solid #001050' },
    whatsapp: { backgroundColor: '#25D366', color: '#fff' },
  }[variant];

  return (
    <a
      href={href}
      style={{
        ...styles,
        display: 'inline-block',
        padding: '14px 28px',
        borderRadius: '10px',
        fontWeight: 700,
        textDecoration: 'none',
        fontSize: '15px',
      }}
    >
      {children}
    </a>
  );
}
```

### Templates (resumen + ejemplos clave)

#### Email 1: `MagicLinkAuth.tsx`

**Trigger:** NextAuth dispara cuando user pide magic link login.
**Variables:** `magicLink: string`, `nombre?: string`.

```tsx
export function MagicLinkAuth({ magicLink, nombre }: { magicLink: string; nombre?: string }) {
  return (
    <Layout preview="Tu enlace de acceso a Habla!">
      <Heading>Hola{nombre ? ` ${nombre}` : ''} 👋</Heading>
      <Text>
        Click en el botón para entrar a Habla!. Este enlace funciona solo una vez y vence en 30 minutos.
      </Text>
      <Section style={{ textAlign: 'center', paddingTop: '24px', paddingBottom: '24px' }}>
        <Button href={magicLink}>Entrar a Habla!</Button>
      </Section>
      <Text style={{ fontSize: '12px', color: '#6B7280' }}>
        ¿No fuiste tú? Ignora este email. Nadie podrá entrar sin el enlace.
      </Text>
    </Layout>
  );
}
```

#### Email 4: `BienvenidaPremium.tsx` ⭐

**Trigger:** webhook OpenPay confirma primer pago Premium → `activarSuscripcion()` (Lote E).
**Variables:** `nombre: string`, `plan: 'mensual' | 'trimestral' | 'anual'`, `proximoCobro: Date`, `channelLink: string`, `email: string`.

```tsx
export function BienvenidaPremium(props: {
  nombre: string;
  plan: 'MENSUAL' | 'TRIMESTRAL' | 'ANUAL';
  proximoCobro: Date;
  channelLink: string;
  email: string;
}) {
  const planLabel = { MENSUAL: 'Mensual', TRIMESTRAL: 'Trimestral', ANUAL: 'Anual' }[props.plan];

  return (
    <Layout preview={`Bienvenido a Habla! Premium · Plan ${planLabel}`}>
      <Heading style={{ fontSize: '28px' }}>
        🎉 ¡Bienvenido a Premium, {props.nombre}!
      </Heading>
      <Text>
        Tu suscripción Plan <strong>{planLabel}</strong> está activa.
      </Text>

      <Section style={{ backgroundColor: '#0a0e25', color: '#fff', padding: '24px', borderRadius: '12px', textAlign: 'center', margin: '24px 0' }}>
        <Text style={{ color: '#fff', fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
          📱 Próximo paso: únete al WhatsApp Channel
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '16px', fontSize: '14px' }}>
          Es donde recibirás los picks. Solo 1 click.
        </Text>
        <Button href={props.channelLink} variant="whatsapp">
          Unirme al Channel
        </Button>
      </Section>

      <Text style={{ fontWeight: 700, marginBottom: '8px' }}>Lo que recibes:</Text>
      <Text style={{ marginBottom: '4px' }}>✓ 2-4 picks/día con razonamiento estadístico</Text>
      <Text style={{ marginBottom: '4px' }}>✓ Casa con mejor cuota en cada pick</Text>
      <Text style={{ marginBottom: '4px' }}>✓ Alertas en vivo durante partidos top</Text>
      <Text style={{ marginBottom: '4px' }}>✓ Bot FAQ 24/7 en WhatsApp</Text>
      <Text>✓ Resumen semanal los lunes</Text>

      <Hr style={{ margin: '32px 0' }} />

      <Text style={{ fontSize: '13px', color: '#6B7280' }}>
        Próximo cobro: <strong>{format(props.proximoCobro, 'dd/MM/yyyy')}</strong><br />
        Plan: <strong>{planLabel}</strong><br />
        Email: <strong>{props.email}</strong>
      </Text>

      <Text style={{ fontSize: '13px', color: '#6B7280' }}>
        Para gestionar tu suscripción: <Link href="https://hablaplay.com/premium/mi-suscripcion">Mi suscripción</Link>
      </Text>
    </Layout>
  );
}
```

#### Email 5: `FacturaPremium.tsx`

**Trigger:** cada pago acreditado (primer pago + renovaciones).
**Variables:** `nombre`, `numeroOperacion`, `monto`, `plan`, `fecha`, `metodoPago`, `urlFactura`.

Body simple con datos del cobro + adjunto PDF (factura electrónica). PDF generado con `pdf-lib` o servicio externo.

#### Email 6: `RenovacionRecordatorio.tsx`

**Trigger:** cron diario que busca suscripciones con `proximoCobro` en exactamente 7 días.
**Variables:** `nombre`, `plan`, `proximoCobro`, `monto`.

Tono amigable: "Tu Premium se renueva el [fecha] por S/ X. Si quieres cancelar, [link]".

#### Email 7: `FalloPagoPremium.tsx`

**Trigger:** webhook OpenPay reporta `charge.failed` 3 veces consecutivas → `procesarPagosFallidos` (Lote E cron).
**Variables:** `nombre`, `monto`, `linkActualizarTarjeta`.

Tono empático: "No pudimos procesar tu pago. Tu Premium pausó. Actualiza tu tarjeta para reactivar."

#### Email 8: `ReembolsoConfirmado.tsx`

**Trigger:** admin procesa reembolso desde `/admin/suscripciones/[id]`.
**Variables:** `nombre`, `monto`, `fechaReembolso`, `motivoOpcional`.

#### Email 9: `PremioMensualSolicitarDatos.tsx`

**Trigger:** admin click "Solicitar datos" en `/admin/premios-mensuales` (Lote F).
**Variables:** `nombre`, `posicion`, `puntos`, `monto`, `mes`.

Body completo ya documentado en `premios-mensuales.spec.md` del Paquete 6B.

#### Email 10: `PremioMensualPagado.tsx`

**Trigger:** admin click "Marcar pagado" en `/admin/premios-mensuales`.
**Variables:** `nombre`, `monto`, `posicion`, `mes`, `bancoOrigen`, `bancoDestino`, `numeroOperacion`, `fecha`, `comprobanteUrl?`.

Body con detalles del pago + comprobante adjunto.

#### Email 11: `EliminacionConfirmada.tsx`

**Trigger:** flujo `/perfil/eliminar/confirmar` (Sub-Sprint 7).
**Variables:** `email`, `fechaEliminacion`.

Tono neutro: "Tu cuenta fue eliminada. Datos anonimizados. Si fue error, no se puede deshacer."

### Función helper `send.ts`

```typescript
import { resend } from './client';
import { logger } from '@/lib/logger';
import { retryConBackoff } from '@/lib/utils/retry';

interface SendOpts {
  to: string;
  subject: string;
  react: React.ReactElement;
  attachments?: { filename: string; content: Buffer | string }[];
  tags?: { name: string; value: string }[];   // Para tracking en Resend
}

export async function sendEmail(opts: SendOpts) {
  return retryConBackoff(async () => {
    try {
      const result = await resend.emails.send({
        from: 'Habla! <hola@hablaplay.com>',
        to: opts.to,
        subject: opts.subject,
        react: opts.react,
        attachments: opts.attachments,
        tags: opts.tags,
      });

      logger.info({ to: opts.to, subject: opts.subject, id: result.id }, 'Email enviado');
      return result;
    } catch (err) {
      logger.error({ err, to: opts.to, subject: opts.subject }, 'Error enviando email');
      throw err;
    }
  }, { intentos: 3, delayBaseMs: 2000 });
}
```

### From addresses por categoría

| Categoría | From |
|---|---|
| Auth (magic link) | `Habla! <auth@hablaplay.com>` |
| Onboarding (bienvenida registro) | `Habla! <hola@hablaplay.com>` |
| Newsletter | `Habla! Newsletter <newsletter@hablaplay.com>` |
| Premium transactional | `Habla! Premium <premium@hablaplay.com>` |
| Compliance (eliminación) | `Habla! <legal@hablaplay.com>` |

Tener distintos `from` permite que algunos emails se whitelisten más fácil + segmentación en filtros del usuario.

## Datos requeridos

Variables de entorno (ya configuradas Lote 10 + suscripciones-backend Lote E):

```bash
RESEND_API_KEY
WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK
```

## Estados de UI

N/A — son templates de email, no UI.

### Vista preview en desarrollo

`npx react-email dev` levanta servidor local en `http://localhost:3000` que renderiza cada template con datos de mock. Útil para iteración rápida sin enviar emails reales.

### Vista preview desde el admin

(Opcional, pero recomendado para futuro Lote.) Vista `/admin/emails/preview` donde admin puede:
- Seleccionar template
- Llenar variables manualmente
- Ver render HTML
- Click "Enviar a mi email" para test

## Componentes que reutiliza

- Cliente Resend (Lote 10).
- `retryConBackoff` (Lote E).
- React Email (npm package — instalar: `pnpm add react-email @react-email/components`).
- Logger (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Tono según `tono-de-voz.spec.md`** del Paquete 7A. Persona "tú", informal-friendly.
- **Glosario consistente** según `glosario.spec.md`.
- **Footer obligatorio** en todos los emails con: link a preferencias notif, link a eliminar cuenta, mención de Tugar.
- **Apuesta responsable** mencionada en cualquier email Premium o de captación a casas.
- **Cero promesas legales** (ganarás, garantizamos rentabilidad).
- **Subject line** corto (<60 chars para no truncar en mobile inbox) + emoji al inicio cuando sea apropiado.
- **Preview text** distinto del subject (aporta info adicional).
- **Inline styles obligatorios** (no CSS classes — clientes de email no soportan stylesheets externos).
- **Imágenes con URL absoluta** (`https://hablaplay.com/...`) — no relativas.
- **Width 600px máximo** para compatibilidad con Outlook.
- **Botones como `<a>` con padding generoso** (no `<button>` — Outlook los rompe).
- **Texto fallback de imágenes** con `alt`.
- **Send retry 3x con backoff** en cada envío crítico.
- **Logs detallados** de cada envío (to, subject, id de Resend).

## Mockup de referencia

`npx react-email dev` para preview local de cada template.

## Pasos manuales para Gustavo

### Configurar dominios verificados en Resend

Antes del primer envío productivo:

1. Ir a https://resend.com/domains.
2. Add domain → `hablaplay.com`.
3. Resend te da DNS records (SPF, DKIM, DMARC) → agregarlos en Cloudflare DNS.
4. Verificar (puede tardar hasta 24h).
5. Una vez verificado: los emails desde `@hablaplay.com` se envían sin marca de "via resend.com".

### Agregar imagen de logo en `/public/logo-email.png`

Logo cuadrado 120×120 px PNG con fondo transparente o blanco. Lo usa `<Header />` en cada email.

### Probar cada template antes de productivo

Para los 11 emails:

1. Ejecutar `npx react-email dev` → preview local.
2. Validar render visual.
3. Probar en Gmail / Outlook / Apple Mail con Litmus o Email on Acid (opcional pero recomendado).
4. Una vez aprobado: deploy.

### Setup Reply-To genérico

Configurar en Resend que los emails con from `auth@`, `premium@`, etc tengan reply-to `soporte@hablaplay.com`. Si user responde el email, llega al inbox de soporte.

**Validación post-deploy:**

1. Hacer testing real de cada flujo:
   - Magic link login → recibir `MagicLinkAuth`
   - Suscribirse a Premium con tarjeta de testing → recibir `BienvenidaPremium` + `FacturaPremium`
   - Disparar reembolso de testing → recibir `ReembolsoConfirmado`
   - Etc.
2. Verificar que cada email se ve correctamente en mobile (Gmail app) y desktop (Outlook web).
3. Verificar que el footer linkea correctamente a `/perfil/preferencias-notif` y `/perfil/eliminar`.

---

*Versión 1 · Abril 2026 · Emails transaccionales para Lote H*
