"use client";

// BottomNav — Lote S v3.2 · portación literal del `<nav class="bottom-nav">`
// del mockup (docs/habla-mockup-v3.2.html líneas 4788-4795).
//
// 6 items, con visibilidad por estado de auth:
//   - 🏠 Inicio       (siempre)
//   - 🎯 Fijas        (siempre)  → /las-fijas
//   - 🏆 Liga         (siempre)  → /liga
//   - 💎 Socios       (siempre)  → /socios
//   - 📚 Reviews      (visitor-only)     → /reviews-y-guias
//   - 👤 Perfil       (not-visitor-only) → /perfil
//
// Las clases CSS son las del mockup (.bottom-nav, .bn-item, .bn-icon,
// .bn-item.active) — definidas en mockup-styles.css por el Lote R. Cero
// Tailwind utility en este componente.
//
// El mockup muestra `.bottom-nav` con `display:none` y solo lo expone en
// mobile (≤767px) via media query — ver mockup-styles.css.
//
// El BottomNav se OCULTA en /auth/* y /admin/* (layouts propios) y en
// /socios/exito (post-pago, foco crítico) — comportamiento heredado.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";

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
    href: "/las-fijas",
    label: "Fijas",
    icon: "🎯",
    match: (p) =>
      p.startsWith("/las-fijas") ||
      p.startsWith("/cuotas") ||
      p.startsWith("/partidos"),
  },
  {
    href: "/liga",
    label: "Liga",
    icon: "🏆",
    match: (p) =>
      p.startsWith("/liga") ||
      p.startsWith("/jugador") ||
      p.startsWith("/comunidad") ||
      p.startsWith("/torneo"),
  },
  {
    href: "/socios",
    label: "Socios",
    icon: "💎",
    match: (p) => p.startsWith("/socios") || p.startsWith("/premium"),
  },
];

const ITEM_REVIEWS: Item = {
  href: "/reviews-y-guias",
  label: "Reviews",
  icon: "📚",
  match: (p) =>
    p.startsWith("/reviews-y-guias") ||
    p.startsWith("/casas") ||
    p.startsWith("/guias"),
};

const ITEM_PERFIL: Item = {
  href: "/perfil",
  label: "Perfil",
  icon: "👤",
  match: (p) => p.startsWith("/perfil"),
};

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/admin") ||
    pathname === "/socios/exito" ||
    pathname.startsWith("/socios/exito/") ||
    pathname === "/premium/exito" ||
    pathname.startsWith("/premium/exito/")
  ) {
    return null;
  }

  return (
    <nav className="bottom-nav" aria-label="Navegación móvil">
      {ITEMS.map((item) => {
        const isActive = item.match(pathname);
        return (
          <Link
            key={item.label}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "bn-item active" : "bn-item"}
          >
            <span className="bn-icon">{item.icon}</span> {item.label}
          </Link>
        );
      })}
      <AuthGate state="visitor">
        <Link
          href={ITEM_REVIEWS.href}
          aria-current={ITEM_REVIEWS.match(pathname) ? "page" : undefined}
          className={
            ITEM_REVIEWS.match(pathname)
              ? "bn-item visitor-only active"
              : "bn-item visitor-only"
          }
        >
          <span className="bn-icon">{ITEM_REVIEWS.icon}</span> {ITEM_REVIEWS.label}
        </Link>
      </AuthGate>
      <AuthGate not="visitor">
        <Link
          href={ITEM_PERFIL.href}
          aria-current={ITEM_PERFIL.match(pathname) ? "page" : undefined}
          className={
            ITEM_PERFIL.match(pathname)
              ? "bn-item not-visitor-only active"
              : "bn-item not-visitor-only"
          }
        >
          <span className="bn-icon">{ITEM_PERFIL.icon}</span> {ITEM_PERFIL.label}
        </Link>
      </AuthGate>
    </nav>
  );
}
