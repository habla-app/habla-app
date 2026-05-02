// Home / landing pública — Lote B v3.1.
// Spec: docs/ux-spec/02-pista-usuario-publica/home.spec.md.
//
// Decisión arquitectónica v3.1: home única para anónimos y autenticados.
// Vivía en `app/(main)/page.tsx` (Lote 11). Movida acá; el grupo (main)
// queda sin index page.
//
// Personalización por estado del usuario:
// - anonimo: hero con tagline "Todas las fijas en una", CTAs Liga/Pronósticos
// - free:    saludo + Liga Habla! preview + Premium teaser dominante
// - ftd:     idem free + banner "Tu acierto X% → 65% Premium"
// - premium: hero suscriptor + canal info + cross-sell de casas (sin teaser)
//
// Nuevos bloques v3.1:
// - <EstadoUsuarioBanner>  contextual sólo para auth
// - <LigaHablaCardHome>    card grande dorada (Producto C)
// - <PremiumTeaserHome>    pick bloqueado (Producto Premium)
//
// Mantiene `force-dynamic` porque depende de session + leaderboard live.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { listar } from "@/lib/services/torneos.service";
import { obtenerActivosOrdenados } from "@/lib/services/afiliacion.service";
import { obtenerLeaderboardMesActual } from "@/lib/services/leaderboard.service";
import { detectarEstadoUsuario } from "@/lib/services/estado-usuario.service";
import { obtenerPickAprobadoUltimo } from "@/lib/services/picks-premium-publicos.service";
import * as articles from "@/lib/content/articles";
import { HomeHero } from "@/components/home/HomeHero";
import { SectionBar } from "@/components/home/SectionBar";
import { PartidoDelDiaCard } from "@/components/home/PartidoDelDiaCard";
import { LeaderboardPreview } from "@/components/home/LeaderboardPreview";
import { LigaHablaCardHome } from "@/components/home/LigaHablaCardHome";
import { PremiumTeaserHome } from "@/components/home/PremiumTeaserHome";
import { EstadoUsuarioBanner } from "@/components/home/EstadoUsuarioBanner";
import { CasaReviewCardMini } from "@/components/mdx/CasaReviewCardMini";
import { ArticleCard } from "@/components/home/ArticleCard";
import { NewsletterCTA } from "@/components/marketing/NewsletterCTA";
import { PWAInstallPrompt } from "@/components/ui/mobile/PWAInstallPrompt";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Habla! · Todas las fijas en una",
  description:
    "Pronósticos deportivos, comparador de cuotas, Liga Habla! con S/ 1,250 al mes en premios y Premium con picks por WhatsApp Channel.",
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const session = await auth();
  const usuarioIdActual = session?.user?.id ?? undefined;
  const estadoUsuario = await detectarEstadoUsuario(usuarioIdActual);

  // Carga concurrente — todas las queries son independientes.
  const [torneosVentana, casasActivas, leaderboard, articulos, pickPremium] =
    await Promise.all([
      listar({ estado: "ABIERTO", limit: 20 }),
      obtenerActivosOrdenados(),
      obtenerLeaderboardMesActual({ usuarioIdActual }),
      Promise.resolve(articles.getAll()),
      estadoUsuario === "premium"
        ? Promise.resolve(null)
        : obtenerPickAprobadoUltimo(),
    ]);

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

  const casasTop = casasActivas.slice(0, 6);
  const ultimosArticulos = articulos.slice(0, 3);

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:px-6 md:py-8">
      <HomeHero
        estadoUsuario={estadoUsuario}
        nombreUsuario={session?.user?.username ?? null}
      />

      <EstadoUsuarioBanner estado={estadoUsuario} />

      {/* SECCIÓN 2 — Próximos partidos */}
      <section className="mb-12">
        <SectionBar
          icon="⚡"
          title="Próximos partidos"
          subtitle="Los partidos top de las próximas 24 horas con sus mejores cuotas"
          ctaLabel="Ver todos →"
          ctaHref="/las-fijas"
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

      {/* SECCIÓN 3 — Liga Habla! card grande dorada (Producto C) */}
      <LigaHablaCardHome
        estado={estadoUsuario}
        totalTipsters={leaderboard.totalUsuarios}
        miPosicion={leaderboard.miFila?.posicion ?? null}
        nombreMes={capitalize(leaderboard.nombreMes)}
      />

      {/* SECCIÓN 4 — Premium teaser (oculto si premium) */}
      <PremiumTeaserHome estado={estadoUsuario} pick={pickPremium} />

      {/* SECCIÓN 5 — Leaderboard preview */}
      <section className="mb-12">
        <SectionBar
          icon="🏆"
          title="Top tipsters del mes"
          subtitle={`${capitalize(leaderboard.nombreMes)} · S/ 1,250 en premios para el Top 10`}
          ctaLabel="Ver leaderboard →"
          ctaHref="/liga"
          tone="blue"
        />
        <LeaderboardPreview
          filas={leaderboard.filas}
          miUserId={usuarioIdActual ?? null}
          totalUsuarios={leaderboard.totalUsuarios}
          nombreMes={capitalize(leaderboard.nombreMes)}
        />
      </section>

      {/* SECCIÓN 6 — Casas autorizadas top */}
      {casasTop.length > 0 ? (
        <section className="mb-12">
          <SectionBar
            icon="🛡️"
            title="Casas autorizadas top"
            subtitle="Operadores autorizados por MINCETUR · reviews editoriales sin maquillaje"
            ctaLabel="Ver todas →"
            ctaHref="/reviews-y-guias/casas"
          />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {casasTop.map((c) => (
              <CasaReviewCardMini key={c.slug} slug={c.slug} />
            ))}
          </div>
        </section>
      ) : null}

      {/* SECCIÓN 7 — Últimos análisis */}
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

      {/* SECCIÓN 8 — Newsletter (sólo si NO autenticado, freenewsletters
          autoasignados al registrarse) */}
      {estadoUsuario === "anonimo" ? (
        <section className="mb-4">
          <NewsletterCTA fuente="home" />
        </section>
      ) : null}

      {/* Lote I — Banner PWA mobile-only sticky bottom. Self-renderiza
          condicionalmente según `beforeinstallprompt` + dismiss state. */}
      <PWAInstallPrompt />
    </div>
  );
}

function EmptyPartidosDelDia() {
  return (
    <div className="rounded-md border border-light bg-card px-6 py-10 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-3xl">
        ⏳
      </div>
      <p className="font-display text-display-sm text-dark">
        No hay partidos top en las próximas 24 horas
      </p>
      <p className="mx-auto mt-2 max-w-md text-body-sm leading-[1.55] text-muted-d">
        Mientras tanto, podés revisar todos los pronósticos de la semana o
        nuestras guías editoriales.
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pronosticos"
          className="touch-target inline-flex items-center rounded-md bg-brand-gold px-5 py-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
        >
          Ver pronósticos
        </Link>
        <Link
          href="/blog"
          className="touch-target inline-flex items-center rounded-md border-[1.5px] border-strong bg-transparent px-5 py-2.5 text-[13px] font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main"
        >
          Ir al blog
        </Link>
      </div>
    </div>
  );
}

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
