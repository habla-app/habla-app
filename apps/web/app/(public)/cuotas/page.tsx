// /cuotas — Lote 9.
//
// Grid de partidos próximos del día (próximas 36h) con `<CuotasComparator>`
// embebido por partido. Filtros por liga client-side (chips). SSR con
// `revalidate=1800` para que la página se regenere cada 30min en línea
// con el cron N de odds.

import type { Metadata } from "next";
import { prisma } from "@habla/db";
import { CuotasComparator } from "@/components/mdx/CuotasComparator";
import { CuotasPageClient } from "@/components/public/CuotasPageClient";
import { ligaToSlug } from "@/lib/config/liga-slugs";

export const revalidate = 1800; /* 30min */

export const metadata: Metadata = {
  title: "Comparador de cuotas · Habla!",
  description:
    "Compará en tiempo real las mejores cuotas entre las casas de apuestas autorizadas por MINCETUR para los próximos partidos.",
  alternates: { canonical: "/cuotas" },
  openGraph: {
    title: "Comparador de cuotas | Habla!",
    description:
      "Las mejores cuotas de las casas autorizadas MINCETUR, comparadas partido a partido.",
  },
};

const VENTANA_HORAS = 36;
const MAX_PARTIDOS = 30;

export default async function CuotasPage() {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + VENTANA_HORAS * 60 * 60 * 1000);

  const partidos = await prisma.partido.findMany({
    where: {
      fechaInicio: { gte: ahora, lte: limite },
      estado: "PROGRAMADO",
    },
    select: {
      id: true,
      liga: true,
      equipoLocal: true,
      equipoVisita: true,
      fechaInicio: true,
    },
    orderBy: { fechaInicio: "asc" },
    take: MAX_PARTIDOS,
  });

  const ligasPresentes = Array.from(
    new Set(
      partidos
        .map((p) => ligaToSlug(p.liga))
        .filter((s): s is string => !!s),
    ),
  );

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
          📊 Comparador en vivo
        </p>
        <h1 className="mb-3 font-display text-[36px] font-black leading-tight text-dark md:text-[44px]">
          Cuotas comparadas
        </h1>
        <p className="max-w-[680px] text-[15px] leading-[1.65] text-body">
          Las mejores cuotas de las casas autorizadas por MINCETUR, partido
          a partido. Refresco automático cada 30 minutos. Cuotas
          referenciales — la cuota final la confirma cada operador al
          momento de tu apuesta.
        </p>
      </header>

      {partidos.length === 0 ? (
        <EstadoSinPartidos />
      ) : (
        <CuotasPageClient ligasPresentes={ligasPresentes}>
          <ul className="space-y-8" aria-label="Próximos partidos">
            {partidos.map((p) => {
              const slug = ligaToSlug(p.liga);
              return (
                <li
                  key={p.id}
                  data-liga={slug ?? "otras"}
                  className="rounded-md border border-light bg-card p-5 shadow-sm md:p-6"
                >
                  <PartidoHeader
                    liga={p.liga}
                    equipoLocal={p.equipoLocal}
                    equipoVisita={p.equipoVisita}
                    fechaInicio={p.fechaInicio}
                  />
                  <CuotasComparator partidoId={p.id} />
                </li>
              );
            })}
          </ul>
        </CuotasPageClient>
      )}
    </div>
  );
}

function PartidoHeader({
  liga,
  equipoLocal,
  equipoVisita,
  fechaInicio,
}: {
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
}) {
  return (
    <header className="mb-3 flex flex-col gap-1.5 border-b border-light pb-4 md:flex-row md:items-center md:justify-between md:gap-4">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
          {liga}
        </p>
        <h2 className="font-display text-[20px] font-black leading-tight text-dark md:text-[22px]">
          {equipoLocal} <span className="text-muted-d">vs</span>{" "}
          {equipoVisita}
        </h2>
      </div>
      <time
        dateTime={fechaInicio.toISOString()}
        className="flex-shrink-0 self-start rounded-sm bg-subtle px-3 py-1.5 text-[12px] font-bold text-dark md:self-auto"
      >
        {formatFechaPartido(fechaInicio)}
      </time>
    </header>
  );
}

function formatFechaPartido(d: Date): string {
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EstadoSinPartidos() {
  return (
    <div className="mx-auto max-w-[640px] rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
      <p className="m-0 font-display text-[20px] font-bold text-dark">
        No hay partidos próximos en este momento
      </p>
      <p className="mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.6] text-muted-d">
        Estamos esperando que arranquen las próximas fechas de las ligas
        cubiertas. Mientras tanto, mirá quiénes están peleando el ranking
        del mes.
      </p>
      <a
        href="/comunidad"
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-5 py-2.5 text-[13px] font-bold text-black shadow-[0_3px_8px_rgba(255,184,0,0.3)] transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-[0_8px_24px_rgba(255,184,0,0.4)]"
      >
        Ver el ranking del mes
        <span aria-hidden>→</span>
      </a>
    </div>
  );
}
