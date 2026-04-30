// BottomNav — re-export desde la ubicación canónica v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-mobile.md §2.
//
// El componente original vive en `components/layout/BottomNav.tsx` desde
// el Lote 3. La spec v3.1 lo mueve conceptualmente a
// `components/ui/mobile/`, pero hacer un mover físico ahora rompe los
// callers existentes (`PublicHeader`, `app/(main)/layout.tsx`, etc.) y
// debe aplicarse en el Lote B junto con la reauditoría móvil de la capa
// pública. Por ahora reexportamos para que código nuevo pueda importarlo
// desde el path canónico:
//
//   import { BottomNav } from "@/components/ui/mobile";
//
// El refactor con los 5 ítems v3.1 (Inicio · Partidos · Liga · Premium ·
// Perfil) lo aplica el Lote B. Los items actuales (Inicio · Partidos ·
// Pronósticos · Comunidad · Perfil) son del Lote 3 y siguen vigentes.
export { BottomNav } from "@/components/layout/BottomNav";
