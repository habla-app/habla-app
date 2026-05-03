// /reviews-y-guias — Lote N v3.2 · portación literal del
// `<section id="page-reviews">` del mockup
// (docs/habla-mockup-v3.2.html líneas 3904-4182).
//
// Hub unificado con tabs Reviews / Guías. Tabs interactivas client-side
// vía <ReviewsYGuiasTabs>. Datos vienen de:
//   - lib/content/casas (.mdx + Afiliado en BD)
//   - lib/content/guias (.mdx)
//
// Cero clases Tailwind utility — todo el CSS sale de mockup-styles.css.

import type { Metadata } from "next";
import * as casas from "@/lib/content/casas";
import * as guias from "@/lib/content/guias";
import {
  ReviewsYGuiasTabs,
  type CasaItem,
  type GuiaItem,
} from "@/components/reviews-y-guias/ReviewsYGuiasTabs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Reviews y Guías · Habla!",
  description:
    "Reviews editoriales de casas autorizadas MINCETUR + guías para apostar con criterio. Todo en un solo lugar.",
  alternates: { canonical: "/reviews-y-guias" },
  openGraph: {
    title: "Reviews y Guías | Habla!",
    description:
      "Reviews de casas + guías editoriales para empezar y mejorar tus apuestas.",
  },
};

const METODO_PAGO_MAP: Record<string, { code: string; color: string; textColor?: string }> = {
  visa: { code: "VI", color: "#1A1F71" },
  mastercard: { code: "MC", color: "#FF7A00" },
  yape: { code: "YP", color: "#742283" },
  plin: { code: "PL", color: "#0066CC" },
  efectivo: { code: "$", color: "#FFB800", textColor: "#000" },
  bcp: { code: "BC", color: "#005CAB" },
  bbva: { code: "BB", color: "#072146" },
  interbank: { code: "IB", color: "#0BA94F" },
};

function siglaCasa(slug: string, nombre: string): string {
  const s = slug.toLowerCase();
  if (s.includes("betsson")) return "BS";
  if (s.includes("betano")) return "BT";
  if (s.includes("1xbet")) return "1X";
  if (s.includes("coolbet")) return "CB";
  if (s.includes("doradobet")) return "DR";
  if (s.includes("te-apuesto")) return "TA";
  return nombre.slice(0, 2).toUpperCase();
}

function colorCasa(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes("betsson")) return "#0EA5E9";
  if (s.includes("betano")) return "#DC2626";
  if (s.includes("1xbet")) return "#FF7A00";
  if (s.includes("coolbet")) return "#059669";
  if (s.includes("doradobet")) return "#0A2080";
  if (s.includes("te-apuesto")) return "#DC2626";
  return "#0A2080";
}

function cuotasRating(rating: number | null): { label: string; tone: "green" | "orange" | "red" } {
  if (rating === null) return { label: "Sin datos", tone: "orange" };
  if (rating >= 4.4) return { label: "Buenas", tone: "green" };
  if (rating >= 4.0) return { label: "Promedio", tone: "orange" };
  return { label: "Bajas", tone: "red" };
}

function emojiGuia(tags: string[]): { emoji: string; gradient?: string } {
  const t = tags.map((x) => x.toLowerCase()).join(" ");
  if (t.includes("bankroll")) return { emoji: "💰", gradient: "linear-gradient(135deg,#FFB800,#FF8C00)" };
  if (t.includes("liga 1") || t.includes("perú") || t.includes("peru"))
    return { emoji: "🇵🇪", gradient: "linear-gradient(135deg,#059669,#10B981)" };
  if (t.includes("beginners") || t.includes("primera"))
    return { emoji: "🎯", gradient: "linear-gradient(135deg,#DC2626,#EF4444)" };
  if (t.includes("btts") || t.includes("ambos anotan"))
    return { emoji: "📚", gradient: "linear-gradient(135deg,#742283,#9333EA)" };
  if (t.includes("casas"))
    return { emoji: "🏠", gradient: "linear-gradient(135deg,#0EA5E9,#3B82F6)" };
  return { emoji: "📊" };
}

function leerEnMin(body: string): number {
  const palabras = body.split(/\s+/).length;
  return Math.max(2, Math.round(palabras / 220));
}

function tagPrincipal(tags: string[]): string {
  const t = tags.map((x) => x.toLowerCase());
  if (t.some((x) => x.includes("bankroll"))) return "Bankroll";
  if (t.some((x) => x.includes("mercado"))) return "Mercados";
  if (t.some((x) => x.includes("casa"))) return "Casas";
  if (t.some((x) => x.includes("estrategia"))) return "Estrategia";
  if (t.some((x) => x.includes("beginners") || x.includes("principiante"))) return "Beginners";
  return tags[0] ?? "Estrategia";
}

export default async function ReviewsYGuiasPage() {
  const reviewsActivas = await casas.getActivas().catch(() => []);
  const guiasAll = guias.getAll();

  const casasItems: CasaItem[] = reviewsActivas.map((r) => {
    const af = r.afiliado!;
    const ratingNum = af.rating !== null ? Number(af.rating) : null;
    const metodos = (af.metodosPago ?? []).map((m) => {
      const key = m.toLowerCase();
      const cfg = METODO_PAGO_MAP[key] ?? {
        code: m.slice(0, 2).toUpperCase(),
        color: "#0A2080",
      };
      return { code: cfg.code, label: m, color: cfg.color, textColor: cfg.textColor };
    });
    return {
      slug: r.doc.frontmatter.slug,
      nombre: af.nombre,
      rating: ratingNum,
      bonoActual: af.bonoActual,
      metodosPago: metodos,
      cuotasRating: cuotasRating(ratingNum),
      mincetur: af.autorizadoMincetur,
      logoSigla: siglaCasa(af.slug, af.nombre),
      logoColor: colorCasa(af.slug),
      reviewSlug: `/reviews-y-guias/casas/${r.doc.frontmatter.slug}`,
      irHref: `/go/${af.slug}`,
    };
  });

  const guiasItems: GuiaItem[] = guiasAll.map((d) => {
    const meta = emojiGuia(d.frontmatter.tags ?? []);
    return {
      slug: d.frontmatter.slug,
      title: d.frontmatter.title,
      excerpt: d.frontmatter.excerpt,
      publishedAt: d.frontmatter.publishedAt,
      tag: tagPrincipal(d.frontmatter.tags ?? []),
      emoji: meta.emoji,
      gradient: meta.gradient,
      leerEnMin: leerEnMin(d.body),
    };
  });

  const tagsBase = ["Todas", "Bankroll", "Mercados", "Casas", "Estrategia", "Beginners"];

  return (
    <div className="container">
      <div className="page-title">Reviews y Guías</div>
      <div className="page-subtitle">Casas autorizadas MINCETUR · Guías para apostar mejor</div>

      <ReviewsYGuiasTabs
        casas={casasItems}
        guias={guiasItems}
        tagsGuias={tagsBase}
      />

      <p style={{ fontSize: 11, color: "var(--text-muted-d)", margin: "24px 0 0", textAlign: "center", lineHeight: 1.5 }}>
        Apuesta responsable. Solo +18. Línea Tugar (gratuita): 0800-19009.
      </p>
    </div>
  );
}
