# Checkout `/premium/checkout`

Vista de checkout con form OpenPay embebido. El usuario ya seleccionó plan y procede a pagar. Mobile-first riguroso.

## Lote responsable

**Lote D** — Premium WhatsApp Channel UI usuario.

## Estado actual del repo

NUEVA — esta vista no existe en el repo actual. Se crea desde cero en Lote D.

Contrato existente: `apps/web/lib/services/pasarela-pagos/types.ts` define `PasarelaPagos` interface con `crearSuscripcion`. El Lote D consume este contrato cuando Lote E implementa el adapter real OpenPay.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/(public)/premium/checkout/page.tsx`:
  - Server component PROTEGIDO (requiere auth).
  - Si no auth: redirect a `/auth/signup?callbackUrl=/premium/checkout?plan=...`.
  - Si ya es Premium activo: redirect a `/premium/mi-suscripcion`.
  - Renderiza `<CheckoutView>`.
  - `dynamic = 'force-dynamic'`.

- `apps/web/components/premium/CheckoutHero.tsx`:
  - Hero compacto: "Activa tu Premium" + "Falta 1 paso".
  - Indicador de progreso: ●—●—○ (Plan elegido → Pagar → Acceso al Channel).

- `apps/web/components/premium/PlanResumen.tsx`:
  - Card lateral/superior con resumen del plan elegido:
    - Nombre del plan
    - Precio total + frecuencia
    - Equivalencia mensual
    - Garantía 7 días
  - Botón "Cambiar plan" → vuelve a `/premium`.

- `apps/web/components/premium/OpenPayForm.tsx`:
  - Form embebido OpenPay.
  - Campos:
    - Nombre completo (prefilled del usuario auth)
    - Email (prefilled, read-only)
    - Tarjeta: número, MM/AA, CVV, nombre como aparece
    - Tipo de documento + número (DNI, RUC, CE)
    - Phone (opcional, para WhatsApp)
  - Validación inline server-side con Zod.
  - El Form ATRAPA el submit y llama a OpenPay.js (cliente de OpenPay) para tokenizar la tarjeta antes de mandar al backend. Esto evita que datos de tarjeta toquen el servidor de Habla!.
  - Backend recibe solo el `tokenTarjeta` + datos no sensibles → llama a `crearSuscripcion()` del adapter OpenPay.

- `apps/web/components/premium/SeguridadCheckout.tsx`:
  - Sección bajo el form con badges de seguridad:
    - "🔒 Pago procesado por OpenPay BBVA"
    - "🛡 Tarjeta encriptada con TLS"
    - "✓ No guardamos datos de tarjeta"
  - Logos: Visa, Mastercard, OpenPay.

- `apps/web/components/premium/CheckoutLoadingState.tsx`:
  - Mostrado mientras procesa el pago (después de submit).
  - Spinner grande + "Procesando tu suscripción... Esto puede tomar unos segundos."
  - **NO permite cerrar la tab ni navegar back** (warning con `beforeunload` event).

### Archivos a modificar

Ninguno. Es vista nueva.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/premium/checkout/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { plan?: 'mensual' | 'trimestral' | 'anual' };
}

const PLANES = {
  mensual: { precio: 49, periodo: 'mes', label: 'Mensual', planOpenPay: 'plan_premium_mensual' },
  trimestral: { precio: 119, periodo: '3 meses', label: 'Trimestral', planOpenPay: 'plan_premium_trimestral' },
  anual: { precio: 399, periodo: 'año', label: 'Anual', planOpenPay: 'plan_premium_anual' },
} as const;

export default async function CheckoutPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signup?callbackUrl=/premium/checkout');
  }

  const userId = session.user.id;
  const planKey = searchParams?.plan ?? 'anual';
  const plan = PLANES[planKey];
  if (!plan) redirect('/premium');

  // Verificar que no es ya suscriptor activo
  const suscripcionActiva = await prisma.suscripcion.findFirst({
    where: { usuarioId: userId, activa: true },
  }).catch(() => null);

  if (suscripcionActiva) {
    redirect('/premium/mi-suscripcion');
  }

  // Datos del usuario para prefill
  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { nombre: true, email: true },
  });

  return (
    <CheckoutView
      plan={{ ...plan, key: planKey }}
      usuario={usuario}
      userId={userId}
    />
  );
}
```

### Server-action de submit

```typescript
// apps/web/app/(public)/premium/checkout/actions.ts
'use server';

import { z } from 'zod';
import { auth } from '@/lib/auth';
import { OpenPayAdapter } from '@/lib/services/pasarela-pagos/openpay';
import { crearSuscripcion } from '@/lib/services/suscripciones.service';

const checkoutSchema = z.object({
  plan: z.enum(['mensual', 'trimestral', 'anual']),
  tokenTarjeta: z.string().min(1),  // Generado por OpenPay.js client-side
  nombre: z.string().min(1),
  documento: z.object({
    tipo: z.enum(['DNI', 'RUC', 'CE']),
    numero: z.string().min(1),
  }),
  phone: z.string().optional(),
});

export async function procesarCheckout(input: z.infer<typeof checkoutSchema>) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('No autenticado');

  const data = checkoutSchema.parse(input);

  try {
    const suscripcion = await crearSuscripcion({
      usuarioId: session.user.id,
      plan: data.plan,
      tokenTarjeta: data.tokenTarjeta,
      datosFacturacion: { ... },
    });

    return { ok: true, suscripcionId: suscripcion.id };
  } catch (err) {
    // Log error, return error code
    return { ok: false, error: err.message };
  }
}
```

Si `OpenPayAdapter` aún no existe (Lote E pendiente): el server-action lanza error claro "Pagos aún no configurados" y el form muestra mensaje al usuario.

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ <CheckoutHero>                   │
│   - Indicador de progreso ●—●—○  │
├──────────────────────────────────┤
│ <PlanResumen>                    │
│   - Plan + precio + garantía     │
│   - Botón "Cambiar plan"         │
├──────────────────────────────────┤
│ <OpenPayForm>                    │
│   - Datos personales (prefilled) │
│   - Tarjeta                      │
│   - Documento                    │
├──────────────────────────────────┤
│ <SeguridadCheckout>              │
│   - Badges + logos               │
├──────────────────────────────────┤
│ <StickyCTABar>                   │
│   - "💎 Pagar S/ X · Activar"    │
└──────────────────────────────────┘
```

### Estados

#### Loading inicial
- OpenPay.js cargándose: muestra skeleton del form mientras se inicializa.
- Tipicamente <2s.

#### Form llenándose
- Validación inline en blur de cada campo.
- Errores rojos bajo el input.

#### Submit en proceso
- Render `<CheckoutLoadingState>` full-screen overlay.
- Lo activa el `useTransition()` de React.
- `beforeunload` event evita que cierre tab.

#### Submit exitoso
- Redirect inmediato a `/premium/exito?suscripcionId=...`.

#### Submit error: tarjeta rechazada
- Toast rojo: "Tu tarjeta fue rechazada por el banco. Intenta con otra."
- Form NO se limpia. Foco en campo número de tarjeta.

#### Submit error: pago duplicado
- Toast info: "Detectamos un pago reciente. Verificando tu suscripción..."
- Polling cada 2s al backend hasta que `suscripcion.activa === true`.
- Después: redirect a `/premium/exito`.

#### Submit error: timeout (>30s sin respuesta)
- Toast warning: "El proceso está tardando. Recarga esta página en 1 minuto. Si tu tarjeta fue cobrada, recibirás un email."
- Botón "Recargar" prominente.

#### OpenPay no configurado (Lote E pendiente)
- Banner top: "⚠ Pagos aún no disponibles. Avísame cuando esté listo:" + form de email para waitlist.
- Form de checkout disabled.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<StickyCTABar>` (Lote A).
- `<Input>`, `<Button>`, `<Card>` del design system.
- `<Toast>` para errores.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Cero datos de tarjeta tocan el servidor de Habla!**. La tokenización ocurre en cliente con OpenPay.js. El backend recibe solo el token.
- TLS estricto: `next-secure-headers` ya está configurado (Lote 1).
- No persistir nada del form en localStorage ni en client storage.
- Mobile-first.
- Touch targets ≥44px en inputs, especialmente CVV (3 dígitos, fácil mistap).
- Form con `autocomplete` correctos para que el navegador autofille (`cc-number`, `cc-exp`, `cc-csc`, `cc-name`).
- Eventos analíticos:
  - `premium_checkout_iniciado` en mount (NUEVO Lote D).
  - `premium_checkout_completado` en webhook OpenPay éxito (NUEVO Lote E).
  - `premium_checkout_fallido` en submit error con código de error (NUEVO Lote D).

## Mockup de referencia

`checkout.html` en este mismo folder.

## Pasos manuales para Gustavo post-deploy

**Después del primer deploy con OpenPay funcional:**

1. Probar checkout con la tarjeta de testing de OpenPay (te paso credenciales por separado): número `4111 1111 1111 1111`, CVV `123`, fecha cualquiera futura.
2. Verificar que llega webhook a `/api/v1/openpay/webhook` (revisar Railway logs).
3. Verificar que se crea fila en `prisma.suscripcion` con `activa = true`.
4. Verificar que redirige a `/premium/exito`.
5. Probar tarjeta rechazada (de testing OpenPay): debe mostrar toast rojo y NO crear suscripción.

**Validación con tarjeta real (cuando esté listo):**
1. Hacer una compra real con tu tarjeta personal usando un email distinto al de admin.
2. Verificar que se acreditó en OpenPay dashboard.
3. Verificar que recibes el email de bienvenida con link al WhatsApp Channel.
4. Probar reembolso desde OpenPay dashboard manualmente para validar el flow.

---

*Versión 1 · Abril 2026 · Checkout para Lote D*
