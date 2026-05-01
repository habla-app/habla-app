// Barrel exports — `@/components/ui/admin` v3.1 (Lote F).
// Spec: docs/ux-spec/00-design-system/componentes-admin.md.
//
// Filosofía admin: 1280px+, densidad alta, sidebar fijo nunca colapsa,
// atajos de teclado, cero animaciones decorativas. Mobile bloqueado vía
// <MobileGuard>.
//
// Estado del Lote F:
// - AdminLayoutShell: shell client que combina sidebar + main + MobileGuard.
//   Cableado en `app/admin/layout.tsx`.
// - AdminSidebar / AdminTopbar / AdminCard / AdminTable / KbdHint:
//   componentes funcionales y usados en cada `/admin/*` del Lote F.
// - MobileGuard: 1280px breakpoint hardcodeado para regla 13 del CLAUDE.md.
//
// Componentes pendientes para Lote G:
// - KPICard / KPISection / AlarmaBanner: viven en components/admin/dashboard
//   pero aún no se promueven a la API genérica (esperan Lote G).
// - CohorteRetentionChart / MobileVitalsChart / DateRangePicker / EmptyState
//   / ConfirmDialog / ExportCSVButton: Lote G.
export { MobileGuard } from "./MobileGuard";

export { AdminSidebar } from "./AdminSidebar";
export type { AdminSidebarItem, AdminSidebarSection } from "./AdminSidebar";

export { AdminTopbar } from "./AdminTopbar";

export { AdminCard } from "./AdminCard";

export { AdminTable } from "./AdminTable";
export type { AdminTableColumn } from "./AdminTable";

export { KbdHint } from "./KbdHint";

export { AdminLayoutShell } from "./AdminLayoutShell";
export type {
  AdminLayoutCounters,
  AdminLayoutUser,
} from "./AdminLayoutShell";
