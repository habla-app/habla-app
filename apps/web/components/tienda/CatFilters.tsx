// CatFilters — chips de categoría para /tienda. Sub-Sprint 6.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CategoriaPremio } from "@/lib/services/premios.service";

const CATEGORIAS: { slug: string; label: string; emoji: string }[] = [
  { slug: "", label: "Todos", emoji: "🎁" },
  { slug: "ENTRADA", label: "Entradas", emoji: "🎟️" },
  { slug: "CAMISETA", label: "Camisetas", emoji: "👕" },
  { slug: "GIFT", label: "Gift Cards", emoji: "🎁" },
  { slug: "TECH", label: "Tech", emoji: "🎧" },
  { slug: "EXPERIENCIA", label: "Experiencias", emoji: "✨" },
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
      className="flex flex-wrap gap-2"
    >
      {CATEGORIAS.map((cat) => {
        const active = (activa ?? "") === cat.slug;
        return (
          <button
            key={cat.slug || "all"}
            type="button"
            onClick={() => setCat(cat.slug)}
            className={`rounded-full px-4 py-2 text-[13px] font-bold transition-colors ${
              active
                ? "bg-brand-gold text-dark shadow-gold-btn"
                : "border border-light bg-card text-body hover:bg-chip-hover"
            }`}
            data-testid={`cat-chip-${cat.slug || "todos"}`}
          >
            <span className="mr-1">{cat.emoji}</span>
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}
