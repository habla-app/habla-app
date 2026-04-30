// PartidoDelDiaCard — Lote 11.
//
// Card de partido top para la sección "Pronósticos del día" de la home.
// Server component async — embebe `<CuotasComparatorMini>` (Lote 11) y
// puede contener un pronóstico Habla! corto si existe MDX en
// `content/partidos/[partidoSlug].mdx` (loaders del Lote 8).
//
// Apunta a /partidos/[slug] si hay MDX publicado para ese partido, o a
// /torneo/[id] como fallback (esa ruta siempre existe mientras el torneo
// esté abierto).

import Link from "next/link";
import { CuotasComparatorMini } from "@/components/mdx/CuotasComparatorMini";
import * as partidos from "@/lib/content/partidos";
import { getTeamColor, getTeamInitials } from "@/lib/utils/team-colors";
import { formatKickoff } from "@/lib/utils/datetime";

export interface PartidoDelDiaInput {
  /** ID interno del Partido (PK Prisma). Usado para cuotas y fallback. */
  partidoId: string;
  /** Slug humano (`equipo-a-vs-equipo-b-yyyy-mm-dd`). Si hay MDX bajo ese
   *  slug, la card linkea a `/partidos/[slug]`. */
  partidoSlug: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
  /** Id del torneo asociado al partido (fallback de link cuando no hay MDX). */
  torneoId: string | null;
  totalInscritos: number;
}

export async function PartidoDelDiaCard({
  partido,
}: {
  partido: PartidoDelDiaInput;
}) {
  const mdx = partidos.getBySlug(partido.partidoSlug);
  const tienePrevia = !!mdx;
  const linkAnalisis = tienePrevia
    ? `/partidos/${partido.partidoSlug}`
    : partido.torneoId
      ? `/torneo/${partido.torneoId}`
      : `/matches`;

  const localColor = getTeamColor(partido.equipoLocal);
  const visitaColor = getTeamColor(partido.equipoVisita);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex-1 px-4 pb-3 pt-4">
        <div className="mb-3 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          <span className="truncate">🏆 {partido.liga}</span>
          <span>{formatKickoff(partido.fechaInicio)}</span>
        </div>

        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <TeamMini
            name={partido.equipoLocal}
            bg={localColor.bg}
            fg={localColor.fg}
          />
          <span
            aria-hidden
            className="font-display text-[18px] font-black text-soft"
          >
            VS
          </span>
          <TeamMini
            name={partido.equipoVisita}
            bg={visitaColor.bg}
            fg={visitaColor.fg}
          />
        </div>

        <CuotasComparatorMini partidoId={partido.partidoId} />

        {tienePrevia && mdx ? (
          <p className="mt-3 line-clamp-2 text-[12px] leading-[1.45] text-body">
            {mdx.frontmatter.excerpt}
          </p>
        ) : (
          <p className="mt-3 text-[11px] uppercase tracking-[0.06em] text-muted-d">
            {partido.totalInscritos.toLocaleString("es-PE")} tipster
            {partido.totalInscritos === 1 ? "" : "s"} compitiendo
          </p>
        )}
      </div>

      <Link
        href={linkAnalisis}
        className="block border-t border-light bg-subtle/60 px-4 py-3 text-center font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-brand-blue-main transition-colors hover:bg-subtle hover:text-brand-blue-dark"
      >
        {tienePrevia ? "Ver análisis completo →" : "Predecir gratis →"}
      </Link>
    </article>
  );
}

function TeamMini({
  name,
  bg,
  fg,
}: {
  name: string;
  bg: string;
  fg: string;
}) {
  return (
    <div className="text-center">
      <div
        aria-hidden
        className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full font-display text-[13px] font-black shadow-sm"
        style={{ background: bg, color: fg }}
      >
        {getTeamInitials(name)}
      </div>
      <div className="line-clamp-2 font-display text-[12px] font-extrabold uppercase leading-tight text-dark">
        {name}
      </div>
    </div>
  );
}
