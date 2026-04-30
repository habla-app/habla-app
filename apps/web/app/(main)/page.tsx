// Home / landing pública — Lote 11 (May 2026).
//
// Pivot editorial: la home pasa de grilla de torneos (Lote 0) a hub
// editorial que cose contenidos de Lotes 5, 7, 8, 9, 10:
//   1. Hero editorial (titular + 2 CTAs).
//   2. Pronósticos del día — top 3 partidos próximos con
//      `<CuotasComparatorMini>` embebido. (Lote 9 + Lote 11 mini.)
//   3. Compite gratis con la comunidad — preview Top 5 leaderboard del
//      mes en curso (Lote 5).
//   4. Casas autorizadas top — grid de 6 casas con
//      `<CasaReviewCardMini>`. (Lote 7 + Lote 11 mini.)
//   5. Últimos análisis — 3 últimos artículos de blog. (Lote 8.)
//   6. Newsletter signup — `<NewsletterCTA fuente="home" />`. (Lote 10.)
//
// Mantiene `force-dynamic` porque el leaderboard preview, los partidos y
// los inscritos pueden cambiar entre requests. Los 3 últimos artículos
// vienen de filesystem (loader del Lote 8), así que no aportan latencia
// de DB.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { listar } from "@/lib/services/torneos.service";
import {
  obtenerActivosOrdenados,
} from "@/lib/services/afiliacion.service";
import {
  obtenerLeaderboardMesActual,
} from "@/lib/services/leaderboard.service";
import * as articles from "@/lib/content/articles";
import { HomeHero } from "@/components/home/HomeHero";
import { SectionBar } from "@/components/home/SectionBar";
import { PartidoDelDiaCard } from "@/components/home/PartidoDelDiaCard";
import { LeaderboardPreview } from "@/components/home/LeaderboardPreview";
import { CasaReviewCardMini } from "@/components/mdx/CasaReviewCardMini";
import { ArticleCard } from "@/components/home/ArticleCard";
import { NewsletterCTA } from "@/components/marketing/NewsletterCTA";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Habla! · Te decimos qué jugar",
  description:
    "Comunidad gratuita de pronósticos deportivos en Perú. Predicciones, comparador de cuotas, casas autorizadas MINCETUR y leaderboard mensual con S/ 1,250 en premios.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await auth();
  const usuarioIdActual = session?.user?.id ?? undefined;

  // Carga concurrente — todas las queries son independientes.
  const [torneosVentana, casasActivas, leaderboard, articulos] = await Promise.all([
    listar({ estado: "ABIERTO", limit: 20 }),
    obtenerActivosOrdenados(),
    obtenerLeaderboardMesActual({ usuarioIdActual }),
    Promise.resolve(articles.getAll()),
  ]);

  // 1. Top 3 partidos del día → próximos 24h, ordenados por kickoff ASC.
  //    `listar()` ya filtra estado ABIERTO; nosotros recortamos a la
  //    ventana de 24h y al cierre futuro (no expirado).
  const now = new Date();
  const limite24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const partidosDelDia = torneosVentana.torneos
    .filter(
      (t) =>
        t.cierreAt.getTime() > now.getTime() &&
        t.partido.fechaInicio.getTime() <= limite24h.getTime(),
    )
    .slice(0, 3)
    .map((t) => ({
      partidoId: t.partido.id,
      partidoSlug: buildPartidoSlug(
        t.partido.equipoLocal,
        t.partido.equipoVisita,
        t.partido.fechaInicio,
      ),
      liga: t.partido.liga,
      equipoLocal: t.partido.equipoLocal,
      equipoVisita: t.partido.equipoVisita,
      fechaInicio: t.partido.fechaInicio,
      torneoId: t.id,
      totalInscritos: t.totalInscritos,
    }));

  // 2. Casas top — 6 con prioridad de `obtenerActivosOrdenados`.
  const casasTop = casasActivas.slice(0, 6);

  // 3. Últimos artículos — 3 más recientes (loader ya ordena DESC).
  const ultimosArticulos = articulos.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
      <HomeHero />

      {/* SECCIÓN 2 — Pronósticos del día */}
      <section className="mb-12">
        <SectionBar
          icon="🎯"
          title="Pronósticos del día"
          subtitle="Los partidos top de las próximas 24 horas con sus mejores cuotas"
          ctaLabel="Ver todos →"
          ctaHref="/pronosticos"
        />
        {partidosDelDia.length === 0 ? (
          <EmptyPartidosDelDia />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {partidosDelDia.map((p) => (
              <PartidoDelDiaCard key={p.partidoId} partido={p} />
            ))}
          </div>
        )}
      </section>

      {/* SECCIÓN 3 — Compite gratis con la comunidad */}
      <section className="mb-12">
        <SectionBar
          icon="🏆"
          title="Compite gratis con la comunidad"
          subtitle={`Top 5 del mes · S/ 1,250 en premios para el Top 10`}
          ctaLabel="Ver leaderboard →"
          ctaHref="/comunidad"
          tone="blue"
        />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <LeaderboardPreview
            filas={leaderboard.filas}
            miUserId={usuarioIdActual ?? null}
            totalUsuarios={leaderboard.totalUsuarios}
            nombreMes={capitalize(leaderboard.nombreMes)}
          />
          <ComunidadCTA hasSession={!!session?.user} />
        </div>
      </section>

      {/* SECCIÓN 4 — Casas autorizadas top */}
      {casasTop.length > 0 ? (
        <section className="mb-12">
          <SectionBar
            icon="🛡️"
            title="Casas autorizadas top"
            subtitle="Operadores autorizados por MINCETUR · reviews editoriales sin maquillaje"
            ctaLabel="Ver todas →"
            ctaHref="/casas"
          />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {casasTop.map((c) => (
              <CasaReviewCardMini key={c.slug} slug={c.slug} />
            ))}
          </div>
        </section>
      ) : null}

      {/* SECCIÓN 5 — Últimos análisis */}
      {ultimosArticulos.length > 0 ? (
        <section className="mb-12">
          <SectionBar
            icon="📰"
            title="Últimos análisis"
            subtitle="Notas, guías y análisis recientes del equipo editorial"
            ctaLabel="Ver blog →"
            ctaHref="/blog"
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ultimosArticulos.map((doc) => (
              <ArticleCard key={doc.frontmatter.slug} doc={doc} />
            ))}
          </div>
        </section>
      ) : null}

      {/* SECCIÓN 6 — Newsletter */}
      <section className="mb-4">
        <NewsletterCTA fuente="home" />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyPartidosDelDia() {
  return (
    <div className="rounded-md border border-light bg-card px-6 py-10 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-3xl">
        ⏳
      </div>
      <p className="font-display text-[16px] font-bold text-dark">
        No hay partidos top en las próximas 24 horas
      </p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-[1.55] text-muted-d">
        Mientras tanto, podés revisar todos los pronósticos de la semana o
        nuestras guías editoriales.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pronosticos"
          className="rounded-md bg-brand-gold px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
        >
          Ver pronósticos
        </Link>
        <Link
          href="/blog"
          className="rounded-md border-[1.5px] border-strong bg-transparent px-5 py-2.5 text-[13px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Ir al blog
        </Link>
      </div>
    </div>
  );
}

function ComunidadCTA({ hasSession }: { hasSession: boolean }) {
  return (
    <aside className="flex flex-col justify-between rounded-md border-[1.5px] border-brand-gold bg-gradient-to-br from-brand-gold/[0.08] to-card p-5 shadow-sm">
      <div>
        <p className="mb-1 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gold-dark">
          Cómo funciona
        </p>
        <h3 className="mb-2 font-display text-[20px] font-black leading-tight text-dark">
          Predicí gratis. Ganá premios reales.
        </h3>
        <p className="text-[13px] leading-[1.55] text-body">
          Inscribite a un torneo, armá tu combinada de 5 predicciones y subí
          en el ranking. El día 1° de cada mes el Top 10 gana en efectivo.
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <Link
          href="/matches"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
        >
          Hacer mi predicción
        </Link>
        {!hasSession ? (
          <Link
            href="/auth/signin?callbackUrl=/matches"
            className="text-center text-[12px] font-bold text-brand-blue-main hover:underline"
          >
            Crear cuenta gratis →
          </Link>
        ) : null}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construye un slug humano `equipo-a-vs-equipo-b-yyyy-mm-dd` para crosseo
 * con los .mdx de `content/partidos/`. Intencionalmente liberal: si no
 * hay match en filesystem, la card cae al link `/torneo/[id]` y todo
 * sigue funcionando.
 */
function buildPartidoSlug(
  equipoLocal: string,
  equipoVisita: string,
  fechaInicio: Date,
): string {
  const slugify = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const fecha = fechaInicio.toISOString().slice(0, 10);
  return `${slugify(equipoLocal)}-vs-${slugify(equipoVisita)}-${fecha}`;
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
