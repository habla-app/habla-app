"use client";

// Nav links del header (desktop). Client Component para detectar ruta activa
// con usePathname. Se oculta en mobile y se reemplaza por el BottomNav.
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  hasLiveCount?: boolean;
  match: (pathname: string) => boolean;
}

const LINKS: NavLink[] = [
  {
    href: "/",
    label: "Partidos",
    match: (p) => p === "/" || p.startsWith("/matches") || p.startsWith("/torneo"),
  },
  {
    href: "/live-match",
    label: "En vivo",
    hasLiveCount: true,
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

// Placeholder hasta Sprint 5 (poller de partidos en vivo). Cuando
// exista `/live/matches` en el backend, reemplazar por fetch real.
const LIVE_COUNT_PLACEHOLDER = 2;

export function NavLinks() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="hidden items-center gap-0.5 md:flex" aria-label="Principal">
      {LINKS.map((link) => {
        const isActive = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-1.5 rounded-sm px-4 py-2.5 text-[13px] font-semibold transition-colors ${
              isActive
                ? "bg-brand-gold-dim text-brand-gold"
                : "text-dark-muted hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {link.hasLiveCount && (
              <span
                aria-hidden
                className="h-[7px] w-[7px] flex-shrink-0 animate-pulse-dot rounded-full bg-urgent-critical"
              />
            )}
            <span>
              {link.hasLiveCount ? <span aria-hidden>🔴 </span> : null}
              {link.label}
            </span>
            {link.hasLiveCount && LIVE_COUNT_PLACEHOLDER > 0 && (
              <span className="animate-live-pulse rounded-full bg-urgent-critical px-[7px] py-[2px] text-[10px] font-extrabold leading-none text-white">
                {LIVE_COUNT_PLACEHOLDER}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
