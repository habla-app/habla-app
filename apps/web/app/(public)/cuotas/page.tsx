// /cuotas — Comparador global mobile-first (Lote B v3.1).
// Spec: docs/ux-spec/02-pista-usuario-publica/cuotas.spec.md.
//
// Reauditoría mobile-first del Lote 9. Se mantiene SSR + ISR 30min, pero
// los cards de partido pasan a usar `<CuotasGridMobile>` (filas verticales
// con flecha → en círculo, mejor cuota destacada en dorado) y los chips
// de filtros se quedan con scroll horizontal smooth (mismo del Lote 9 a
// través de `<HorizontalScrollChips>`).
//
// El listing también acepta `?dia=hoy|manana` y `?liga=<slug>` para que
// los filtros sean compartibles vía URL (en client-side el toggle se
// hace via `data-liga`/`data-dia`).

import type { Metadata } from "next";
import { prisma } from "@habla/db";
import { obtenerOddsCacheadas } from "@/lib/services/odds-cache.service";
import { CuotasPageClient } from "@/components/public/CuotasPageClient";
import { CuotasGridMobile } from "@/components/partido/CuotasGridMobile";
import { CuotasComparatorPoller } from "@/components/mdx/CuotasComparatorPoller";
import { ligaToSlug } from "@/lib/config/liga-slugs";
import { Badge } from "@/components/ui";
import { getTeamColor, getTeamInitials } from "@/lib/utils/team-colors";
import Link from "next/link";

export const revalidate = 1800; /* 30min */

export const metadata: Metadata = {
  title: "Comparador de cuotas · Habla!",
  description:
    "Comparador en tiempo real de las mejores cuotas entre las casas de apuestas autorizadas por MINCETUR para los próximos partidos.",
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

  const partidosConCuotas = await Promise.all(
    partidos.map(async (p) => ({
      ...p,
      cuotas: await obtenerOddsCacheadas(p.id),
    })),
  );

  const ligasPresentes = Array.from(
    new Set(
      partidos
        .map((p) => ligaToSlug(p.liga))
        .filter((s): s is string => !!s),
    ),
  );

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          📊 Comparador en vivo
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[36px]">
          Cuotas comparadas
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          Las mejores cuotas de las casas autorizadas MINCETUR, partido a
          partido. Refresco cada 30 min · cuotas referenciales.
        </p>
      </header>

      {partidos.length === 0 ? (
        <EstadoSinPartidos />
      ) : (
        <CuotasPageClient ligasPresentes={ligasPresentes}>
          <ul className="space-y-5" aria-label="Próximos partidos">
            {partidosConCuotas.map((p) => {
              const slug = ligaToSlug(p.liga);
              return (
                <li
                  key={p.id}
                  data-liga={slug ?? "otras"}
                  className="overflow-hidden rounded-md border border-light bg-card shadow-sm"
                >
                  <PartidoHeader
                    liga={p.liga}
                    equipoLocal={p.equipoLocal}
                    equipoVisita={p.equipoVisita}
                    fechaInicio={p.fechaInicio}
                  />
                  {p.cuotas ? (
                    <CuotasGridMobile
                      partidoId={p.id}
                      data={p.cuotas}
                      conHeader={false}
                    />
                  ) : (
                    <CuotasComparatorPoller partidoId={p.id} />
                  )}
                  <Link
                    href={`/partidos/${buildSlug(p.equipoLocal, p.equipoVisita, p.fechaInicio)}`}
                    className="block border-t border-light bg-subtle/60 px-4 py-3 text-center font-display text-label-md text-brand-blue-main transition-colors hover:bg-subtle hover:text-brand-blue-dark"
                  >
                    Ver análisis y pronóstico →
                  </Link>
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
  const localColor = getTeamColor(equipoLocal);
  const visitaColor = getTeamColor(equipoVisita);
  return (
    <header className="px-4 pb-2 pt-4 md:px-5 md:pb-3 md:pt-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Badge variant="info" size="sm">
          🏆 {liga}
        </Badge>
        <span className="rounded-sm bg-subtle px-2 py-0.5 text-body-xs font-bold text-dark">
          {formatFechaPartido(fechaInicio)}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Equipo
          nombre={equipoLocal}
          bg={localColor.bg}
          fg={localColor.fg}
        />
        <span className="font-display text-display-sm text-soft">VS</span>
        <Equipo
          nombre={equipoVisita}
          bg={visitaColor.bg}
          fg={visitaColor.fg}
        />
      </div>
    </header>
  );
}

function Equipo({
  nombre,
  bg,
  fg,
}: {
  nombre: string;
  bg: string;
  fg: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        aria-hidden
        className="mb-1.5 flex h-12 w-12 items-center justify-center rounded-full font-display text-display-xs font-black shadow-sm"
        style={{ background: bg, color: fg }}
      >
        {getTeamInitials(nombre)}
      </div>
      <p className="line-clamp-2 font-display text-label-md text-dark">
        {nombre}
      </p>
    </div>
  );
}

function buildSlug(local: string, visita: string, fecha: Date): string {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const f = fecha.toISOString().slice(0, 10);
  return `${slugify(local)}-vs-${slugify(visita)}-${f}`;
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
    <div className="mx-auto max-w-[640px] rounded-md border border-light bg-card px-5 py-10 text-center shadow-sm">
      <p className="m-0 font-display text-display-md text-dark">
        No hay partidos próximos en este momento
      </p>
      <p className="mx-auto mt-3 max-w-[480px] text-body-sm leading-[1.55] text-muted-d">
        Estamos esperando que arranquen las próximas fechas de las ligas
        cubiertas. Mientras tanto, mirá quiénes están peleando el ranking del
        mes.
      </p>
      <Link
        href="/comunidad"
        className="touch-target mt-5 inline-flex items-center gap-1.5 rounded-md bg-brand-gold px-5 py-2.5 text-label-md text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        Ver el ranking del mes →
      </Link>
    </div>
  );
}
