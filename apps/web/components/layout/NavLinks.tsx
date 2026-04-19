"use client";

// NavLinks — réplica de `.nav-links` del mockup (docs/habla-mockup-completo.html
// líneas 132-148, 1669-1675). Client Component para detectar ruta activa con
// usePathname. Oculto en mobile (<lg), el BottomNav toma ese rol.
//
// Orden exacto del mockup: Partidos · 🔴 En vivo (con live-count) ·
// Mis combinadas · Tienda · Billetera.
//
// Nota — Hotfix 19 Abr: el mockup HTML define el estado default como
// `color:var(--dark-muted)` (#7B93D0), que sobre el header navy
// `bg-dark-surface` (#001050) da contraste ~1.5:1, muy por debajo de
// WCAG AA (4.5:1). Priorizamos contraste sobre fidelidad literal al
// mockup y usamos `text-white/80` (11.4:1 sobre navy, AAA) con hover a
// blanco puro (`text-white`) + background tint, manteniendo la jerarquía
// visual original.
//
// Trampa conocida del design system (no fixeada en este hotfix — scope):
// los tokens nested `text-dark-text` / `text-dark-muted` no se generan
// como utilities porque `textColor.dark: "#001050"` (string flat) en
// tailwind.config colisiona con `colors.dark.*` y bloquea la expansión
// nested. Usar `text-white/N` donde haga falta color claro sobre dark
// surface; ver CLAUDE.md §14.
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
            data-testid={`nav-link-${link.href === "/" ? "partidos" : link.href.replace(/\//g, "")}`}
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
