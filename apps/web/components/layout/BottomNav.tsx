"use client";

// BottomNav — navegación fija solo en mobile (<1000px) con 5 items. Según
// mockup v5: bg-card (light) con border-strong arriba y sombra hacia arriba.
// Cada item es un Link real (route-based, no state-based).
//
// Algunas rutas (/live-match, /mis-combinadas) llegan en Sub-Sprints
// posteriores — hasta entonces apuntan a `/` para no romper la navegación.
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
    label: "Partidos",
    icon: "⚽",
    match: (p) => p === "/" || p.startsWith("/matches") || p.startsWith("/torneo"),
  },
  {
    href: "/live-match",
    label: "En vivo",
    icon: "🔴",
    match: (p) => p.startsWith("/live-match"),
  },
  {
    href: "/mis-combinadas",
    label: "Tickets",
    icon: "🎯",
    match: (p) => p.startsWith("/mis-combinadas"),
  },
  {
    href: "/tienda",
    label: "Tienda",
    icon: "🎁",
    match: (p) => p.startsWith("/tienda"),
  },
  {
    href: "/wallet",
    label: "Wallet",
    icon: "🪙",
    match: (p) => p.startsWith("/wallet"),
  },
];

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-strong bg-card pb-2 pt-1.5 shadow-nav-top md:hidden"
    >
      {ITEMS.map((item) => {
        const isActive = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-[3px] px-1 py-2 transition-colors ${
              isActive ? "text-brand-gold-dark" : "text-muted-d"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            <span aria-hidden className="text-[22px] leading-none">
              {item.icon}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
