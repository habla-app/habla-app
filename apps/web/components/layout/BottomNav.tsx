"use client";

// BottomNav v3.1 — pista usuario unificada (Lote B).
// Spec: docs/ux-spec/00-design-system/componentes-mobile.md §2 +
// docs/ux-spec/02-pista-usuario-publica/00-layout-y-nav.spec.md.
//
// 5 ítems oficiales del modelo v3.1: Inicio · Partidos · Liga · Premium ·
// Perfil. Sticky bottom, oculto >=lg (los desktops usan navegación top).
// Touch targets ≥44px (h-16). Detección de active path con `usePathname`.
// El ítem "Perfil" redirige a /auth/signin si no hay session, a /perfil
// si la hay — esto unifica la experiencia entre la capa pública y la
// autenticada (decisión arquitectónica del Lote B).
//
// Live indicator: dot rojo junto a "Inicio" si hay partido en vivo. La
// prop `liveDot` la propaga el layout server-side via consulta a
// live-matches.service. No polling client-side acá — el polling vive en
// el header desktop.
import Link from "next/link";
import { usePathname } from "next/navigation";

interface Item {
  href: string;
  label: string;
  icon: string;
  match: (pathname: string) => boolean;
}

const ITEMS_BASE: Item[] = [
  {
    href: "/",
    label: "Inicio",
    icon: "🏠",
    match: (p) => p === "/",
  },
  {
    href: "/cuotas",
    label: "Partidos",
    icon: "⚽",
    match: (p) =>
      p.startsWith("/cuotas") ||
      p.startsWith("/partidos") ||
      p.startsWith("/matches") ||
      p.startsWith("/live-match") ||
      p.startsWith("/pronosticos"),
  },
  {
    href: "/comunidad",
    label: "Liga",
    icon: "🏆",
    match: (p) =>
      p.startsWith("/comunidad") ||
      p.startsWith("/torneo") ||
      p.startsWith("/mis-predicciones") ||
      p.startsWith("/mis-combinadas"), // legacy, redirect 301 a /mis-predicciones
  },
  {
    href: "/premium",
    label: "Premium",
    icon: "💎",
    match: (p) => p.startsWith("/premium"),
  },
];

interface Props {
  /** Si hay partido en vivo se muestra el dot rojo junto a Inicio. */
  liveDot?: boolean;
  /** Si hay session, "Perfil" linkea a /perfil; si no, a /auth/signin. */
  isAuthenticated?: boolean;
}

export function BottomNav({ liveDot = false, isAuthenticated = false }: Props) {
  const pathname = usePathname() ?? "/";

  // Oculto en /auth/*, /admin/* y /premium/exito (tienen layouts propios o
  // foco crítico). El post-pago suprime BottomNav para que el CTA verde de
  // unirse al WhatsApp Channel sea la única acción visible.
  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname === "/premium/exito" ||
    pathname.startsWith("/premium/exito/")
  ) {
    return null;
  }

  const perfilItem: Item = {
    href: isAuthenticated ? "/perfil" : "/auth/signin?callbackUrl=/perfil",
    label: "Perfil",
    icon: "👤",
    match: (p) => p.startsWith("/perfil"),
  };

  const items = [...ITEMS_BASE, perfilItem];

  return (
    <nav
      aria-label="Navegación móvil"
      className="fixed inset-x-0 bottom-0 z-sticky flex border-t border-strong bg-card pb-[env(safe-area-inset-bottom)] pt-1.5 shadow-nav-top lg:hidden"
    >
      {items.map((item) => {
        const isActive = item.match(pathname);
        const showLiveDot = liveDot && item.href === "/";
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`touch-target relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-[3px] px-1 py-2 transition-colors duration-150 ${
              isActive ? "text-brand-gold-dark" : "text-muted-d"
            }`}
          >
            <span aria-hidden className="relative text-[22px] leading-none">
              {item.icon}
              {showLiveDot ? (
                <span
                  aria-hidden
                  className="absolute -right-1 -top-0.5 inline-block h-2 w-2 animate-pulse rounded-full bg-urgent-critical ring-2 ring-card"
                />
              ) : null}
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
