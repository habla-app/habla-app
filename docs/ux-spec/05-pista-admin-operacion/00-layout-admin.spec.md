# Layout admin desktop

Spec base de los componentes de layout del panel admin: sidebar lateral, topbar, page header, cards. Esta spec se implementa **antes** que cualquier vista admin individual porque todas dependen.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

- `apps/web/app/admin/layout.tsx` (Lote 5.1): layout con auth check + `<AdminTopNav>` horizontal + main centrado.
- `apps/web/components/admin/AdminTopNav.tsx` (Lote 5.1): nav horizontal con links a `/admin/dashboard`, `/admin/leaderboard`, `/admin/torneos`, etc.
- `apps/web/components/admin/AdminPageHeader.tsx` (Lote 5.1): header de página con title + descripción.
- Auth: `auth()` valida session + rol `ADMIN` en el layout. Defensa en profundidad sobre middleware.

## Cambios necesarios

### Decisión arquitectónica

**Reemplazo completo del topbar horizontal por sidebar lateral fijo.** Razones:

- En v3.1 admin tiene 15+ vistas (vs 6 del Lote 5.1). Un topbar horizontal se llena.
- Sidebar permite agrupar por sección (Operación / Análisis / Contenido / Sistema).
- Sidebar permite indicadores numéricos (badges con counts: "Picks pendientes: 3").
- Topbar simplificado queda para breadcrumbs + actions contextuales (botones específicos de la vista).

### Archivos a modificar

- `apps/web/app/admin/layout.tsx`:
  - Mantener auth check (sin cambios de seguridad).
  - Cambiar shell: ahora es `<div class="grid grid-cols-[240px_1fr]">` con `<AdminSidebar>` a la izquierda + `<main>` a la derecha.
  - Agregar guard mobile: si `window.innerWidth < 1280` mostrar mensaje "Panel admin requiere pantalla ≥ 1280px" con sugerencia de usar laptop o tablet horizontal.

- `apps/web/components/admin/AdminPageHeader.tsx`:
  - Refactor visual: title + descripción + actions slot (props `actions?: ReactNode`).
  - Tokens admin: `text-admin-page-title`, `text-admin-page-desc`.

### Archivos a crear

- `apps/web/components/admin/AdminSidebar.tsx`:
  - Sidebar fijo 240px con logo arriba + nav agrupado + user info abajo.
  - Estructura:
    ```
    ┌──────────────┐
    │ Logo Habla!  │
    │ Admin        │
    ├──────────────┤
    │ ▸ Dashboard  │
    │              │
    │ OPERACIÓN    │
    │  Picks Prem. │ [3]
    │  Channel WA  │
    │  Suscripcio. │
    │  Afiliados   │
    │  Conversio.  │
    │  Newsletter  │
    │  Premios mes │
    │              │
    │ ANÁLISIS     │
    │  KPIs        │
    │  Cohortes    │
    │  Mobile Vit. │
    │  Finanzas    │
    │  Alarmas     │ [1]
    │              │
    │ CONTENIDO    │
    │  Editor MDX  │
    │  Partidos    │
    │  Casas       │
    │              │
    │ SISTEMA      │
    │  Logs        │
    │  Auditoría   │
    │  Usuarios    │
    ├──────────────┤
    │ [Avatar] GQ  │
    │ Cerrar sesión│
    └──────────────┘
    ```
  - Cada item: icono + label + counter opcional.
  - Active state con `bg-admin-sidebar-active-bg` + barra dorada izquierda 3px.
  - Hover state `bg-admin-sidebar-hover-bg`.
  - Counter rojo (`bg-status-red`) para items que requieren atención (picks pendientes, alarmas activas).

- `apps/web/components/admin/AdminTopbar.tsx`:
  - Topbar 56px alto blanco con border bottom.
  - Breadcrumb a la izquierda: "Operación · **Picks Premium**".
  - Actions slot a la derecha: botones específicos de la vista.

- `apps/web/components/admin/MobileGuard.tsx`:
  - Componente client-side que detecta `window.innerWidth < 1280`.
  - Renderiza mensaje "Panel admin requiere pantalla ≥ 1280px. Usa laptop o tablet horizontal."
  - Si ≥1280 → renderiza `children`.

- `apps/web/components/admin/AdminCard.tsx`:
  - Card admin estándar: padding 16px, border `border-admin-table-border`, radius `var(--r-md)`, fondo `bg-admin-card-bg` blanco.
  - Variantes: `default`, `elevated`, `urgent` (border rojo si requiere atención).

- `apps/web/components/admin/AdminTable.tsx`:
  - Tabla densa estilo admin: cabecera con bg-subtle, filas con hover `bg-admin-table-row-hover`, separador `border-admin-table-border`.
  - Soporta sort por columna (click en header).
  - Soporta paginación numérica al pie.
  - Soporta selección múltiple con checkbox (para acciones masivas tipo "aprobar 5 picks").

- `apps/web/components/admin/KbdHint.tsx`:
  - Indicador visual de atajo de teclado: `[A]` con bg-subtle + border.
  - Reusable en topbar y en botones de acciones.

### Archivos a eliminar

- `apps/web/components/admin/AdminTopNav.tsx`: reemplazado por `<AdminSidebar>` + `<AdminTopbar>`.

## Datos requeridos

### Para AdminSidebar:

```typescript
// El sidebar carga counts en server component padre (AdminLayout)
const [picksPendientes, alarmasActivas] = await Promise.all([
  prisma.pickPremium.count({ where: { estado: 'PENDIENTE' } }),
  prisma.alarma.count({ where: { activa: true } }),
]);

return (
  <AdminLayoutShell>
    <AdminSidebar
      counters={{
        picksPendientes,
        alarmasActivas,
      }}
      currentPath={pathname}
    />
    {children}
  </AdminLayoutShell>
);
```

### Para AdminTopbar:

Recibe `breadcrumb: string[]` y `actions?: ReactNode` como props desde la vista que lo invoca.

## Estados de UI

### Estados del sidebar

- **Default**: items inactivos en color sutil, item activo en dorado con barra izquierda.
- **Counter activo**: items con count > 0 muestran badge rojo a la derecha del label.
- **Hover**: bg-admin-sidebar-hover-bg.
- **Active**: bg-admin-sidebar-active-bg + barra dorada izquierda + texto dorado.

### Estados del topbar

- **Default**: breadcrumb + sin actions.
- **Con actions**: breadcrumb + 1-3 botones a la derecha.
- **Con shortcut hints**: chip de atajos (ej: "Atajos: [A] Aprobar [R] Rechazar [E] Editar").

### Estado mobile guard

Si `window.innerWidth < 1280`:
```
┌──────────────────────────────────┐
│  ⚠ Panel admin requiere pantalla │
│     ≥ 1280px                     │
│                                  │
│  Usa laptop o tablet horizontal. │
│                                  │
│  [Cerrar sesión]                 │
└──────────────────────────────────┘
```

## Componentes que reutiliza

- `<Avatar>` del design system base.
- `<Badge>` para counters.
- Tokens admin del Lote A (`tokens.md` sección admin).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **Desktop-only.** Optimizado 1280px+.
- Sidebar fijo 240px de ancho. Main fluido con max-width opcional por vista (la de KPIs puede ser ancho completo, la de validar picks puede limitarse).
- Touch targets no aplican (es desktop con mouse).
- Cero hex hardcodeados — usar tokens admin.
- Si layout breakpoint <1280: mostrar `<MobileGuard>`.

## Mockup de referencia

`00-design-system/mockup-actualizado.html` sección "08 · Pista admin · Dashboard de KPIs" muestra:

- AdminSidebar con todos los items y sus counters.
- AdminTopbar con breadcrumb y atajos.
- AdminCard con KPIs.
- AdminTable patrón visual (en sección 09).

`00-design-system/mockup-actualizado.html` sección "09 · Pista admin · Validar picks Premium" muestra el layout de 2 paneles (cola + detalle) que se reusa en `picks-premium.spec.md`.

## Pasos manuales para Gustavo post-deploy

Ninguno. Es código frontend puro.

**Validación post-deploy:**
1. Logueado como ADMIN, abrir `hablaplay.com/admin/dashboard` desde laptop.
2. Verificar sidebar lateral fijo con secciones agrupadas.
3. Verificar counters (Picks pendientes, Alarmas activas) si tienen items.
4. Click en cada item del sidebar → navega correctamente, item activo destacado.
5. Probar desde mobile o resize <1280px → mostrar `<MobileGuard>` con mensaje.

---

*Versión 1 · Abril 2026 · Layout admin para Lote F*
