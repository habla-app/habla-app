// Barrel exports — `@/components/ui/premium` (Lote D).
//
// Componentes expuestos:
//   - <PickWrapper>: wrapper inteligente; el resto del código consume éste.
//   - <PickBloqueadoTeaser>: detalle de implementación del wrapper (export
//     por si vista necesita el render bloqueado forzado, ej. testimonios).
//   - <PickDesbloqueado>: idem (raro, normalmente solo via wrapper).
//   - <WhatsAppChannelMockup>: visual decorativo de la landing /premium.
//   - <PlanesPremium>: selector de planes de la landing.

export { PickWrapper } from "./PickWrapper";
export type { PickWrapperData, PickWrapperMode } from "./PickWrapper";
export { PickBloqueadoTeaser } from "./PickBloqueadoTeaser";
export { PickDesbloqueado } from "./PickDesbloqueado";
export { WhatsAppChannelMockup } from "./WhatsAppChannelMockup";
export { PlanesPremium } from "./PlanesPremium";
