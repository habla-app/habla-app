"use client";
// CatFilters — chips de categoría para /tienda (mockup `.cat-filters .cat-chip`).
// URL-state via ?categoria=. Emojis según mockup.

import { useRouter, useSearchParams } from "next/navigation";
import type { CategoriaPremio } from "@/lib/services/premios.service";

const CATEGORIAS: { slug: string; label: string; emoji: string }[] = [
  { slug: "", label: "Todos", emoji: "✨" },
  { slug: "ENTRADA", label: "Entradas", emoji: "🎟️" },
  { slug: "CAMISETA", label: "Camisetas", emoji: "👕" },
  { slug: "GIFT", label: "Gift Cards", emoji: "💳" },
  { slug: "TECH", label: "Tech", emoji: "💻" },
  { slug: "EXPERIENCIA", label: "Experiencias", emoji: "🎉" },
];

export function CatFilters({
  activa,
}: {
  activa: CategoriaPremio | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setCat(slug: string) {
    const sp = new URLSearchParams(searchParams?.toString() ?? "");
    if (slug) {
      sp.set("categoria", slug);
    } else {
      sp.delete("categoria");
    }
    router.replace(`/tienda${sp.toString() ? `?${sp.toString()}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <div
      role="toolbar"
      aria-label="Filtrar por categoría"
      className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CATEGORIAS.map((cat) => {
        const active = (activa ?? "") === cat.slug;
        const base =
          "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] transition whitespace-nowrap";
        const variant = active
          ? "bg-brand-gold text-black font-bold border border-brand-gold shadow-gold"
          : "border border-light bg-card font-semibold text-muted-d shadow-sm hover:bg-chip-hover hover:text-brand-gold-dark hover:border-brand-gold";
        return (
          <button
            key={cat.slug || "all"}
            type="button"
            onClick={() => setCat(cat.slug)}
            aria-pressed={active}
            className={`${base} ${variant}`}
            data-testid={`cat-chip-${cat.slug || "todos"}`}
          >
            <span aria-hidden className="text-[15px]">
              {cat.emoji}
            </span>
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
