"use client";

// NavLinks — réplica de `.nav-links` del mockup (docs/habla-mockup-completo.html
// líneas 132-148, 1669-1675). Client Component para detectar ruta activa con
// usePathname. Oculto en mobile (<lg), el BottomNav toma ese rol.
//
// Lote 3 (Abr 2026): pivot editorial/comunidad. Items pasan a ser
// Inicio · Partidos · Pronósticos · Comunidad · Mis combinadas. La tienda
// y la billetera (que linkeaban a la economía interna) salieron del nav.
//
// Nota — Hotfix 19 Abr: el mockup HTML define el estado default como
// `color:var(--dark-muted)` (#7B93D0), que sobre el header navy
// `bg-dark-surface` (#001050) da contraste ~1.5:1, muy por debajo de
// WCAG AA (4.5:1). Priorizamos contraste sobre fidelidad literal al
// mockup y usamos `text-white/80` (11.4:1 sobre navy, AAA) con hover a
// blanco puro (`text-white`) + background tint, manteniendo la jerarquía
// visual original.
//
// Bug #12 (Hotfix #5): el contador del link "🔴 En vivo" ya no es un
// prop hardcoded de NavBar — ahora delegamos a `<LiveCountBadge>` que
// lee `useLiveMatchesCount()` con polling cada 30s y devuelve null si
// count===0. Si no hay partidos, NO aparece ningún globo rojo ni "0".
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LiveCountBadge } from "@/components/layout/LiveCountBadge";

interface NavLinkDef {
  href: string;
  label: string;
  hasLiveIndicator?: boolean;
  match: (pathname: string) => boolean;
}

const LINKS: NavLinkDef[] = [
  {
    href: "/",
    label: "Inicio",
    match: (p) => p === "/",
  },
  {
    href: "/matches",
    label: "Partidos",
    match: (p) =>
      p.startsWith("/matches") || p.startsWith("/torneo"),
  },
  {
    href: "/live-match",
    label: "En vivo",
    hasLiveIndicator: true,
    match: (p) => p.startsWith("/live-match"),
  },
  {
    href: "/pronosticos",
    label: "Pronósticos",
    match: (p) => p.startsWith("/pronosticos"),
  },
  {
    href: "/comunidad",
    label: "Comunidad",
    match: (p) => p.startsWith("/comunidad"),
  },
  {
    href: "/mis-combinadas",
    label: "Mis combinadas",
    match: (p) => p.startsWith("/mis-combinadas"),
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
            {link.hasLiveIndicator && (
              <span
                aria-hidden
                className="h-[7px] w-[7px] flex-shrink-0 animate-pulse-dot rounded-full bg-urgent-critical"
              />
            )}
            <span>{link.label}</span>
            {link.hasLiveIndicator && (
              <LiveCountBadge initialCount={initialLiveCount} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
