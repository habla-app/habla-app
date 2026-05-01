// StatsHero — hero de /mis-predicciones (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/mis-predicciones.spec.md.
//
// Layout mobile-first: gradient navy → blue + 3 stats principales en
// boxes glass + título "Mis predicciones · Mes en curso · Cierra en N días".
//
// Stats:
//   - Predicciones totales
//   - % Acierto
//   - Pos. del mes (o "—" si aún no compite)

interface StatsHeroProps {
  predicciones: number;
  aciertoPct: number;
  posicionMes: number | null;
  totalUsuariosMes: number;
  diasParaCierre: number;
  nombreMes: string;
}

export function StatsHero({
  predicciones,
  aciertoPct,
  posicionMes,
  totalUsuariosMes,
  diasParaCierre,
  nombreMes,
}: StatsHeroProps) {
  return (
    <section className="bg-gradient-to-br from-brand-blue-dark to-brand-blue-main px-4 py-5 text-white">
      <h1 className="font-display text-display-md font-black uppercase">
        Mis predicciones
      </h1>
      <p className="mt-0.5 text-body-sm text-white/70">
        {nombreMes}
        {diasParaCierre > 0
          ? ` · Cierra en ${diasParaCierre} día${diasParaCierre === 1 ? "" : "s"}`
          : " · Mes cerrado"}
      </p>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Stat value={predicciones.toString()} label="Predicciones" />
        <Stat value={`${aciertoPct}%`} label="Acierto" />
        <Stat
          value={posicionMes !== null ? `#${posicionMes}` : "—"}
          label={
            posicionMes !== null && totalUsuariosMes > 0
              ? `de ${totalUsuariosMes}`
              : "Pos. mes"
          }
        />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-md border border-white/15 bg-white/[0.06] px-2.5 py-3 text-center">
      <div className="font-display text-[24px] font-extrabold leading-none text-brand-gold-light">
        {value}
      </div>
      <div className="mt-1 text-label-sm uppercase tracking-[0.06em] text-white/70">
        {label}
      </div>
    </div>
  );
}
