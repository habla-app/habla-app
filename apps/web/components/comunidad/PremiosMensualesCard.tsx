// PremiosMensualesCard — card que lista los 10 premios mensuales de
// Liga Habla! (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad.spec.md.
//
// Visible al pie del hero de /comunidad. Mostrar los 10 premios de la
// tabla canónica del Lote 5: 1° S/500 · 2°-3° S/200 · 4°-10° S/50 c/u =
// S/1,250 totales. Layout mobile-first compacto.

import {
  TABLA_PREMIOS_MENSUAL,
  TOTAL_PREMIO_MENSUAL,
} from "@/lib/services/leaderboard.service";

export function PremiosMensualesCard() {
  return (
    <section className="bg-card px-4 py-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        <span aria-hidden>💰</span>
        Reparto del Top 10
      </h2>

      <div className="grid grid-cols-3 gap-1.5">
        {TABLA_PREMIOS_MENSUAL.map((p) => (
          <PremioCell
            key={p.posicion}
            posicion={p.posicion}
            monto={p.montoSoles}
          />
        ))}
      </div>

      <p className="mt-2 text-label-md text-muted-d">
        Total mensual:{" "}
        <strong className="text-dark">
          S/ {TOTAL_PREMIO_MENSUAL.toLocaleString("es-PE")}
        </strong>
        . Coordinamos pago por email dentro de 3 días hábiles del cierre.
      </p>
    </section>
  );
}

function PremioCell({
  posicion,
  monto,
}: {
  posicion: number;
  monto: number;
}) {
  const destacado = posicion === 1;
  const podio = posicion <= 3;
  return (
    <div
      className={
        destacado
          ? "rounded-md border border-brand-gold bg-gradient-to-br from-brand-gold/15 to-card px-2 py-2 text-center"
          : podio
            ? "rounded-md border border-light bg-subtle px-2 py-2 text-center"
            : "rounded-md border border-light bg-card px-2 py-2 text-center"
      }
    >
      <div className="text-label-sm font-bold uppercase tracking-[0.04em] text-muted-d">
        {posicion}°
      </div>
      <div className="font-display text-body-md font-extrabold leading-none text-brand-gold-dark">
        S/ {monto}
      </div>
    </div>
  );
}
