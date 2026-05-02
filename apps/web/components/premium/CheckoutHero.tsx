// CheckoutHero — hero compacto + indicador de progreso (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/checkout.spec.md.
//
// 3 dots horizontales: Plan elegido (done) → Pagar (curr) → Channel
// (pending). Hero gradient navy → blue.

export function CheckoutHero() {
  return (
    <div className="bg-gradient-to-br from-brand-blue-dark to-brand-blue-main px-4 py-5 text-white">
      <h1 className="font-display text-display-md font-extrabold uppercase tracking-tight">
        Activa tu Premium
      </h1>
      <p className="mt-1 text-body-xs text-white/70">
        Falta 1 paso · Estás a un click
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-gold text-[11px] font-bold text-brand-blue-dark"
        >
          ✓
        </div>
        <div className="h-0.5 flex-1 bg-brand-gold" />
        <div
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-brand-blue-dark ring-2 ring-brand-gold/40"
        >
          2
        </div>
        <div className="h-0.5 flex-1 bg-white/20" />
        <div
          aria-hidden
          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 text-[11px] font-bold text-white/50"
        >
          3
        </div>
      </div>
      <div className="mt-1.5 flex justify-between text-[9px] text-white/60">
        <span>Plan</span>
        <span>Pagar</span>
        <span>Channel</span>
      </div>
    </div>
  );
}
