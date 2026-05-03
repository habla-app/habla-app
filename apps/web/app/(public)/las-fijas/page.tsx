// /las-fijas — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § page-fijas-list.
//
// Reescritura completa del Lote B (que solo mostraba comparador de cuotas
// vía obtenerOddsCacheadas y MDX). En v3.2 esta vista es el listado curado
// del admin: solo aparecen partidos con `mostrarAlPublico = true` (Filtro 1)
// y cada fila usa el AnalisisPartido APROBADO si existe para mostrar el
// pronóstico Habla! 1X2 + probabilidad.
//
// Paridad mobile + desktop según mockup:
//   - Mobile: cards verticales apiladas (FijasList)
//   - Desktop: tabla densa (FijasList renderiza ambas)
//
// `force-dynamic`: la lista depende del Filtro 1 que el admin puede mover
// en cualquier momento + del estado del análisis. Cache de Next sería
// inconsistente con la realidad operativa.

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
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-6 md:py-10">
      <TrackOnMount
        event="fijas_lista_vista"
        props={{
          totalPartidos: partidos.length,
          liga: searchParams?.liga ?? null,
          dia: dia ?? null,
        }}
      />

      <header className="mb-5">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          📊 Comparador en vivo
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[36px]">
          Las Fijas
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          Pronóstico Habla! 1X2 y mejores cuotas de los próximos partidos
          cubiertos. Refresco continuo · cuotas referenciales.
        </p>
      </header>

      <FijasFilters ligasPresentes={ligas} />

      <FijasList partidos={partidos} />
    </div>
  );
}
