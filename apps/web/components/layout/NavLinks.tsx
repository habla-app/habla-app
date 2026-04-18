"use client";

// NavLinks — réplica de `.nav-links` del mockup (docs/habla-mockup-completo.html
// líneas 132-148, 1669-1675). Client Component para detectar ruta activa con
// usePathname. Oculto en mobile (<lg), el BottomNav toma ese rol.
//
// Orden exacto del mockup: Partidos · 🔴 En vivo (con live-count) ·
// Mis combinadas · Tienda · Billetera.
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkDef {
  href: string;
  label: string;
  hasLiveIndicator?: boolean;
  match: (pathname: string) => boolean;
}

const LINKS: NavLinkDef[] = [
  {
    href: "/",
    label: "Partidos",
    match: (p) =>
      p === "/" || p.startsWith("/matches") || p.startsWith("/torneo"),
  },
  {
    href: "/live-match",
    label: "En vivo",
    hasLiveIndicator: true,
    match: (p) => p.startsWith("/live-match"),
  },
  {
    href: "/mis-combinadas",
    label: "Mis combinadas",
    match: (p) => p.startsWith("/mis-combinadas"),
  },
  {
    href: "/tienda",
    label: "Tienda",
    match: (p) => p.startsWith("/tienda"),
  },
  {
    href: "/wallet",
    label: "Billetera",
    match: (p) => p.startsWith("/wallet"),
  },
];

interface NavLinksProps {
  /**
   * Cantidad de partidos en vivo actualmente — va en el badge .live-count.
   * Placeholder hasta Sub-Sprint 5 (poller de partidos). Si 0, el badge no
   * se muestra.
   */
  liveCount?: number;
}

export function NavLinks({ liveCount = 0 }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
      {LINKS.map((link) => {
        const isActive = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-sm px-4 py-[9px] text-[13px] font-semibold transition-colors duration-150 ${
              isActive
                ? "bg-brand-gold-dim text-brand-gold"
                : "text-dark-muted hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {link.hasLiveIndicator && (
              <span
                aria-hidden
                className="h-[7px] w-[7px] flex-shrink-0 animate-pulse-dot rounded-full bg-urgent-critical"
              />
            )}
            <span>{link.label}</span>
            {link.hasLiveIndicator && liveCount > 0 && (
              <span className="animate-live-pulse rounded-full bg-urgent-critical px-[7px] py-[2px] text-[10px] font-extrabold leading-none text-white">
                {liveCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
