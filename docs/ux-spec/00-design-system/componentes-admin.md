# Componentes Admin — Habla! v3.1 (Pista Desktop)

Componentes específicos de la pista admin, optimizados para 1280px+ y experiencia de mouse + teclado. Viven en `apps/web/components/ui/admin/`.

## Filosofía admin desktop

1. **Ancho base:** 1280px (laptop pequeña). Layout escala bien hasta 1920px+.
2. **Densidad alta:** maximizar información visible sin scroll innecesario.
3. **Sidebar fijo:** nunca colapsa en el rango target. Siempre visible.
4. **Atajos de teclado:** acciones frecuentes accesibles con teclado (A, R, E, /, Esc).
5. **Filtros y tablas:** primarios al admin. UX inspirado en Linear, Notion, Stripe Dashboard.
6. **Cero animaciones decorativas:** solo loading spinners, success checks, slide-down de notificaciones internas.
7. **Tooltips:** OK para iconografía y atajos. No reemplazan labels visibles cuando los labels son obligatorios.

## Inventario de componentes

### 1. `<AdminLayout>` — Layout principal

Estructura raíz de todas las páginas `/admin/*`.

```tsx
interface AdminLayoutProps {
  children: ReactNode;
}
```

```
┌──────────────────────────────────────────────────────┐
│ [Sidebar 240px]  │  Top bar 56px                     │
│                  ├───────────────────────────────────│
│                  │                                   │
│                  │  Page content                     │
│                  │  (max-w-7xl mx-auto)              │
│                  │                                   │
│                  │                                   │
└──────────────────────────────────────────────────────┘
```

- Sidebar: `w-60` (240px), full height, `bg-admin-sidebar-bg`.
- Top bar: `h-14`, breadcrumbs + acciones contextuales + avatar.
- Content: `flex-1` con padding `p-6`.
- Min screen size: si `< 1024px`, mostrar `<AdminScreenTooSmall>` ("Admin requiere pantalla más grande. Resolución mínima: 1280px").

### 2. `<AdminSidebar>` — Sidebar lateral fijo

Reemplaza completamente al `<AdminTopNav>` actual.

```tsx
interface AdminSidebarProps {
  currentPath: string;
  user: { name: string; avatarUrl?: string };
}
```

Estructura jerárquica con secciones:

```
┌────────────────────────┐
│ ⊕ Habla! Admin         │  ← Logo + nombre app
├────────────────────────┤
│                        │
│ ▸ Dashboard            │  ← Item raíz
│                        │
│ OPERACIÓN              │  ← Section label (uppercase, gris)
│ • Picks Premium    ●3  │  ← Item con counter de pendientes
│ • Channel WhatsApp     │
│ • Suscripciones        │
│ • Afiliados            │
│ • Conversiones         │
│ • Newsletter           │
│ • Premios mensuales    │
│                        │
│ ANÁLISIS               │
│ • KPIs                 │
│ • Cohortes             │
│ • Mobile Vitals        │
│ • Finanzas             │
│ • Alarmas          ●1  │
│                        │
│ CONTENIDO              │
│ • Editor MDX           │
│ • Partidos             │
│ • Casas                │
│                        │
│ SISTEMA                │
│ • Logs                 │
│ • Auditoría            │
│ • Usuarios             │
│                        │
├────────────────────────┤
│ [👤] Gustavo Q.        │  ← User profile pinned bottom
│      [Cerrar sesión]   │
└────────────────────────┘
```

**Estados:**
- Item normal: `text-admin-sidebar-text` con padding y rounded-sm en hover (`bg-admin-sidebar-hover-bg`).
- Item activo: `bg-admin-sidebar-active-bg text-admin-sidebar-active-text` con barra dorada izquierda (3px).
- Section labels: `text-admin-sidebar-section-label text-label-sm` con margin-top y margin-bottom.
- Counters: badge circular pequeño rojo/dorado con número.

### 3. `<AdminPageHeader>` — Header de página

Refactor del existente.

```tsx
interface AdminPageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: ReactNode;  // Botones contextuales (export, crear nuevo, etc.)
}
```

- Layout: title + description izquierda, actions derecha.
- Border bottom sutil para separar del contenido.
- Tipografía: `text-admin-page-title` para título.

### 4. `<KPICard>` — Card de KPI

Componente clave del dashboard de KPIs.

```tsx
interface KPICardProps {
  label: string;                          // "FTDs nuevos / mes"
  value: string | number;                 // 87
  unit?: string;                          // "FTDs" o "%" o "S/"
  trend?: {
    direction: 'up' | 'down' | 'flat';
    pct: number;
    period: string;                       // "vs mes anterior"
  };
  status: 'good' | 'amber' | 'red' | 'neutral';
  target?: { value: number; label: string };  // "Target: 90+" para mostrar progreso
  helpText?: string;                      // Tooltip explicativo
  onClick?: () => void;                   // Drill-down al detalle
}
```

**Layout:**

```
┌──────────────────────────────────────┐
│ FTDs nuevos / mes      [?]      ●    │  ← label + help + status dot
│                                      │
│ 87 FTDs                              │  ← value + unit
│                                      │
│ ↗ +12% vs mes anterior               │  ← trend
│ Target: 90+ ━━━━━━━━━━━━░░ 96%       │  ← target progress
└──────────────────────────────────────┘
```

**Status indicator:** dot circular en esquina superior derecha. `bg-status-green`, `bg-status-amber`, `bg-status-red`.

Tipografía: `text-kpi-value-lg` para el valor, `text-admin-label` para label, `text-kpi-trend` para trend.

### 5. `<KPISection>` — Agrupación de KPIs

```tsx
interface KPISectionProps {
  title: string;                          // "Captación", "Productos B y C", etc.
  description?: string;
  kpis: KPICardProps[];
  layout?: 'grid-3' | 'grid-4' | 'grid-2';
}
```

Grid responsive con KPIs según el `layout`. El dashboard principal tiene 5 secciones:
1. Captación
2. Productos B y C
3. Conversión
4. Retención
5. Económicos

Cada una con su `<KPISection>`.

### 6. `<AlarmaBanner>` — Banner persistente cuando hay KPI rojo

```tsx
interface AlarmaBannerProps {
  alarmas: {
    kpi: string;
    valorActual: string;
    umbral: string;
    accionSugerida: string;
    href: string;
  }[];
}
```

- Fixed top de la página, debajo del top bar.
- Background rojo claro `bg-status-red-bg` con border `border-status-red`.
- Si hay 1 alarma: mostrar inline. Si hay 2+, mostrar "3 alarmas activas · [Ver todas →]".

### 7. `<AdminTable>` — Tabla densa con sorting/filtering

```tsx
interface AdminTableProps<T> {
  columns: {
    key: keyof T | string;
    label: string;
    render?: (row: T) => ReactNode;
    sortable?: boolean;
    width?: string;
  }[];
  data: T[];
  loading?: boolean;
  empty?: ReactNode;            // Vista cuando data.length === 0
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onChange: (page: number) => void;
  };
  onRowClick?: (row: T) => void;
  selectedIds?: Set<string>;    // Para selección múltiple
  onSelect?: (ids: Set<string>) => void;
}
```

- Header sticky en scroll vertical.
- Columnas con sort-icons cuando `sortable`.
- Hover row: `bg-admin-table-row-hover`.
- Stripe rows (alternado): opcional vía prop.
- Tipografía: `text-admin-table-cell` para celdas, `text-admin-table-header` para headers.
- Pagination footer: paginación numerada (1, 2, 3, ..., N) + selector de pageSize (25 / 50 / 100).
- Empty state: ícono + mensaje + CTA opcional.

### 8. `<AdminFilters>` — Barra de filtros sobre tablas

```tsx
interface AdminFiltersProps {
  filters: {
    type: 'search' | 'select' | 'date-range' | 'toggle';
    key: string;
    label: string;
    options?: { value: string; label: string }[];
    value: any;
  }[];
  onChange: (key: string, value: any) => void;
  onReset?: () => void;
  rightActions?: ReactNode;  // Export CSV, etc.
}
```

- Layout: `flex gap-2 items-center flex-wrap`.
- Search input: con icono lupa, atajo `/` para focus.
- Selects: nativos.
- Date range: dos inputs date.
- Toggle: switch on/off.
- Botón "Reset" gris si hay filtros activos.

### 9. `<TwoColumnLayout>` — Layout de 2 paneles

Para vistas tipo "lista a la izquierda, detalle a la derecha". Usado en `/admin/picks-premium` (cola + detalle).

```tsx
interface TwoColumnLayoutProps {
  left: ReactNode;         // Lista
  right: ReactNode;        // Detalle
  leftWidth?: string;      // "300px" default
  resizable?: boolean;     // Drag to resize divider
}
```

- Left panel: scroll vertical independiente.
- Right panel: scroll vertical independiente.
- Divider entre paneles: 1px borde + handle visual si resizable.

### 10. `<PickValidationPanel>` — Panel de validación de picks

Específico de `/admin/picks-premium`.

```tsx
interface PickValidationPanelProps {
  pick: PickPremiumData;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  onEdit: (changes: Partial<PickPremiumData>) => Promise<void>;
}
```

Layout vertical:
1. Header: ID del pick + timestamp generación.
2. Partido: equipos + liga + fecha.
3. Recomendación: mercado + cuota sugerida + casa con mejor cuota.
4. Stake sugerido + EV+ calculado.
5. Razonamiento estadístico (multiline).
6. Datos crudos: H2H, forma reciente, % por mercado.
7. **Bottom actions sticky:**
   - `[A] Aprobar` (verde, `<Button variant="gold">`).
   - `[R] Rechazar` (rojo, `<Button variant="danger">`).
   - `[E] Editar` (gris, `<Button variant="outline">`).

**Atajos de teclado:**
- `A`: aprobar.
- `R`: rechazar (abre confirm dialog).
- `E`: editar (abre modo edición inline).
- `Esc`: cerrar editor.
- `↑/↓`: navegar entre picks de la cola.

### 11. `<ChannelMembershipTable>`

Tabla específica para `/admin/channel-premium`.

Columnas:
- Email del usuario
- Estado de suscripción (activa/cancelada/vencida)
- Fecha unión al Channel
- Última reacción (timestamp)
- Status de sync (✓ sincronizado / ⚠ leak detectado)
- Acciones (banear, re-invitar)

### 12. `<CohorteRetentionChart>`

```tsx
interface CohorteRetentionChartProps {
  cohortes: {
    label: string;          // "May 2026"
    cohortSize: number;     // 1247
    retention: number[];    // % por mes [100, 67, 45, 32, ...]
  }[];
}
```

Heatmap clásico de retention curve. Color escala verde (alta retención) → rojo (baja).

### 13. `<MobileVitalsChart>`

Serie temporal de Lighthouse Mobile + LCP/INP/CLS por vista crítica.

```tsx
interface MobileVitalsChartProps {
  metric: 'lighthouse' | 'lcp' | 'inp' | 'cls';
  series: {
    url: string;
    points: { date: Date; value: number }[];
  }[];
  threshold?: { good: number; poor: number };  // Para colorear
}
```

Línea por URL. Bandas de fondo: verde (good), amber (needs work), rojo (poor) según threshold.

### 14. `<DateRangePicker>`

Selector de rango de fechas con presets.

Presets: Hoy / Ayer / Últimos 7 días / Últimos 30 días / Este mes / Mes pasado / Custom.

### 15. `<AdminToast>` — Notificaciones internas

Mismo `<Toast>` base pero con tono más sobrio (sin emojis, copy directo).

```tsx
adminToast.success('Pick aprobado y enviado al Channel');
adminToast.error('Falló la sincronización con Meta');
```

### 16. `<EmptyState>` — Estado vacío

Cuando una tabla/lista no tiene datos.

```tsx
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

### 17. `<ConfirmDialog>` — Confirmación para acciones destructivas

```tsx
interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;        // Default "Confirmar"
  confirmVariant?: 'danger' | 'gold';
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}
```

- Modal centered (mismo `<Modal>` base).
- Botón confirmar a la derecha, cancel a la izquierda.

### 18. `<ExportCSVButton>`

```tsx
interface ExportCSVButtonProps {
  onExport: () => Promise<{ filename: string; data: string }>;
  disabled?: boolean;
}
```

- Genera CSV en cliente desde data ya cargada.
- Trigger nativo de download.

## Reglas de uso admin

1. **Una sola vista por ruta.** Cada `/admin/*` es una vista separada con su `<AdminPageHeader>`. No hay tabs anidados que cambien la URL implícitamente.
2. **Sticky elements:** sidebar (siempre), top bar (siempre), `<AlarmaBanner>` (cuando hay rojo). Tablas con header sticky cuando data > 20 filas.
3. **Atajos de teclado:** documentar siempre con tooltip o leyenda visible. `?` muestra modal con todos los atajos disponibles en la vista actual.
4. **Loading skeleton, no spinners centrados.** Misma regla que mobile.
5. **Tablas paginadas server-side.** Si data > 100 filas, paginación obligatoria con queries server-side. `pageSize` default 50.
6. **Acciones destructivas con `<ConfirmDialog>`.** Eliminar afiliado, cancelar suscripción, banear miembro, etc.
7. **Cero animaciones decorativas.** Solo `fade-in` para feedback de save/load. `slide-down` para toasts.

## Atajos globales (admin)

| Atajo | Acción |
|---|---|
| `/` | Focus en barra de búsqueda principal de la vista |
| `?` | Abre modal de atajos disponibles |
| `g` luego `d` | Ir a Dashboard |
| `g` luego `p` | Ir a Picks Premium |
| `g` luego `a` | Ir a Afiliados |
| `Esc` | Cierra modales/drawers/edición inline |

## Mapeo a archivos del repo

```
apps/web/components/ui/admin/
├── AdminLayout.tsx           ← reemplaza app/admin/layout.tsx (parcial)
├── AdminSidebar.tsx          ← NUEVO (reemplaza AdminTopNav)
├── AdminPageHeader.tsx       ← refactor del existente
├── AdminScreenTooSmall.tsx   ← NUEVO (mensaje resolución pequeña)
├── KPICard.tsx               ← NUEVO
├── KPISection.tsx            ← NUEVO
├── AlarmaBanner.tsx          ← NUEVO
├── AdminTable.tsx            ← NUEVO (genérico, reusable)
├── AdminFilters.tsx          ← refactor de filtros existentes
├── TwoColumnLayout.tsx       ← NUEVO
├── PickValidationPanel.tsx   ← NUEVO
├── ChannelMembershipTable.tsx ← NUEVO
├── CohorteRetentionChart.tsx ← NUEVO (Recharts o D3)
├── MobileVitalsChart.tsx     ← NUEVO
├── DateRangePicker.tsx       ← NUEVO
├── AdminToast.tsx            ← variante de Toast base
├── EmptyState.tsx            ← NUEVO
├── ConfirmDialog.tsx         ← NUEVO (basado en Modal)
└── ExportCSVButton.tsx       ← NUEVO
```

**Componentes existentes a descartar tras Lote F:**
- `apps/web/components/admin/AdminTopNav.tsx` → reemplazado por `AdminSidebar`.

**Componentes existentes a refactorar en F:**
- `apps/web/components/admin/AdminPageHeader.tsx` → adaptar al nuevo layout.
- `apps/web/components/admin/LogsTable.tsx`, `LogsFiltros.tsx` → usar `AdminTable` y `AdminFilters` genéricos.
- `apps/web/components/admin/ConversionesFiltros.tsx` → usar `AdminFilters`.
- `apps/web/components/admin/DashboardRangoSelector.tsx` → usar `DateRangePicker`.

---

*Versión 1 · Abril 2026 · Componentes admin para Lotes F-G*
