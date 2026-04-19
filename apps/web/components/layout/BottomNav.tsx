"use client";

// BottomNav — réplica de `.bottom-nav` + `.bn-item` del mockup
// (docs/habla-mockup-completo.html líneas 1537-1541, 4332-4339). Light bg,
// 5 items route-based. Visible solo en mobile/tablet (<lg en Tailwind ≈
// 1024px, suficientemente cerca del 1000px del mockup).
//
// Bug #12 (Hotfix #5): el item "🔴 En vivo" ahora renderea el
// `<LiveCountBadge>` como overlay absoluto sobre el icono; si no hay
// partidos en vivo, el badge devuelve null y no aparece nada (antes el
// NavBar mostraba "2" hardcoded aunque no hubiera nada).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveCountBadge } from "@/components/layout/LiveCountBadge";

interface Item {
  href: string;
  label: string;
  icon: string;
  hasLiveIndicator?: boolean;
  match: (pathname: string) => boolean;
}

const ITEMS: Item[] = [
  {
    href: "/",
    label: "Partidos",
    icon: "⚽",
    match: (p) =>
      p === "/" || p.startsWith("/matches") || p.startsWith("/torneo"),
  },
  {
    href: "/live-match",
    label: "En vivo",
    icon: "🔴",
    hasLiveIndicator: true,
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

interface Props {
  /** Count del SSR (del layout, via contarLiveMatches). 0 default. */
  initialLiveCount?: number;
}

export function BottomNav({ initialLiveCount = 0 }: Props) {
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
            <span className="relative inline-flex">
              <span aria-hidden className="text-[22px] leading-none">
                {item.icon}
              </span>
              {item.hasLiveIndicator && (
                <LiveCountBadge
                  initialCount={initialLiveCount}
                  variant="mobile"
                />
              )}
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
