"use client";

// NavLinks — Lote 11 (May 2026). Pivot editorial.
//
// Simplificado a 5 items: Inicio · Pronósticos · Casas · Comunidad · Blog.
// Los items "Partidos", "En vivo" y "Mis combinadas" ya no aparecen en el
// nav desktop — el acceso a partidos vive en el BottomNav mobile (5 items
// del Lote 3) y en CTAs internos de la home y `/matches`. "En vivo" se
// reduce a un dot rojo discreto al lado de "Inicio" cuando hay partidos
// jugándose ahora; el link sigue accesible vía /live-match desde otros
// puntos de la UI (sidebar /matches, etc.) pero sin contar como un item
// del nav top.
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
    href: "/casas",
    label: "Casas",
    match: (p) => p.startsWith("/casas"),
  },
  {
    href: "/comunidad",
    label: "Comunidad",
    match: (p) => p.startsWith("/comunidad"),
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
