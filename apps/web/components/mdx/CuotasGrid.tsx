// CuotasGrid — Lote 9.
//
// Componente puro de presentación. Recibe un OddsCacheEntry y pinta tres
// secciones de mercado (1X2, +2.5, BTTS) con CTAs dorados que linkean al
// redirect tracker `/go/[casa]?utm_*`. Usado tanto desde server (RSC con
// cache hit) como desde cliente (poller cuando llega data).
//
// No tiene "use client" — es un componente plano que se bundlea según el
// caller. Intencionalmente usamos `<a>` plano (no `<Link>`) para no
// arrastrar Next/router al bundle del client poller.
//
// Estilo: alineado con el CTA dorado del mockup (`.btn-primary`,
// línea 373 del HTML), mismo lenguaje visual que CasaCTA.

import type { OddsCacheEntry, OddsOutcome } from "@/lib/services/odds-cache.service";

type Mercado = "1X2" | "btts" | "ou25";
type Outcome = "local" | "empate" | "visita" | "si" | "no" | "over" | "under";

interface Props {
  partidoId: string;
  data: OddsCacheEntry;
}

export function CuotasGrid({ partidoId, data }: Props) {
  const { mercados, actualizadoEn } = data;
  const mercadosVacios = isMercadosVacios(data);

  if (mercadosVacios) {
    return <EstadoVacio />;
  }

  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas"
      className="my-6 overflow-hidden rounded-md border border-light bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-light bg-subtle px-5 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue-main">
          📊 Cuotas comparadas
        </span>
        <span className="rounded-sm bg-card px-2 py-0.5 text-[11px] font-bold text-muted-d">
          Actualizado {formatTiempoRelativo(actualizadoEn)}
        </span>
      </header>

      <Seccion titulo="Resultado (1X2)">
        <CuotaCelda
          partidoId={partidoId}
          mercado="1X2"
          outcome="local"
          label="Local"
          outcomeData={mercados["1X2"].local}
        />
        <CuotaCelda
          partidoId={partidoId}
          mercado="1X2"
          outcome="empate"
          label="Empate"
          outcomeData={mercados["1X2"].empate}
        />
        <CuotaCelda
          partidoId={partidoId}
          mercado="1X2"
          outcome="visita"
          label="Visita"
          outcomeData={mercados["1X2"].visita}
        />
      </Seccion>

      <Seccion titulo="Más / Menos 2.5 goles">
        <CuotaCelda
          partidoId={partidoId}
          mercado="ou25"
          outcome="over"
          label="Más de 2.5"
          outcomeData={mercados["+2.5"].over}
        />
        <CuotaCelda
          partidoId={partidoId}
          mercado="ou25"
          outcome="under"
          label="Menos de 2.5"
          outcomeData={mercados["+2.5"].under}
        />
      </Seccion>

      <Seccion titulo="Ambos equipos anotan (BTTS)">
        <CuotaCelda
          partidoId={partidoId}
          mercado="btts"
          outcome="si"
          label="Sí"
          outcomeData={mercados.BTTS.si}
        />
        <CuotaCelda
          partidoId={partidoId}
          mercado="btts"
          outcome="no"
          label="No"
          outcomeData={mercados.BTTS.no}
        />
      </Seccion>

      <p className="border-t border-light bg-subtle/50 px-5 py-3 text-[11px] leading-[1.5] text-muted-d">
        Cuotas referenciales. La cuota final la confirma cada operador al
        momento de tu apuesta. Sólo casas autorizadas por MINCETUR.
      </p>
    </aside>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-light px-5 py-4 last:border-b-0">
      <h4 className="mb-3 font-display text-[13px] font-bold uppercase tracking-[0.04em] text-dark">
        {titulo}
      </h4>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">{children}</div>
    </section>
  );
}

interface CuotaCeldaProps {
  partidoId: string;
  mercado: Mercado;
  outcome: Outcome;
  label: string;
  outcomeData: OddsOutcome | null;
}

function CuotaCelda({
  partidoId,
  mercado,
  outcome,
  label,
  outcomeData,
}: CuotaCeldaProps) {
  if (!outcomeData) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed border-light bg-subtle px-3 py-2.5 text-[12px] text-muted-d">
        <span>{label}</span>
        <span className="font-mono">—</span>
      </div>
    );
  }

  const utm = new URLSearchParams({
    utm_source: "cuotas",
    utm_medium: "comparador",
    partidoId,
    mercado,
    outcome,
  }).toString();

  return (
    <a
      href={`/go/${outcomeData.casa}?${utm}`}
      rel="sponsored noopener"
      className="flex items-center justify-between gap-2 rounded-md bg-brand-gold px-3 py-2.5 text-[13px] font-bold text-black shadow-[0_3px_8px_rgba(255,184,0,0.3)] transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-[0_8px_24px_rgba(255,184,0,0.4)]"
    >
      <span className="flex flex-col gap-0.5 leading-tight">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] opacity-80">
          {label}
        </span>
        <span className="text-[11px] font-bold opacity-90">
          {outcomeData.casaNombre}
        </span>
      </span>
      <span className="font-mono text-[18px] font-black tabular-nums">
        {outcomeData.odd.toFixed(2)}
      </span>
    </a>
  );
}

function EstadoVacio() {
  return (
    <aside
      role="note"
      aria-label="Comparador de cuotas"
      className="my-6 overflow-hidden rounded-md border border-light bg-card shadow-sm"
    >
      <header className="border-b border-light bg-subtle px-5 py-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-blue-main">
          📊 Cuotas comparadas
        </span>
      </header>
      <div className="px-5 py-8 text-center">
        <p className="m-0 font-display text-[15px] font-bold text-dark">
          No hay cuotas disponibles para este partido
        </p>
        <p className="mx-auto mt-2 max-w-[420px] text-[13px] leading-[1.55] text-muted-d">
          Ninguna de las casas autorizadas por MINCETUR tiene cuotas
          publicadas todavía. Mientras tanto, conocé las casas habilitadas.
        </p>
        <a
          href="/casas"
          className="mt-4 inline-flex items-center gap-1.5 rounded-sm border border-light bg-card px-4 py-2 text-[12px] font-bold text-dark transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Ver casas autorizadas
          <span aria-hidden>→</span>
        </a>
      </div>
    </aside>
  );
}

function isMercadosVacios(data: OddsCacheEntry): boolean {
  const m = data.mercados;
  return (
    !m["1X2"].local &&
    !m["1X2"].empate &&
    !m["1X2"].visita &&
    !m.BTTS.si &&
    !m.BTTS.no &&
    !m["+2.5"].over &&
    !m["+2.5"].under
  );
}

function formatTiempoRelativo(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "hace un momento";
  const diffMs = Date.now() - t;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "hace menos de 1 min";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  return `hace ${diffH} h`;
}
