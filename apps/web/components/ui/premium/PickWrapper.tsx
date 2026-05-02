// PickWrapper — wrapper inteligente que decide qué renderizar (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/pick-bloqueado.spec.md.
//
// El componente que el resto del código consume. `<PickBloqueadoTeaser>` y
// `<PickDesbloqueado>` son detalles de implementación.
//
// Responsabilidades:
//   - Si el user es Premium → renderiza `<PickDesbloqueado>` con todo
//     visible + watermark email.
//   - Si NO Premium → renderiza `<PickBloqueadoTeaser>` con copy adaptativo
//     según estado (anonimo/free/ftd).
//   - Si `pick === null` → fallback "Próximamente" en `<PickBloqueadoTeaser>`.
//
// El componente se queda como server-friendly por arriba (no hay `'use
// client'` aquí); las partes interactivas (tracking IntersectionObserver,
// click handler) viven en `<PickBloqueadoTeaser>` que sí es client.

import { PickBloqueadoTeaser } from "./PickBloqueadoTeaser";
import { PickDesbloqueado } from "./PickDesbloqueado";
import { copyVariantFromEstado, type PickWrapperProps } from "./types";

export function PickWrapper({
  pick,
  estadoUsuario,
  mode = "card",
  utmSource,
  email,
}: PickWrapperProps) {
  const esPremium = estadoUsuario === "premium";

  if (esPremium && pick) {
    return (
      <PickDesbloqueado
        pick={pick}
        mode={mode}
        utmSource={utmSource}
        email={email}
      />
    );
  }

  // Premium sin pick: igual mostrar el fallback "Próximamente" pero sin
  // CTA agresivo de conversión — el user ya pagó. Reutilizamos el teaser
  // con copyVariant `free` (CTA neutro a /premium/contenido) ya que el
  // copy `anonimo`/`ftd` no aplica.
  const copyVariant = esPremium
    ? "free"
    : copyVariantFromEstado(estadoUsuario);

  return (
    <PickBloqueadoTeaser
      pick={esPremium ? null : pick}
      mode={mode}
      copyVariant={copyVariant}
      utmSource={utmSource}
    />
  );
}

export type { PickWrapperData, PickWrapperMode } from "./types";
