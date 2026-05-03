// /las-fijas — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-list.
//
// Estructura del mockup:
//   <div class="container">
//     <div class="page-title">Las Fijas</div>
//     <div class="page-subtitle">…</div>
//     <div class="fijas-filters"> chips + search </div>
//     <table class="fijas-list-table">…</table>
//     <div class="fijas-list-mobile">…</div>
//   </div>
//
// Datos provienen de listarFijas() — mismo contrato que Lote M, sin cambios.
// `force-dynamic`: el listado depende del Filtro 1 que el admin puede mover
// en cualquier momento + del estado del análisis.

import type { Metadata } from "next";
import {
  listarFijas,
  obtenerLigasPresentes,
} from "@/lib/services/las-fijas.service";
import { FijasList } from "@/components/fijas/FijasList";
import { FijasFilters } from "@/components/fijas/FijasFilters";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Las Fijas · Habla!",
  description:
    "Pronóstico Habla! 1X2, mejores cuotas comparadas y análisis básico de los próximos partidos cubiertos. Comparador en vivo · cuotas referenciales.",
  alternates: { canonical: "/las-fijas" },
  openGraph: {
    title: "Las Fijas | Habla!",
    description:
      "Pronóstico Habla! y mejores cuotas de los próximos partidos cubiertos por las casas autorizadas MINCETUR.",
  },
};

interface SearchParams {
  liga?: string;
  dia?: "hoy" | "manana" | "semana";
  q?: string;
}

export default async function LasFijasPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const dia =
    searchParams?.dia === "hoy" ||
    searchParams?.dia === "manana" ||
    searchParams?.dia === "semana"
      ? searchParams.dia
      : undefined;

  const [partidos, ligas] = await Promise.all([
    listarFijas({
      liga: searchParams?.liga,
      dia,
      q: searchParams?.q,
    }),
    obtenerLigasPresentes(),
  ]);

  return (
    <div className="mockup-container">
      <TrackOnMount
        event="fijas_lista_vista"
        props={{
          totalPartidos: partidos.length,
          liga: searchParams?.liga ?? null,
          dia: dia ?? null,
        }}
      />

      <div className="page-title">Las Fijas</div>
      <div className="page-subtitle">
        Comparador de cuotas en vivo · {partidos.length}{" "}
        {partidos.length === 1 ? "partido" : "partidos"} · refresco cada 30 min
      </div>

      <FijasFilters ligasPresentes={ligas} />

      <FijasList partidos={partidos} />
    </div>
  );
}
