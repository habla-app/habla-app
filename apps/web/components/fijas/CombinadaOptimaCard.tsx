// CombinadaOptimaCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail .pick-socios-unlocked.
//
// Bloque desbloqueado para Socios: combinada óptima recomendada del motor
// con stake sugerido + EV+ realizado + chips. Reemplaza al teaser
// BloqueoSociosTeaser cuando el visitante es Socios.

interface CombinadaShape {
  mercados?: Array<{
    mercado?: string;
    outcome?: string;
    cuota?: number | string;
    casa?: string;
  }>;
  cuotaTotal?: number | string;
  stake?: number | string;
  evPlus?: number | string;
  confianza?: number | string;
}

interface Props {
  data: CombinadaShape;
}

export function CombinadaOptimaCard({ data }: Props) {
  const cuotaTotal = numero(data.cuotaTotal);
  const stake = numero(data.stake);
  const evPlus = numero(data.evPlus);
  const confianza = numero(data.confianza);

  return (
    <section
      aria-label="Combinada óptima"
      className="overflow-hidden rounded-md border-2 border-brand-gold/40 bg-gradient-to-br from-brand-gold/[0.12] to-brand-gold-light/[0.08] p-5 shadow-sm md:p-6"
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
            💎 Combinada Habla! · Solo Socios
          </p>
          <h3 className="font-display text-display-md font-extrabold text-dark md:text-display-lg">
            Combinada óptima del motor
          </h3>
        </div>
        {evPlus !== null ? (
          <span className="shrink-0 rounded-full bg-brand-gold px-3 py-1.5 font-display text-label-sm font-extrabold text-black shadow-gold-btn">
            EV+ {(evPlus * 100).toFixed(1)}%
          </span>
        ) : null}
      </header>

      {data.mercados && data.mercados.length > 0 ? (
        <ul className="mb-4 space-y-2">
          {data.mercados.map((m, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-sm border border-brand-gold/30 bg-card px-3 py-2 shadow-sm"
            >
              <div className="min-w-0">
                <p className="font-display text-label-md font-bold text-dark">
                  {m.mercado ?? "—"}
                </p>
                <p className="text-body-xs text-muted-d">
                  {m.outcome ?? ""} {m.casa ? `· ${m.casa}` : ""}
                </p>
              </div>
              {m.cuota !== undefined && m.cuota !== null ? (
                <span className="rounded-sm bg-brand-blue-main/10 px-2.5 py-1 font-display text-label-md font-extrabold text-brand-blue-main">
                  @{Number(m.cuota).toFixed(2)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 text-body-sm md:grid-cols-4">
        {cuotaTotal !== null ? (
          <Stat label="Cuota total" value={`@${cuotaTotal.toFixed(2)}`} />
        ) : null}
        {stake !== null ? (
          <Stat label="Stake bankroll" value={`${(stake * 100).toFixed(1)}%`} />
        ) : null}
        {evPlus !== null ? (
          <Stat label="EV+ esperado" value={`${(evPlus * 100).toFixed(1)}%`} />
        ) : null}
        {confianza !== null ? (
          <Stat label="Confianza" value={`${Math.round(confianza * 100)}%`} />
        ) : null}
      </dl>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-card/60 px-3 py-2">
      <dt className="text-label-sm uppercase tracking-[0.04em] text-muted-d">
        {label}
      </dt>
      <dd className="font-display text-display-xs font-extrabold text-dark">
        {value}
      </dd>
    </div>
  );
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
