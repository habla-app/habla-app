// MisStatsMini — card destacada para el viewer en /comunidad (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/comunidad.spec.md.
//
// Muestra 3 stats personales del mes: puntos · posición · delta vs semana.
// Si el usuario aún no participó este mes, empty state con CTA.
//
// Si el usuario está fuera del Top 100, mostramos su posición real (la
// page resuelve cuál usar via miFila/miPosicionFueraDeTop100).

import Link from "next/link";

interface MisStatsMiniProps {
  miPuntos: number | null;
  miPosicion: number | null;
  totalUsuarios: number;
  /** Diferencia de puntos vs la última semana (positivo = mejoría). */
  deltaSemana?: number | null;
}

export function MisStatsMini({
  miPuntos,
  miPosicion,
  totalUsuarios,
  deltaSemana,
}: MisStatsMiniProps) {
  if (miPuntos === null && miPosicion === null) {
    return (
      <section className="mx-4 rounded-md border border-brand-blue-main bg-brand-blue-main/[0.06] px-4 py-4 shadow-sm">
        <p className="font-display text-display-xs font-bold uppercase text-brand-blue-main">
          Aún no participas este mes
        </p>
        <p className="mt-1 text-body-sm text-body">
          Suma puntos en cada partido para entrar al ranking.
        </p>
        <Link
          href="/cuotas"
          className="mt-3 inline-flex touch-target items-center gap-1 rounded-sm bg-brand-gold px-3.5 py-2 text-label-md font-bold text-brand-blue-dark shadow-gold-btn"
        >
          Hacer mi primera predicción →
        </Link>
      </section>
    );
  }

  return (
    <Link
      href="/mis-predicciones"
      className="mx-4 grid grid-cols-3 gap-2 rounded-md border border-brand-blue-main bg-gradient-to-r from-brand-blue-main/[0.08] to-card px-4 py-3 shadow-sm transition-colors hover:bg-brand-blue-main/[0.1]"
    >
      <Stat
        value={miPuntos !== null ? miPuntos.toLocaleString("es-PE") : "—"}
        label="Puntos del mes"
      />
      <Stat
        value={miPosicion !== null ? `#${miPosicion}` : "—"}
        label={
          miPosicion !== null && totalUsuarios > 0
            ? `de ${totalUsuarios.toLocaleString("es-PE")}`
            : "Posición"
        }
      />
      <Stat
        value={
          deltaSemana === null || deltaSemana === undefined
            ? "—"
            : deltaSemana > 0
              ? `+${deltaSemana}`
              : deltaSemana.toString()
        }
        label="Δ semana"
      />
    </Link>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-display-sm font-extrabold leading-none text-brand-blue-main">
        {value}
      </div>
      <div className="mt-1 text-label-sm uppercase text-muted-d">{label}</div>
    </div>
  );
}
