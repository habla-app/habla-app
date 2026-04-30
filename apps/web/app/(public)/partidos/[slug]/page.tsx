// /partidos/[slug] — Producto B v3.1 (Lote B, rewrite del Lote 8/9).
// Spec: docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Vista crítica del modelo v3.1: hero del partido + análisis editorial
// MDX + comparador de cuotas mobile-first + pronóstico Habla! + pick
// Premium (bloqueado/desbloqueado según estado del usuario) + cross-link
// a Liga Habla! (Producto C).
//
// `force-dynamic` (cambio frente al `revalidate=3600` del Lote 8) porque
// la vista depende de session + cuotas frescas + pick Premium.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import remarkGfm from "remark-gfm";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import * as partidos from "@/lib/content/partidos";
import { obtenerOddsCacheadas } from "@/lib/services/odds-cache.service";
import { detectarEstadoUsuario } from "@/lib/services/estado-usuario.service";
import { MDX_COMPONENTS } from "@/lib/content/mdx-components";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { BackToTop } from "@/components/legal/BackToTop";
import { PartidoHero } from "@/components/partido/PartidoHero";
import { CuotasGridMobile } from "@/components/partido/CuotasGridMobile";
import { PickBloqueadoSeccion } from "@/components/partido/PickBloqueadoSeccion";
import { LigaWidgetInline } from "@/components/partido/LigaWidgetInline";
import { SoporteFooter } from "@/components/partido/SoporteFooter";
import { CuotasComparatorPoller } from "@/components/mdx/CuotasComparatorPoller";

interface Params {
  slug: string;
}

export const dynamic = "force-dynamic";

export function generateStaticParams(): Array<Params> {
  return partidos.getMetaEntries().map((e) => ({ slug: e.slug }));
}

export function generateMetadata({
  params,
}: {
  params: Params;
}): Metadata {
  const doc = partidos.getBySlug(params.slug);
  if (!doc) return {};
  const { title, excerpt, tags, ogImage, author } = doc.frontmatter;
  return {
    title,
    description: excerpt,
    keywords: tags,
    authors: [{ name: author }],
    alternates: { canonical: `/partidos/${params.slug}` },
    openGraph: {
      type: "article",
      title: `${title} | Habla!`,
      description: excerpt,
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
  };
}

export default async function PartidoPreviaPage({
  params,
}: {
  params: Params;
}) {
  const doc = partidos.getBySlug(params.slug);
  if (!doc) notFound();
  const { frontmatter, body } = doc;

  const session = await auth();
  const userId = session?.user?.id;
  const estadoUsuario = await detectarEstadoUsuario(userId);

  // Resolver Partido en BD desde el frontmatter (para cross-data).
  const partidoBd = await resolvePartido(frontmatter.partidoId);

  // Cuotas cacheadas si tenemos partidoId vivo.
  const cuotas = partidoBd
    ? await obtenerOddsCacheadas(partidoBd.id)
    : null;

  // Torneo asociado al partido (Producto C cross-link). Best-effort —
  // si la query falla, el widget no se renderiza.
  const torneo = partidoBd
    ? await prisma.torneo.findFirst({
        where: { partidoId: partidoBd.id, estado: "ABIERTO" },
        select: { id: true, totalInscritos: true },
      })
    : null;

  // PickPremium: depende del modelo creado en Lote E. Mientras no exista,
  // siempre null. La sección Premium maneja el fallback.
  const pickPremium = null;

  return (
    <article className="mx-auto w-full max-w-[1200px]">
      <SportsEventJsonLd doc={doc} />
      <TrackOnMount
        event="articulo_visto"
        props={{
          slug: frontmatter.slug,
          categoria: "partido",
          titulo: frontmatter.title,
          partidoSlug: frontmatter.partidoSlug,
        }}
      />

      {/* HERO */}
      <PartidoHero
        liga={partidoBd?.liga ?? frontmatter.title}
        equipoLocal={partidoBd?.equipoLocal ?? extraerEquipoFromTitle(frontmatter.title, true)}
        equipoVisita={partidoBd?.equipoVisita ?? extraerEquipoFromTitle(frontmatter.title, false)}
        fechaInicio={partidoBd?.fechaInicio ?? new Date(frontmatter.publishedAt)}
        estadio={partidoBd?.venue ?? null}
        estado={mapEstadoPartido(partidoBd?.estado)}
        marcadorLocal={partidoBd?.golesLocal ?? null}
        marcadorVisita={partidoBd?.golesVisita ?? null}
        minuto={partidoBd?.liveElapsed ?? null}
      />

      <div className="px-4 py-6 md:px-6 md:py-8">
        {/* SECCIÓN — Cuotas comparadas (CTA AFILIADO) */}
        <section aria-label="Cuotas comparadas" className="mb-6">
          {partidoBd && cuotas ? (
            <CuotasGridMobile
              partidoId={partidoBd.id}
              data={cuotas}
              conHeader
            />
          ) : partidoBd ? (
            <CuotasComparatorPoller partidoId={partidoBd.id} />
          ) : (
            <div className="rounded-md border border-dashed border-light bg-card p-5 text-center">
              <p className="text-body-sm text-muted-d">
                Cuotas no disponibles · partido sin cobertura aún.
              </p>
            </div>
          )}
        </section>

        {/* SECCIÓN — Análisis editorial */}
        <section
          aria-label="Análisis del editor"
          className="mb-6"
        >
          <header className="mb-3">
            <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
              🎯 Análisis del editor
            </p>
            <h1 className="font-display text-display-lg leading-tight text-dark md:text-[36px]">
              {frontmatter.title}
            </h1>
            <p className="mt-2 text-body-md leading-[1.55] text-body">
              {frontmatter.excerpt}
            </p>
          </header>
          <div className="mdx-body">
            <MDXRemote
              source={body}
              components={MDX_COMPONENTS}
              options={{
                mdxOptions: {
                  remarkPlugins: [remarkGfm],
                },
              }}
            />
          </div>
        </section>

        {/* SECCIÓN PREMIUM — Pick bloqueado o desbloqueado */}
        <PickBloqueadoSeccion
          pick={pickPremium}
          estadoUsuario={estadoUsuario}
          email={session?.user?.email ?? null}
        />

        {/* SECCIÓN LIGA HABLA! — Cross-link a Producto C */}
        <LigaWidgetInline
          torneoId={torneo?.id ?? null}
          partidoSlug={params.slug}
          totalInscritos={torneo?.totalInscritos ?? 0}
        />

        {/* FOOTER soporte (Producto A) */}
        <SoporteFooter />
      </div>

      <BackToTop />
    </article>
  );
}

async function resolvePartido(partidoId: string | undefined) {
  if (!partidoId) return null;
  try {
    return await prisma.partido.findUnique({
      where: { id: partidoId },
      select: {
        id: true,
        liga: true,
        equipoLocal: true,
        equipoVisita: true,
        fechaInicio: true,
        venue: true,
        estado: true,
        golesLocal: true,
        golesVisita: true,
        liveElapsed: true,
      },
    });
  } catch {
    return null;
  }
}

function mapEstadoPartido(
  estado: "PROGRAMADO" | "EN_VIVO" | "FINALIZADO" | "CANCELADO" | undefined,
): "programado" | "en_vivo" | "finalizado" {
  if (estado === "EN_VIVO") return "en_vivo";
  if (estado === "FINALIZADO") return "finalizado";
  return "programado";
}

/** Heurística para extraer equipo cuando no hay partido en BD: el title
 *  del MDX típicamente es "Equipo A vs Equipo B: ...". */
function extraerEquipoFromTitle(title: string, local: boolean): string {
  const match = title.match(/^([^:]+?)\s*vs\s*([^:]+?)(?::|$)/i);
  if (!match) return local ? "Local" : "Visita";
  return (local ? match[1] : match[2]).trim();
}

function SportsEventJsonLd({
  doc,
}: {
  doc: NonNullable<ReturnType<typeof partidos.getBySlug>>;
}) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: doc.frontmatter.title,
    description: doc.frontmatter.excerpt,
    startDate: doc.frontmatter.publishedAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    sport: "Football",
    url: `${baseUrl}/partidos/${doc.frontmatter.slug}`,
    organizer: { "@type": "Organization", name: "Habla!", url: baseUrl },
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
