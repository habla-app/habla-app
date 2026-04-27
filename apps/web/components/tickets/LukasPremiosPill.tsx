// LukasPremiosPill — pill de stats de /mis-combinadas que muestra
// el balance de Lukas Premios (ganadas en torneos, canjeables en /tienda).
// Lote 6C: reemplaza BalancePill (que mostraba el total) para dejar claro
// al usuario cuántos Lukas tiene disponibles para canjear.
// Lote 6C-fix7: label "Total en premios" (más conciso).
//
// Diseño alineado 1:1 con StatsPill: misma altura tipográfica del valor
// (text-[30px]) y misma estrategia de alineación (flex-col items-center con
// padding horizontal uniforme). Emoji 💼 (bolsa de dinero) — antes 🏆, que
// ya se usa en el 2do pill "Ganadas con premio".
//
// Dato SSR: balanceGanadas es estático al momento del render. Solo cambia
// cuando un torneo finaliza y acredita premios — evento server-side que
// provoca un refresh completo de la página.

interface Props {
  lukasPremios: number;
}

export function LukasPremiosPill({ lukasPremios }: Props) {
  return (
    <div
      className="relative flex flex-col items-center overflow-hidden rounded-md border border-light bg-card px-4 py-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      data-testid="lukas-premios-pill"
    >
      <span
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-1 bg-brand-green"
      />
      <div aria-hidden className="mb-1.5 text-center text-[24px] leading-none">
        💼
      </div>
      <div className="text-center font-display text-[30px] font-black leading-none text-alert-success-text">
        {lukasPremios.toLocaleString("es-PE")} 🪙
      </div>
      <div className="mt-1.5 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.06em] text-muted-d">
        Total en Premios
      </div>
    </div>
  );
}
