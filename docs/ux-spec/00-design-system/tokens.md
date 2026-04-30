# Tokens — Habla! v3.1

Especificación completa de los tokens de diseño del sistema v3.1. Este archivo es lo primero que lee Claude Code cuando ejecuta el Lote A.

## Cómo aplicar este archivo

1. Claude Code abre `apps/web/tailwind.config.ts` y `apps/web/app/globals.css`.
2. Compara las secciones existentes contra las definidas aquí.
3. **Conserva** todo lo existente que aparece en este archivo como "✅ Existe — sin cambios".
4. **Agrega** las secciones marcadas como "⭐ Nuevo".
5. **Modifica** las secciones marcadas como "🔧 Extender".

Tokens duplicados entre `globals.css` y `tailwind.config.ts` deben mantenerse sincronizados manualmente. Cuando se agrega un token, va en ambos lugares.

---

## 1. Paleta de marca (✅ existe — sin cambios)

Definida en el repo actual. Conservar tal cual.

```css
/* globals.css :root */
--blue-dark: #001050;
--blue-mid: #0038B8;
--blue-main: #0052CC;
--blue-light: #1A6EFF;
--blue-pale: #0A2080;
--gold: #FFB800;
--gold-dim: rgba(255, 184, 0, 0.15);
--gold-light: #FFD060;
--gold-dark: #8B6200;
```

```ts
// tailwind.config.ts theme.extend.colors
brand: {
  "blue-dark": "#001050",
  "blue-mid": "#0038B8",
  "blue-main": "#0052CC",
  "blue-light": "#1A6EFF",
  "blue-pale": "#0A2080",
  gold: "#FFB800",
  "gold-dim": "rgba(255, 184, 0, 0.15)",
  "gold-light": "#FFD060",
  "gold-dark": "#8B6200",
  green: "#00D68F",
  orange: "#FF7A00",
}
```

## 2. Tokens semánticos (✅ existe — sin cambios)

```css
/* Backgrounds */
--bg-page: #F5F7FC;
--bg-app: #FFFFFF;
--bg-card: #FFFFFF;
--bg-subtle: #F1F4FB;
--bg-hover: rgba(0, 16, 80, 0.04);

/* Text */
--text-dark: #001050;
--text-body: rgba(0, 16, 80, 0.85);
--text-muted-d: rgba(0, 16, 80, 0.58);
--text-soft: rgba(0, 16, 80, 0.42);

/* Borders */
--border-light: rgba(0, 16, 80, 0.08);
--border-strong: rgba(0, 16, 80, 0.16);
```

## 3. Urgent / Accent / Pred / Medal (✅ existe — sin cambios)

Mantener tal cual están en `tailwind.config.ts` actual. Cubren countdown badges, tipos de torneo, chips de predicciones y posiciones del leaderboard.

## 4. Alert (🔧 extender)

Estado actual: `alert-info-*` y `alert-success-*` ya existen.

**Agregar:**

```css
/* globals.css :root */
--alert-warning-bg: #FFF7E6;
--alert-warning-border: #FFD060;
--alert-warning-text: #92400E;

--alert-danger-bg: #FFE5E5;
--alert-danger-border: #FFB0B0;
--alert-danger-text: #991B1B;
```

```ts
// tailwind.config.ts theme.extend.colors.alert (extender objeto existente)
alert: {
  "info-bg": "#E0EBFF",
  "info-border": "#B8CAFF",
  "info-text": "#1D3F8E",
  "success-bg": "#D1FAE5",
  "success-border": "#A6E7C5",
  "success-text": "#065F46",
  // NUEVO
  "warning-bg": "#FFF7E6",
  "warning-border": "#FFD060",
  "warning-text": "#92400E",
  "danger-bg": "#FFE5E5",
  "danger-border": "#FFB0B0",
  "danger-text": "#991B1B",
}
```

## 5. Premium (⭐ nuevo — agregar completo)

Tokens para vistas Premium (landing, checkout, pick bloqueado, mockup WhatsApp, etc.).

```css
/* globals.css :root */
--premium-surface: #0a0e25;        /* Card oscura premium */
--premium-surface-2: #1a1f3a;      /* Variant ligeramente más clara */
--premium-border: rgba(255, 184, 0, 0.3);
--premium-border-soft: rgba(255, 184, 0, 0.15);
--premium-text-on-dark: #FFFFFF;
--premium-text-muted-on-dark: rgba(255, 255, 255, 0.7);
--premium-text-soft-on-dark: rgba(255, 255, 255, 0.45);
--premium-lock-overlay: linear-gradient(180deg, transparent 0%, rgba(10, 14, 37, 0.95) 90%);
--premium-watermark: rgba(255, 255, 255, 0.06);
--premium-blur-content: rgba(255, 255, 255, 0.04);
```

```ts
// tailwind.config.ts theme.extend.colors
premium: {
  surface: "#0a0e25",
  "surface-2": "#1a1f3a",
  border: "rgba(255, 184, 0, 0.3)",
  "border-soft": "rgba(255, 184, 0, 0.15)",
  "text-on-dark": "#FFFFFF",
  "text-muted-on-dark": "rgba(255, 255, 255, 0.7)",
  "text-soft-on-dark": "rgba(255, 255, 255, 0.45)",
  watermark: "rgba(255, 255, 255, 0.06)",
  "blur-content": "rgba(255, 255, 255, 0.04)",
}
```

```ts
// theme.extend.backgroundImage (agregar)
"premium-card-gradient":
  "linear-gradient(135deg, #0a0e25 0%, #1a1f3a 100%)",
"premium-hero-gradient":
  "radial-gradient(circle at 80% 0%, rgba(37,211,102,0.15) 0%, transparent 50%), linear-gradient(180deg, #0a0e25 0%, #1a1f3a 100%)",
"premium-lock-overlay":
  "linear-gradient(180deg, transparent 0%, rgba(10, 14, 37, 0.95) 90%)",
"gold-soft-glow":
  "radial-gradient(circle at 50% 50%, rgba(255, 184, 0, 0.15) 0%, transparent 70%)",
```

```ts
// theme.extend.boxShadow (agregar)
"premium-card": "0 12px 40px rgba(10, 14, 37, 0.5), 0 0 0 1px rgba(255, 184, 0, 0.1) inset",
"premium-cta": "0 8px 24px rgba(255, 184, 0, 0.4)",
"premium-locked": "inset 0 0 60px rgba(0, 0, 0, 0.3)",
```

## 6. Admin desktop (⭐ nuevo — agregar completo)

Tokens para vistas administrativas. Densidad mayor, sin animaciones decorativas.

```css
/* globals.css :root */
--admin-sidebar-bg: #001050;
--admin-sidebar-text: rgba(255, 255, 255, 0.85);
--admin-sidebar-text-muted: rgba(255, 255, 255, 0.55);
--admin-sidebar-active-bg: rgba(255, 184, 0, 0.15);
--admin-sidebar-active-text: #FFB800;
--admin-sidebar-hover-bg: rgba(255, 255, 255, 0.05);
--admin-sidebar-section-label: rgba(255, 255, 255, 0.4);
--admin-sidebar-divider: rgba(255, 255, 255, 0.08);

--admin-content-bg: #F5F7FC;
--admin-card-bg: #FFFFFF;
--admin-table-row-hover: #F1F4FB;
--admin-table-row-stripe: #F8FAFD;
--admin-table-border: rgba(0, 16, 80, 0.06);

/* Status semaphore — usado por KPIs, alarmas, sync states */
--status-green: #00D68F;
--status-green-bg: #D1FAE5;
--status-green-text: #065F46;
--status-amber: #F59E0B;
--status-amber-bg: #FEF3C7;
--status-amber-text: #92400E;
--status-red: #EF4444;
--status-red-bg: #FEE2E2;
--status-red-text: #991B1B;
--status-neutral-bg: #F3F4F6;
--status-neutral-text: #6B7280;
```

```ts
// tailwind.config.ts theme.extend.colors
admin: {
  "sidebar-bg": "#001050",
  "sidebar-text": "rgba(255, 255, 255, 0.85)",
  "sidebar-text-muted": "rgba(255, 255, 255, 0.55)",
  "sidebar-active-bg": "rgba(255, 184, 0, 0.15)",
  "sidebar-active-text": "#FFB800",
  "sidebar-hover-bg": "rgba(255, 255, 255, 0.05)",
  "sidebar-section-label": "rgba(255, 255, 255, 0.4)",
  "sidebar-divider": "rgba(255, 255, 255, 0.08)",
  "content-bg": "#F5F7FC",
  "card-bg": "#FFFFFF",
  "table-row-hover": "#F1F4FB",
  "table-row-stripe": "#F8FAFD",
  "table-border": "rgba(0, 16, 80, 0.06)",
},
status: {
  green: "#00D68F",
  "green-bg": "#D1FAE5",
  "green-text": "#065F46",
  amber: "#F59E0B",
  "amber-bg": "#FEF3C7",
  "amber-text": "#92400E",
  red: "#EF4444",
  "red-bg": "#FEE2E2",
  "red-text": "#991B1B",
  "neutral-bg": "#F3F4F6",
  "neutral-text": "#6B7280",
}
```

## 7. WhatsApp (⭐ nuevo — agregar completo)

Tokens para componentes que visualizan WhatsApp Channel/Business (mockup en Premium landing, badge "Activo en WhatsApp", etc.).

```css
/* globals.css :root */
--whatsapp-green: #25D366;
--whatsapp-green-dark: #128C7E;
--whatsapp-green-darker: #075E54;
--whatsapp-chat-bg: #ECE5DD;
--whatsapp-chat-bubble: #FFFFFF;
--whatsapp-chat-meta: #888888;
--whatsapp-check-blue: #4FC3F7;
```

```ts
// tailwind.config.ts theme.extend.colors
whatsapp: {
  green: "#25D366",
  "green-dark": "#128C7E",
  "green-darker": "#075E54",
  "chat-bg": "#ECE5DD",
  "chat-bubble": "#FFFFFF",
  "chat-meta": "#888888",
  "check-blue": "#4FC3F7",
}
```

```ts
// theme.extend.backgroundImage (agregar)
"whatsapp-chat-pattern":
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M0 0h100v100H0z' fill='%23ECE5DD'/%3E%3Cpath d='M20 20l5 5M40 60l5 5M70 30l5 5M30 80l5 5' stroke='%23DDD7CB' stroke-width='1.5'/%3E%3C/svg%3E\")",
```

## 8. Mobile vitals (⭐ nuevo — para dashboard admin de Lighthouse)

```css
/* globals.css :root */
--vital-good: #00D68F;        /* score >= 90 / LCP <= 2.5s */
--vital-needs-work: #F59E0B;  /* score 50-89 / LCP 2.5-4s */
--vital-poor: #EF4444;        /* score < 50 / LCP > 4s */
```

```ts
// tailwind.config.ts theme.extend.colors
vital: {
  good: "#00D68F",
  "needs-work": "#F59E0B",
  poor: "#EF4444",
}
```

## 9. Spacing y rounded (✅ existe — sin cambios)

```ts
// tailwind.config.ts theme.extend.borderRadius
borderRadius: {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
}
```

Spacing usa la escala default de Tailwind (4px base). El sistema oficial es:

```
0.5 → 2px    1 → 4px      1.5 → 6px
2 → 8px      3 → 12px     4 → 16px
5 → 20px     6 → 24px     8 → 32px
10 → 40px    12 → 48px    16 → 64px
```

Mobile usa preferentemente: 2, 3, 4, 5, 6 (8px–24px).
Admin desktop usa preferentemente: 1, 2, 3, 4, 6, 8 (4px–32px) para mayor densidad.

## 10. Shadows (🔧 extender ligeramente)

Conservar todas las existentes. Agregar 3 nuevas para Premium y admin (ya listadas arriba en sus secciones respectivas):

- `shadow-premium-card`
- `shadow-premium-cta`
- `shadow-premium-locked`

## 11. Animaciones (✅ existe — sin cambios)

El sistema actual de animaciones (`pulse`, `pulse-dot`, `pulse-border`, `shimmer`, `scale-in`, `shake`, `slide-down`, `fade-in`, `live-pulse-bg`, `toast-in`) está bien dimensionado.

**Regla nueva en v3.1:** las páginas en `app/admin/*` NO usan estas animaciones excepto `fade-in` y `slide-down` para feedback de submit/save. Resto se reserva a pista usuario.

## 12. Z-index (⭐ nuevo — codificar la jerarquía)

Agregar a `tailwind.config.ts`:

```ts
// theme.extend.zIndex
zIndex: {
  "base": "0",
  "dropdown": "10",
  "sticky": "20",        // Sticky CTAs en mobile
  "header": "30",        // Header fijo
  "sidebar": "40",       // Admin sidebar
  "drawer": "50",        // Bottom sheet mobile
  "modal-backdrop": "60",
  "modal": "70",
  "toast": "80",
  "tooltip": "90",
}
```

Esto reemplaza valores ad-hoc (`z-50`, `z-[100]`) que pueden estar dispersos.

## 13. Breakpoints (✅ existe — documentar uso)

Tailwind defaults se usan tal cual:

```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

**Convención v3.1:**
- Pista usuario: diseñar a 375px primero, ajustar a `sm`/`md` solo si tiene sentido. Las vistas más grandes (`lg`/`xl`) deben verse correctamente pero sin trabajo intencional de mobile-first hacia arriba.
- Pista admin: diseñar a 1280px (`xl`) primero. Soportar `lg` (laptop). En `md` o menor, mostrar mensaje "Admin requiere pantalla más grande" en lugar de adaptar — el operador admin opera siempre desde desktop según restricción del proyecto.

## 14. CSS-only utilities reservadas

Estas clases utilitarias se definen en `apps/web/app/globals.css` dentro de `@layer utilities` cuando no se pueden expresar con tokens Tailwind:

```css
@layer utilities {
  /* Scroll horizontal sin scrollbar (ya común en mobile) */
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }

  /* Gradiente WhatsApp para fondo de chat */
  .bg-whatsapp-chat {
    background-color: var(--whatsapp-chat-bg);
    background-image: url("...pattern...");
  }

  /* Touch target mínimo mobile */
  .touch-target {
    min-height: 44px;
    min-width: 44px;
  }

  /* Premium watermark — para overlay con email del usuario en picks */
  .premium-watermark {
    color: var(--premium-watermark);
    font-size: 8px;
    letter-spacing: 0.05em;
  }
}
```

## 15. Resumen del trabajo del Lote A

Cuando Claude Code ejecute el Lote A, debe producir estos cambios concretos:

### Archivos a modificar

- `apps/web/tailwind.config.ts`
  - **Extender** `theme.extend.colors`: agregar bloques `premium`, `admin`, `status`, `whatsapp`, `vital`. Extender `alert` con warning y danger.
  - **Agregar** `theme.extend.zIndex` completo.
  - **Agregar** entradas en `backgroundImage`: `premium-card-gradient`, `premium-hero-gradient`, `premium-lock-overlay`, `gold-soft-glow`, `whatsapp-chat-pattern`.
  - **Agregar** entradas en `boxShadow`: `premium-card`, `premium-cta`, `premium-locked`.

- `apps/web/app/globals.css`
  - **Agregar** las variables CSS nuevas dentro de `:root` siguiendo este archivo, en el orden correspondiente a cada sección.
  - **Agregar** el `@layer utilities` con `scrollbar-hide`, `bg-whatsapp-chat`, `touch-target`, `premium-watermark`.

### Archivos a crear

- `apps/web/components/ui/mobile/` (carpeta nueva, vacía por ahora — Lote A solo prepara estructura).
- `apps/web/components/ui/admin/` (carpeta nueva, vacía por ahora).
- `apps/web/components/ui/premium/` (carpeta nueva, vacía por ahora).

### Archivos a NO tocar

- `apps/web/app/layout.tsx` (las fuentes `next/font` ya están bien configuradas).
- Cualquier componente existente. El Lote A solo extiende tokens; el uso real ocurre en B-J.

### Verificación post-lote

Claude Code corre `pnpm tsc --noEmit` y `pnpm lint` para confirmar que no hay regresión. No corre nada más.

---

*Versión 1 · Abril 2026 · Tokens base para Lote A*
