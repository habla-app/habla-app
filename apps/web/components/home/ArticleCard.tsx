// ArticleCard — Lote 11.
//
// Card compacta para mostrar un artículo de blog/guía en listings de la
// home. Usa el frontmatter del LoadedDoc cargado por `lib/content/articles.ts`
// (Lote 8). Si hay `ogImage`, lo usa como cover; si no, fallback con
// gradient + emoji por categoría.

import Link from "next/link";
import type { ArticleFrontmatter, LoadedDoc } from "@/lib/content/types";

interface Props {
  doc: LoadedDoc<ArticleFrontmatter>;
  /** Base de URL — default `/blog`. Para guías pasaría `/guias`. */
  base?: string;
}

const CATEGORIA_EMOJI: Record<string, string> = {
  blog: "📰",
  guia: "📚",
  analisis: "🔍",
  pronostico: "🎯",
};

const CATEGORIA_GRADIENT: Record<string, string> = {
  blog: "from-brand-blue-main to-brand-blue-dark",
  guia: "from-brand-gold to-[#FF8C00]",
  analisis: "from-accent-mundial to-purple-700",
  pronostico: "from-brand-green to-emerald-700",
};

export function ArticleCard({ doc, base = "/blog" }: Props) {
  const fm = doc.frontmatter;
  const cat = fm.categoria ?? "blog";
  const tag = fm.tags[0] ?? cat;
  const fechaPub = formatFechaCorta(fm.publishedAt);

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link
        href={`${base}/${fm.slug}`}
        className="flex h-full flex-col"
      >
        <CoverImage ogImage={fm.ogImage} categoria={cat} title={fm.title} />

        <div className="flex flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
            <span className="rounded-sm bg-subtle px-2 py-0.5 text-brand-blue-main">
              {tag}
            </span>
            <span>·</span>
            <span>{fechaPub}</span>
          </div>
          <h3 className="font-display text-[18px] font-black leading-tight text-dark">
            {fm.title}
          </h3>
          <p className="line-clamp-2 text-[13px] leading-[1.5] text-body">
            {fm.excerpt}
          </p>
          <span className="mt-auto pt-1 text-[12px] font-bold text-brand-blue-main">
            Leer →
          </span>
        </div>
      </Link>
    </article>
  );
}

function CoverImage({
  ogImage,
  categoria,
  title,
}: {
  ogImage?: string;
  categoria: string;
  title: string;
}) {
  if (ogImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={ogImage}
        alt={title}
        loading="lazy"
        decoding="async"
        // Lote I: width/height explícitos para reservar espacio antes de
        // que cargue el bitmap. Evita CLS (token CWV target <0.1).
        // Aspect ratio 16:10 — coincide con `h-40 w-full` de Tailwind
        // cuando el container tiene 256px de ancho (común en grid 3-col).
        width={400}
        height={160}
        className="h-40 w-full object-cover"
      />
    );
  }
  const emoji = CATEGORIA_EMOJI[categoria] ?? "📰";
  const gradient = CATEGORIA_GRADIENT[categoria] ?? CATEGORIA_GRADIENT.blog;
  return (
    <div
      aria-hidden
      className={`flex h-40 w-full items-center justify-center bg-gradient-to-br text-[60px] text-white/40 ${gradient}`}
    >
      {emoji}
    </div>
  );
}

function formatFechaCorta(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const d = new Date(t);
  return d.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
