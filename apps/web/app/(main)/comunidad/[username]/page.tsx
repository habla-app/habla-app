// /comunidad/[username] — perfil público mobile-first (Lote C v3.1,
// refactor del Lote 11). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-username.spec.md.
//
// Cambios vs Lote 11:
//   - Refactor visual mobile-first: layout vertical en lugar de row
//     desktop-only.
//   - Badge Premium si el tipster tiene suscripción activa.
//   - Botón "+ Seguir" como placeholder (modelo `Seguidor` posterga al
//     post-launch — decisión documentada en el reporte del lote).
//   - Cero columnas: hero → stats → últimas predicciones.
//
// JSON-LD `Person` se mantiene del Lote 11 (SEO).

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { obtenerPerfilPublico } from "@/lib/services/perfil-publico.service";
import { tienePremiumActivo } from "@/lib/services/suscripciones.service";
import type { PerfilPublicoVista } from "@/lib/services/perfil-publico.service";
import { PerfilPublicoHero } from "@/components/comunidad/PerfilPublicoHero";
import { PerfilPublicoStats } from "@/components/comunidad/PerfilPublicoStats";
import { UltimasPredicciones } from "@/components/comunidad/UltimasPredicciones";

interface Props {
  params: { username: string };
}

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: Props): Promise<Metadata> {
  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) {
    return {
      title: "Tipster no encontrado · Habla!",
      robots: { index: false },
    };
  }
  if (perfil.privacidad === "privado") {
    return {
      title: `@${perfil.username} · Habla!`,
      description: "Este tipster mantiene su perfil privado.",
      robots: { index: false },
    };
  }
  return {
    title: `@${perfil.username} — Tipster en Habla!`,
    description: `Stats y últimas predicciones de @${perfil.username}: ${perfil.stats.jugadas} predicciones · ${perfil.stats.aciertoPct}% de acierto.`,
    alternates: { canonical: `/comunidad/${perfil.username}` },
  };
}

export default async function PerfilPublicoPage({ params }: Props) {
  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) notFound();

  if (perfil.privacidad === "privado") {
    return <PerfilPrivado username={perfil.username} />;
  }

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const usuarioIdPerfil = await resolverUsuarioId(perfil.username);
  const esElMismoViewer =
    !!viewerId && !!usuarioIdPerfil && viewerId === usuarioIdPerfil;

  // Premium del tipster (no del viewer). En Lote C devuelve false siempre.
  const esPremium = usuarioIdPerfil
    ? await tienePremiumActivo(usuarioIdPerfil).catch(() => false)
    : false;

  return (
    <div className="space-y-2 pb-16">
      <PersonJsonLd perfil={perfil} />

      <PerfilPublicoHero
        username={perfil.username}
        nombre={perfil.nombre}
        desde={perfil.desde}
        nivel={perfil.nivel}
        esPremium={esPremium}
        esElMismoViewer={esElMismoViewer}
      />

      <PerfilPublicoStats
        stats={perfil.stats}
        mensual={perfil.mensual}
        nivelLabel={perfil.nivel.label}
      />

      <UltimasPredicciones tickets={perfil.ultimasFinalizadas} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PerfilPrivado({ username }: { username: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center md:py-24">
      <div aria-hidden className="mb-4 text-5xl">
        🔒
      </div>
      <h1 className="font-display text-display-md font-black leading-tight text-dark">
        @{username}
      </h1>
      <p className="mt-3 text-body-sm text-body">
        Este usuario tiene su perfil <strong>privado</strong>. No exponemos
        sus stats ni su historial de predicciones.
      </p>
      <Link
        href="/comunidad"
        className="touch-target mt-5 inline-flex items-center justify-center rounded-sm border border-strong bg-card px-4 py-2.5 text-label-md font-bold text-body hover:border-brand-blue-main hover:text-brand-blue-main"
      >
        ← Volver al leaderboard
      </Link>
    </div>
  );
}

function PersonJsonLd({ perfil }: { perfil: PerfilPublicoVista }) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
  const aggregateRating =
    perfil.stats.jugadas > 20
      ? {
          "@type": "AggregateRating",
          ratingValue: (perfil.stats.aciertoPct / 20).toFixed(2),
          ratingCount: perfil.stats.jugadas,
          bestRating: "5",
          worstRating: "0",
        }
      : undefined;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: `@${perfil.username}`,
    alternateName: perfil.nombre || `@${perfil.username}`,
    url: `${baseUrl}/comunidad/${perfil.username}`,
    description: `Tipster en Habla! · Nivel ${perfil.nivel.label} · ${perfil.stats.jugadas} predicciones realizadas.`,
    memberOf: {
      "@type": "Organization",
      name: "Habla!",
      url: baseUrl,
    },
  };
  if (aggregateRating) data.aggregateRating = aggregateRating;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

/**
 * Helper para resolver el `usuarioId` desde el username (case-insensitive).
 * El service `obtenerPerfilPublico` no expone el id (intencional, para que
 * el caller no lo filtre por accidente). Acá hacemos un lookup paralelo
 * solo para verificar identidad del viewer y consultar Premium.
 */
async function resolverUsuarioId(username: string): Promise<string | null> {
  const { prisma } = await import("@habla/db");
  const u = await prisma.usuario.findFirst({
    where: {
      username: { equals: username, mode: "insensitive" },
      deletedAt: null,
    },
    select: { id: true },
  });
  return u?.id ?? null;
}
