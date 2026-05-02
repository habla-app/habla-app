"use client";

// NavLinks — Lote 11 (May 2026) → Lote K v3.2 rebrand.
//
// Lote K v3.2: rebrand de URLs de pista usuario.
//   /casas      → /reviews-y-guias/casas (+ tab guías).
//   /comunidad  → /liga.
// Resto sin cambio. El match prefix sigue catchando los paths viejos
// para preservar active state durante el redirect 301.
//
// Contraste WCAG AA: hereda de la versión anterior (text-white/80 sobre
// navy `bg-dark-surface`), corregido para no usar el `--dark-muted` del
// mockup (ratio ~1.5:1).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveCountBadge } from "@/components/layout/LiveCountBadge";

interface NavLinkDef {
  href: string;
  label: string;
  /** Si true, dibuja un dot rojo pulsante junto al label cuando hay
   *  partidos en vivo (count > 0). El conteo viene de SSR vía
   *  `contarLiveMatches()` y se refresca client-side cada 30s. */
  hasLiveDot?: boolean;
  match: (pathname: string) => boolean;
}

const LINKS: NavLinkDef[] = [
  {
    href: "/",
    label: "Inicio",
    hasLiveDot: true,
    match: (p) => p === "/",
  },
  {
    href: "/pronosticos",
    label: "Pronósticos",
    match: (p) => p.startsWith("/pronosticos"),
  },
  {
    href: "/reviews-y-guias",
    label: "Reviews y guías",
    match: (p) =>
      p.startsWith("/reviews-y-guias") ||
      p.startsWith("/casas") ||
      p.startsWith("/guias"),
  },
  {
    href: "/liga",
    label: "Liga",
    match: (p) =>
      p.startsWith("/liga") ||
      p.startsWith("/jugador") ||
      p.startsWith("/comunidad") ||
      p.startsWith("/torneo"),
  },
  {
    href: "/blog",
    label: "Blog",
    match: (p) => p.startsWith("/blog"),
  },
];

/**
 * Clases para el estado inactivo (default) de un nav link. Exportadas para
 * poder cubrirlas con tests de regresión — cualquier rollback a un token
 * de bajo contraste sobre `bg-dark-surface` debe reventar el suite.
 */
export const NAV_LINK_INACTIVE_CLASSES =
  "text-white/80 hover:bg-white/[0.06] hover:text-white";

/** Clases para el estado activo (ruta actual). */
export const NAV_LINK_ACTIVE_CLASSES = "bg-brand-gold-dim text-brand-gold";

interface NavLinksProps {
  /**
   * Cantidad inicial de partidos en vivo (del SSR, via `contarLiveMatches`
   * en NavBar). El LiveCountBadge usa este valor para su primer paint y
   * luego polea `/api/v1/live/count` cada 30s.
   */
  initialLiveCount?: number;
}

export function NavLinks({ initialLiveCount = 0 }: NavLinksProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Principal">
      {LINKS.map((link) => {
        const isActive = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            data-testid={`nav-link-${link.href === "/" ? "inicio" : link.href.replace(/\//g, "")}`}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-sm px-4 py-[9px] text-[13px] font-semibold transition-colors duration-150 ${
              isActive ? NAV_LINK_ACTIVE_CLASSES : NAV_LINK_INACTIVE_CLASSES
            }`}
          >
            {link.hasLiveDot && initialLiveCount > 0 && (
              <span
                aria-hidden
                className="h-[7px] w-[7px] flex-shrink-0 animate-pulse-dot rounded-full bg-urgent-critical"
              />
            )}
            <span>{link.label}</span>
            {link.hasLiveDot && (
              <LiveCountBadge initialCount={initialLiveCount} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
