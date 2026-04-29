"use client";

// BottomNav — réplica de `.bottom-nav` + `.bn-item` del mockup
// (docs/habla-mockup-completo.html líneas 1537-1541, 4332-4339). Light bg,
// 5 items route-based. Visible solo en mobile/tablet (<lg en Tailwind ≈
// 1024px, suficientemente cerca del 1000px del mockup).
//
// Lote 3 (Abr 2026): pivot editorial/comunidad. Los items ahora son
// Inicio · Partidos · Pronósticos · Comunidad · Perfil. Pronósticos y
// Comunidad apuntan a placeholders "Próximamente" — se construyen en
// lotes posteriores. Los íconos, color activo (`text-brand-gold-dark`),
// transición y spacing son los mismos del mockup.
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Inicio",
    icon: "🏠",
    match: (p) => p === "/",
  },
  {
    href: "/matches",
    label: "Partidos",
    icon: "⚽",
    match: (p) =>
      p.startsWith("/matches") ||
      p.startsWith("/torneo") ||
      p.startsWith("/live-match") ||
      p.startsWith("/mis-combinadas"),
  },
  {
    href: "/pronosticos",
    label: "Pronósticos",
    icon: "🎯",
    match: (p) => p.startsWith("/pronosticos"),
  },
  {
    href: "/comunidad",
    label: "Comunidad",
    icon: "💬",
    match: (p) => p.startsWith("/comunidad"),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: "👤",
    match: (p) => p.startsWith("/perfil"),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  // Oculto en /auth/* y /admin/* (tienen layouts propios sin bottom-nav).
  if (pathname.startsWith("/auth") || pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-[100] flex border-t border-strong bg-card pb-2 pt-1.5 shadow-nav-top lg:hidden"
    >
      {ITEMS.map((item) => {
        const isActive = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex flex-1 flex-col items-center gap-[3px] px-1 py-2 transition-colors duration-150 ${
              isActive ? "text-brand-gold-dark" : "text-muted-d"
            }`}
          >
            <span aria-hidden className="text-[22px] leading-none">
              {item.icon}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.03em]">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
