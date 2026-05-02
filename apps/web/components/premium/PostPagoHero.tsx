// PostPagoHero — hero verde celebratorio (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.
//
// Hero verde con check grande "¡Bienvenido a Premium!" + plan + fecha de
// vencimiento. Indicador de progreso completo (3/3 done).
//
// La fecha se formatea en español Perú con `Intl.DateTimeFormat`.

import { formatearFechaLargaPe } from "@/lib/utils/datetime";

interface Props {
  planLabel: string;
  vencimiento: Date | null;
}

export function PostPagoHero({ planLabel, vencimiento }: Props) {
  const fechaTxt = vencimiento
    ? formatearFechaLargaPe(vencimiento)
    : "tu fecha de renovación";

  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-status-green to-[#0aa86a] px-4 pb-6 pt-9 text-center text-white">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/15 blur-2xl"
      />
      <div
        aria-hidden
        className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white text-4xl font-extrabold text-status-green shadow-2xl"
      >
        ✓
      </div>
      <h1 className="font-display text-display-lg font-black uppercase leading-none">
        ¡Bienvenido
        <br />a Premium!
      </h1>
      <p className="mt-2 text-body-sm text-white/85">
        Plan {planLabel} activo hasta el {fechaTxt}
      </p>
      <div className="mt-4 flex items-center justify-center gap-1.5">
        <Dot />
        <Dash />
        <Dot />
        <Dash />
        <Dot />
      </div>
    </header>
  );
}

function Dot() {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] font-bold text-status-green"
    >
      ✓
    </span>
  );
}

function Dash() {
  return <span aria-hidden className="h-0.5 w-6 bg-white" />;
}
