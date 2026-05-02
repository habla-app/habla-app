// GarantiaCard — banner de garantía 7 días (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Banner ancho completo verde con check + texto de garantía + sub.

export function GarantiaCard() {
  return (
    <div
      role="note"
      aria-label="Garantía 7 días"
      className="bg-status-green px-4 py-3.5 text-center text-white"
    >
      <p className="flex items-center justify-center gap-2 text-body-sm font-bold">
        <span aria-hidden>✓</span>
        Garantía de 7 días · sin compromiso
      </p>
      <p className="mt-1 text-body-xs text-white/85">
        Si no te gusta, te devolvemos el 100% sin preguntas.
      </p>
    </div>
  );
}
