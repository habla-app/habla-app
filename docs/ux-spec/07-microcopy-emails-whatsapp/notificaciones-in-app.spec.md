# Notificaciones in-app

Spec del sistema de toasts, banners y notificaciones de la UI. Es la pieza que comunica feedback inmediato al usuario tras una acción (éxito, error, info). Crítica para que el producto se sienta responsivo y honesto.

## Lote responsable

**Lote H** — Microcopy + emails + WhatsApp templates.

## Estado actual del repo

- Sin sistema centralizado de toasts. Algunas vistas usan `alert()` nativo o estados locales con `useState`. Inconsistente.
- `<Toast>` mencionado en specs anteriores (5A checkout, 5C bot) pero sin implementación canónica.

## Cambios necesarios

### Decisión arquitectónica

Implementar **sistema centralizado de toasts** con:
- **Hook global `useToast()`** que cualquier componente cliente puede llamar.
- **Provider top-level** en `app/layout.tsx` que renderiza el stack de toasts.
- **4 severidades:** success / info / warning / error.
- **Auto-dismiss** con duración variable según severidad.
- **Stacking** si llegan múltiples (max 3 visibles).
- **Persistente** opcional para errores críticos que requieren acción manual.

Implementación basada en `sonner` (npm package, lightweight, accessible) o construcción custom. Recomiendo `sonner` para velocidad.

### Archivos a crear

- `apps/web/components/ui/Toaster.tsx`:
  - Wrapper de `<Toaster />` de sonner con configuración de Habla!.
  - Posición: bottom-right en desktop, bottom-center full-width en mobile.
  - Tema: light con tokens del design system.

- `apps/web/lib/toast.ts`:
  - Re-exports tipados de `toast` de sonner con métodos custom:
    ```typescript
    import { toast } from 'sonner';

    export const showToast = {
      success: (msg: string, opts?: ToastOpts) => toast.success(msg, { duration: 3000, ...opts }),
      info: (msg: string, opts?: ToastOpts) => toast.info(msg, { duration: 4000, ...opts }),
      warning: (msg: string, opts?: ToastOpts) => toast.warning(msg, { duration: 5000, ...opts }),
      error: (msg: string, opts?: ToastOpts) => toast.error(msg, { duration: 6000, ...opts }),
      promise: toast.promise,
    };
    ```

- `apps/web/components/ui/Banner.tsx`:
  - Banners persistentes en lugar de toasts efímeros.
  - Para situaciones que requieren atención continua (ej: "Tu suscripción expira en 2 días").
  - Variantes: info / warning / error.
  - Dismissible o persistente según prop.

### Archivos a modificar

- `apps/web/app/layout.tsx`:
  - Agregar `<Toaster />` cliente al final del body.

- Vistas que ya tenían toasts hardcoded: migrar a `showToast`.

## Catálogo canónico de toasts

### Por superficie del producto

#### Auth (`/auth/*`)

| Trigger | Tipo | Mensaje |
|---|---|---|
| Magic link enviado | success | "Te enviamos un email con tu enlace de acceso." |
| Magic link expirado | error | "Tu enlace expiró. Pide uno nuevo." |
| Login exitoso | success | "¡Bienvenido de vuelta!" |
| Logout exitoso | info | "Sesión cerrada." |
| Email duplicado en signup | error | "Este email ya tiene cuenta. ¿Quieres loguearte?" |

#### Producto B (`/partidos/[slug]`)

| Trigger | Tipo | Mensaje |
|---|---|---|
| Predicción guardada | success | "Predicción guardada. ¡Suerte! 🍀" |
| Predicción modificada | success | "Predicción actualizada." |
| Predicción cerrada (kickoff) | error | "El partido empezó. Ya no puedes modificar tu predicción." |
| Click en cuota afiliada | info | "Te llevamos a [Casa]. Buena suerte." (corto, no interrumpe) |

#### Producto C (`/comunidad/*`)

| Trigger | Tipo | Mensaje |
|---|---|---|
| Sumarse a torneo | success | "¡Estás dentro! Tu predicción cuenta para el ranking." |
| Ver perfil propio (autoview) | info | "Este es tu perfil público. Otros usuarios lo ven así." |

#### Premium (`/premium/*`)

| Trigger | Tipo | Mensaje |
|---|---|---|
| Suscripción activada (post-pago) | success | "¡Premium activo! Únete al Channel para empezar." |
| Tarjeta rechazada en checkout | error | "Tu tarjeta fue rechazada por el banco. Intenta con otra." |
| Pago en proceso (timeout) | warning | "El proceso está tardando. Recarga en 1 minuto. Si tu tarjeta fue cobrada, recibirás un email." |
| Cambio de plan exitoso | success | "Plan cambiado. Aplicará desde la próxima renovación." |
| Cancelación confirmada | info | "Suscripción cancelada. Mantienes acceso hasta {fecha}." |
| Reactivación | success | "¡Bienvenido de vuelta! Tu Premium está activo." |
| Reembolso solicitado | success | "Reembolso en proceso. Llegará a tu tarjeta en 5-10 días." |

#### Perfil (`/perfil/*`)

| Trigger | Tipo | Mensaje |
|---|---|---|
| Username cambiado | success | "Username actualizado." |
| Username no disponible | error | "Ese username ya está en uso. Prueba otro." |
| Username inválido (regex) | error | "El username solo puede tener letras, números y _ (3-20 chars)." |
| Username locked (ya completaste perfil) | error | "Tu username no se puede cambiar después de completado." |
| Preferencias notif guardadas | success | "Preferencias actualizadas." |

#### Eliminación de cuenta (`/perfil/eliminar/*`)

| Trigger | Tipo | Mensaje |
|---|---|---|
| Solicitud creada | success | "Tu solicitud está en proceso. Te enviamos un email." |
| Confirmación recibida (link en email) | success | "Cuenta eliminada. Hasta pronto." (con redirect a `/`) |

#### Errores genéricos

| Trigger | Tipo | Mensaje |
|---|---|---|
| 500 en server action | error | "Algo salió mal. Intenta de nuevo en unos segundos." |
| Network error | error | "Sin conexión. Revisa tu internet e intenta de nuevo." |
| Timeout en request | warning | "El proceso está tardando. Recarga la página si no responde." |
| Rate limit hit | warning | "Demasiadas solicitudes. Espera 1 minuto." |
| Sesión expirada | warning | "Tu sesión expiró. Vuelve a loguearte." |

#### Admin

| Trigger | Tipo | Mensaje |
|---|---|---|
| Pick aprobado y enviado | success | "Pick enviado a {N} suscriptores." |
| Pick rechazado | success | "Pick rechazado. Motivo guardado." |
| Pick editado y aprobado | success | "Pick actualizado y enviado." |
| Reembolso procesado | success | "Reembolso procesado en OpenPay." |
| Newsletter campaña enviada | success | "Campaña enviada a {N} suscriptores." |
| Premio mensual marcado pagado | success | "Premio marcado pagado. Email enviado al ganador." |
| Sync membresía completado | info | "Sync completado. {N} items procesados." |
| Cron Lighthouse disparado | info | "Lighthouse corriendo. Resultados en 1-2 minutos." |
| Acción admin destructiva (ban) | warning | "Usuario baneado. Acción registrada en auditoría." |

## Catálogo de banners (persistentes)

Banners se usan para situaciones que requieren atención continua, no efímera.

### Banners de la pista usuario

| Trigger | Tipo | Mensaje | Acción |
|---|---|---|---|
| Premium activo, sin teléfono configurado | info | "Falta tu número de WhatsApp para recibir picks 1:1" | "Agregar teléfono" → `/perfil` |
| Premium expira en <7 días | warning | "Tu Premium expira en {N} días. Renueva ahora." | "Mantener Premium" → `/premium/mi-suscripcion` |
| Premium pago fallido | error | "No pudimos procesar tu pago. Tu acceso está pausado." | "Actualizar tarjeta" → `/premium/mi-suscripcion` |
| Username no completado (post-OAuth) | warning | "Completa tu perfil para participar en Liga Habla!" | "Completar perfil" → `/auth/completar-perfil` |
| MINCETUR vencido en una casa | warning | "Esta casa perdió su licencia MINCETUR temporalmente." | "Ver casas verificadas" |

### Banners del admin

| Trigger | Tipo | Mensaje | Acción |
|---|---|---|---|
| Alarma crítica activa | error | "Conversión Click→Registro casa cayó a 18%. Posible: tracking Betano roto." | "Ver detalle" → `/admin/alarmas` |
| Cron sync membresía con items pendientes | warning | "{N} usuarios deben ser removidos del Channel manualmente." | "Ver lista" |
| Picks Premium pendientes >24h | warning | "{N} picks pendientes desde hace más de 24h." | "Validar ahora" → `/admin/picks-premium` |
| Pago de premio mensual pendiente | warning | "{N} ganadores sin datos bancarios este mes." | "Solicitar datos" → `/admin/premios-mensuales` |

## Estados de UI

### Toast (efímero)

```
┌────────────────────────────────────┐
│ ✓ Predicción guardada              │  ← success: 3s
│   ¡Suerte! 🍀                       │
└────────────────────────────────────┘

┌────────────────────────────────────┐
│ ⚠ Tu tarjeta fue rechazada         │  ← error: 6s
│   por el banco. Intenta con otra.  │
└────────────────────────────────────┘
```

### Banner (persistente)

```
┌────────────────────────────────────┐
│ ⚠ Tu Premium expira en 5 días      │
│   Renueva ahora para no perder     │
│   acceso a los picks.              │
│                       [Renovar →]  │
└────────────────────────────────────┘
```

### Stacking de toasts

Si llegan múltiples toasts en menos de 1s, se muestran apilados (max 3 visibles). Los demás esperan en cola.

```
┌────────────────────────────────────┐
│ ✓ Predicción guardada              │  ← más reciente arriba
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ ✓ Newsletter actualizado           │
└────────────────────────────────────┘
```

### Posicionamiento

- **Desktop:** bottom-right, ancho fijo 380px.
- **Mobile:** bottom-center, ancho calc(100% - 24px).

### Comportamiento clickeable

Toasts pueden tener acción opcional:

```typescript
showToast.success('Pick aprobado', {
  action: { label: 'Ver pick', onClick: () => router.push('/admin/picks-premium?id=...') }
});
```

## Componentes que reutiliza

- `sonner` (npm package — instalar `pnpm add sonner`).
- Tokens del design system (Lote A) para colores de severidad.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Tono según `tono-de-voz.spec.md`** del Paquete 7A. Persona "tú", informal-friendly.
- **Mensajes cortos.** Toast: max 60 caracteres en línea principal, max 100 caracteres total.
- **Acción correctiva opcional** en errors (botón con label corto: "Reintentar", "Cerrar", etc).
- **Auto-dismiss según severidad:** success 3s, info 4s, warning 5s, error 6s. Persistent solo si requiere acción.
- **Cero overlapping con BottomNav** en mobile (z-index correcto + offset bottom).
- **Cero overlapping con Sticky CTAs** (toasts van arriba del sticky en z-stack).
- **Accesible:** todos los toasts con `role="status"` (success/info) o `role="alert"` (warning/error). aria-live correcto.
- **Animation suave** entre estados (slide-in-right en desktop, slide-up en mobile).
- Eventos analíticos (NUEVO Lote H):
  - `toast_visto` con tipo + trigger
  - `toast_accion_clickeada` cuando user click en acción del toast

## Mockup de referencia

Sin mockup individual. Toasts visualizados implícitamente en mockups de pago/checkout.

## Pasos manuales para Gustavo post-deploy

### Instalar dependencia

Solo si Claude Code no la incluye automáticamente en el commit:

```bash
pnpm add sonner
```

**Validación post-deploy:**

1. Hacer una predicción → verificar toast "Predicción guardada".
2. Probar tarjeta rechazada en checkout → verificar toast error con tono correcto.
3. Cambiar preferencias → verificar toast success.
4. Hacer login → verificar toast "Bienvenido de vuelta".
5. En mobile: verificar que toast aparece bottom-center sin tapar BottomNav ni Sticky CTA.
6. Disparar 3+ acciones rápidas → verificar stacking correcto (max 3 visibles).
7. Como admin: aprobar pick → verificar toast con acción "Ver pick" + navegación correcta.

---

*Versión 1 · Abril 2026 · Notificaciones in-app para Lote H*
