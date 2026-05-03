// MercadosSecundariosCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-fijas-detail (mercados secundarios
// con value, solo Socios).
//
// Tabla / grid de mercados con value detectado (BTTS, ±2.5, marcador exacto,
// etc.) además del 1X2. Cada fila trae mercado + cuota + EV+ + casa.

interface Mercado {
  mercado?: string;
  cuota?: number | string;
  value?: number | string;
  casa?: string;
}

interface Props {
  mercados: Mercado[];
}

export function MercadosSecundariosCard({ mercados }: Props) {
  if (mercados.length === 0) return null;
  return (
    <section
      aria-label="Mercados secundarios con value"
      className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
    >
      <header className="mb-4">
        <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
          📊 Solo Socios
        </p>
        <h3 className="font-display text-display-md font-extrabold text-dark md:text-display-lg">
          Mercados secundarios con value
        </h3>
      </header>

      <ul className="grid gap-2 md:grid-cols-2">
        {mercados.map((m, i) => (
          <Li key={i} m={m} />
        ))}
      </ul>
    </section>
  );
}

function Li({ m }: { m: Mercado }) {
  const cuota = numero(m.cuota);
  const value = numero(m.value);
  return (
    <li className="rounded-sm border border-light bg-subtle/40 px-3 py-3">
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="line-clamp-1 font-display text-label-md font-bold text-dark">
          {m.mercado ?? "—"}
        </p>
        {cuota !== null ? (
          <span className="shrink-0 rounded-sm bg-brand-blue-main/10 px-2 py-0.5 font-display text-label-sm font-extrabold text-brand-blue-main">
            @{cuota.toFixed(2)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-2 text-body-xs">
        {value !== null ? (
          <span className="rounded-full bg-brand-gold/15 px-2 py-0.5 font-display font-bold text-brand-gold-dark">
            EV+ {(value * 100).toFixed(1)}%
          </span>
        ) : (
          <span />
        )}
        {m.casa ? (
          <span className="text-muted-d">{m.casa}</span>
        ) : null}
      </div>
    </li>
  );
}

function numero(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
