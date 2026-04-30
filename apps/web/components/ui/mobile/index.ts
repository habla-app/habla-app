// Barrel exports — `@/components/ui/mobile` v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-mobile.md.
//
// Componentes específicos de la pista usuario, optimizados para 375px y
// experiencia de pulgar/touch. Filosofía mobile-first riguroso (≥44px touch
// targets, sticky CTAs zona pulgar, scroll horizontal sobre dropdowns,
// bottom sheets sobre modales, animaciones discretas).
//
// Estado actual del set:
// - MobileHeader: NUEVO en Lote A.
// - StickyCTABar: NUEVO en Lote A.
// - CrossProductBanner: NUEVO en Lote A.
// - BottomNav: re-export del existente en components/layout/. Refactor
//   con items v3.1 (Inicio · Partidos · Liga · Premium · Perfil) viene
//   en el Lote B.
// - HorizontalScrollChips: re-export del existente en components/ui/.
//   Move físico al Lote B junto con la reauditoría de capa pública.
//
// Componentes pendientes (vienen en Lotes B-D):
// - BottomSheet (Lote B)
// - MatchCard mobile-first (Lote B, refactor del existente)
// - HeroPartido (Lote B)
// - PickBloqueadoTeaser (Lote D — clave del modelo Premium)
// - LeaderboardPreview mobile-first (Lote B, refactor del existente)
// - PrediccionForm (Lote C)
// - AffiliateInline (Lote B)
// - NewsletterCTA refactor mobile (Lote B)
// - PWAInstallPrompt (Lote I)
// - NivelProgressBar (Lote C)
// - MisCasasConectadas (Lote C)
// - EstadoUsuarioBanner (Lote B)
export { MobileHeader } from "./MobileHeader";
export type { MobileHeaderVariant } from "./MobileHeader";

export { StickyCTABar } from "./StickyCTABar";

export { CrossProductBanner } from "./CrossProductBanner";
export type { CrossProductDirection } from "./CrossProductBanner";

export { BottomNav } from "./BottomNav";

export { HorizontalScrollChips } from "./HorizontalScrollChips";
