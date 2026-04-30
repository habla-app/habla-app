# Mi suscripción `/premium/mi-suscripcion`

Vista de gestión de la suscripción Premium del usuario. Estado actual + próximo cobro + cambiar plan + cancelar + link al Channel.

## Lote responsable

**Lote D** — Premium WhatsApp Channel UI usuario.

## Estado actual del repo

NUEVA — esta vista no existe en el repo actual.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/(public)/premium/mi-suscripcion/page.tsx`:
  - Server component PROTEGIDO (requiere auth + suscripción activa o cancelada reciente).
  - Si no auth: redirect a `/auth/signin?callbackUrl=/premium/mi-suscripcion`.
  - Si no es ni fue Premium: redirect a `/premium`.
  - `dynamic = 'force-dynamic'`.

- `apps/web/components/premium/SuscripcionEstadoCard.tsx`:
  - Card grande con estado actual:
    - **Si activa:** badge verde "✓ Activa", plan actual, próximo cobro, monto.
    - **Si cancelando (cancelada=true pero acceso hasta fin del periodo):** badge amber "⚠ Cancelando", "Acceso hasta [fecha]", botón "Reactivar".
    - **Si vencida (período pagado terminó sin renovar):** badge gris "Vencida hace X días", botón "Reactivar".

- `apps/web/components/premium/HistorialPagos.tsx`:
  - Lista de últimos N pagos (default 12 — un año):
    - Fecha + plan + monto + estado (Pagado / Reembolsado / Fallido) + botón "Descargar factura" si aplica.
  - Datos de `prisma.pagoSuscripcion`.

- `apps/web/components/premium/CambiarPlanSection.tsx`:
  - Sección con los 3 planes y el actual destacado.
  - Si user puede upgrade (mensual → trimestral/anual): botón "Cambiar a [Plan]".
  - Si user puede downgrade (anual → mensual/trimestral): botón "Cambiar a [Plan]" con warning "Tu plan actual te dura hasta [fecha]. El cambio aplica desde la siguiente renovación."
  - Backend: server-action `cambiarPlan(nuevoPlan)`.

- `apps/web/components/premium/AccesosRapidos.tsx`:
  - Cards 2x2 con accesos rápidos:
    - "📱 Mi WhatsApp Channel" → deep link al Channel
    - "🤖 Bot FAQ" → wa.me link al bot
    - "💬 Soporte" → `/ayuda/faq`
    - "📊 Estadísticas Premium" → `/premium/contenido`

- `apps/web/components/premium/CancelarSuscripcionSection.tsx`:
  - Sección sobria al pie con botón "Cancelar suscripción" (variant `outline danger`).
  - Click → abre modal `<CancelarConfirmModal>`.

- `apps/web/components/premium/CancelarConfirmModal.tsx`:
  - Modal con:
    - Title: "¿Cancelar tu suscripción?"
    - Body: "Mantienes acceso hasta el [fecha]. No te cobramos más."
    - Survey opcional (1 pregunta): "¿Por qué cancelas? [Caro / No me sirvió / Solo lo probaba / Otro motivo]"
    - Botones: "Confirmar cancelación" (danger) / "Mantener suscripción" (outline gold).
  - Submit → `cancelarSuscripcion(motivo)` que cancela en OpenPay + marca `prisma.suscripcion.cancelada=true` con fecha de fin de periodo + dispatcha `premium_cancelado` event.

### Archivos a modificar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(public)/premium/mi-suscripcion/page.tsx
export const dynamic = 'force-dynamic';

export default async function MiSuscripcionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/premium/mi-suscripcion');
  }

  const userId = session.user.id;

  // Suscripción más reciente (activa o cancelada con acceso vigente)
  const suscripcion = await prisma.suscripcion.findFirst({
    where: { usuarioId: userId },
    orderBy: { iniciada: 'desc' },
    include: {
      pagos: {
        orderBy: { fecha: 'desc' },
        take: 12,
      },
    },
  });

  if (!suscripcion) {
    redirect('/premium');
  }

  const channelInviteLink = process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK;
  const botPhoneNumber = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER;

  return (
    <MiSuscripcionView
      suscripcion={suscripcion}
      channelInviteLink={channelInviteLink}
      botPhoneNumber={botPhoneNumber}
    />
  );
}
```

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ Hero "Mi suscripción Premium"    │
├──────────────────────────────────┤
│ <SuscripcionEstadoCard>          │
│   - Estado + plan + próximo cobro│
├──────────────────────────────────┤
│ <AccesosRapidos>                 │
├──────────────────────────────────┤
│ <CambiarPlanSection>             │
├──────────────────────────────────┤
│ <HistorialPagos>                 │
├──────────────────────────────────┤
│ <CancelarSuscripcionSection>     │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Variantes por estado

| Estado | `<SuscripcionEstadoCard>` | `<CambiarPlanSection>` | `<CancelarSuscripcionSection>` |
|---|---|---|---|
| Activa | Verde · próximo cobro | Visible · cambiar plan | Visible · "Cancelar" |
| Cancelando (acceso vigente) | Amber · acceso hasta X | OCULTA | "Reactivar" en lugar de cancelar |
| Vencida | Gris · "vencida hace X días" | OCULTA · solo "Renovar" | OCULTA |

### Loading / Error

- Server-rendered.
- Si OpenPay falla en cancelar: rollback de la fila en BD + mensaje al usuario "Hubo un problema cancelando. Intenta de nuevo o contacta soporte."

## Componentes que reutiliza

- `<MobileHeader>`, `<BottomNav>` (Lote A).
- `<Card>`, `<Badge>`, `<Button>`, `<Modal>` del design system.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- **Cancelación clara y sin trampas.** Botón "Cancelar" visible. Modal con info honesta. Sin "dark patterns".
- Eventos analíticos:
  - `premium_mi_suscripcion_visto` en mount (NUEVO Lote D).
  - `premium_plan_cambiado` cuando cambio aplicado (NUEVO Lote D).
  - `premium_cancelado` cuando confirma cancelación con motivo opcional (NUEVO Lote D).
  - `premium_reactivado` cuando reactiva (NUEVO Lote D).

## Mockup de referencia

`mi-suscripcion.html` en este mismo folder.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Logueado como Premium activo, abrir `/premium/mi-suscripcion`.
2. Verificar estado, plan, próximo cobro.
3. Probar cambio de plan (con tarjeta de testing).
4. Probar cancelación → modal aparece → confirmar.
5. Verificar que `prisma.suscripcion.cancelada = true` y mantiene acceso hasta fin de periodo.
6. Verificar redirect a `/premium/mi-suscripcion` muestra estado "Cancelando".
7. Probar "Reactivar".

---

*Versión 1 · Abril 2026 · Mi suscripción para Lote D*
