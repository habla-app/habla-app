// Barrel exports — `@/components/ui/admin` v3.1 (Lote A, preview). Spec:
// docs/ux-spec/00-design-system/componentes-admin.md.
//
// Filosofía admin: 1280px+, densidad alta, sidebar fijo nunca colapsa,
// atajos teclado, cero animaciones decorativas. Mobile bloqueado vía
// <MobileGuard>.
//
// Estado del Lote A:
// - MobileGuard: NUEVO, funcional (cliente).
// - AdminSidebar: NUEVO, preview funcional con tokens admin-*. Cableo a
//   `app/admin/layout.tsx` se aplica en Lote F (reemplaza AdminTopNav).
// - AdminTopbar: NUEVO, alternativa v3.1 a AdminPageHeader (Lote 7) que
//   usa tokens admin-*. Migración de callers en Lote F.
// - AdminCard: NUEVO, wrapper card con título + actions.
// - AdminTable: NUEVO, tabla genérica con loading skeletons y empty state.
//
// Pendientes (Lotes F-G):
// - AdminLayout (composición de AdminSidebar + topbar) — Lote F
// - KPICard / KPISection — Lote G
// - AlarmaBanner — Lote G
// - AdminFilters — refactor de filtros existentes en Lote F
// - TwoColumnLayout — Lote F
// - PickValidationPanel — Lote F (pista crítica picks Premium)
// - ChannelMembershipTable — Lote F
// - CohorteRetentionChart / MobileVitalsChart — Lote G
// - DateRangePicker — Lote F
// - AdminToast — Lote F (variante de Toast base)
// - EmptyState — Lote F
// - ConfirmDialog — Lote F (basado en Modal existente)
// - ExportCSVButton — Lote F/G
export { MobileGuard } from "./MobileGuard";

export { AdminSidebar } from "./AdminSidebar";
export type { AdminSidebarItem, AdminSidebarSection } from "./AdminSidebar";

export { AdminTopbar } from "./AdminTopbar";

export { AdminCard } from "./AdminCard";

export { AdminTable } from "./AdminTable";
export type { AdminTableColumn } from "./AdminTable";
