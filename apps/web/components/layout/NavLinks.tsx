"use client";

// NavLinks — Lote S v3.2 · portación literal del `<nav class="nav-links">`
// del mockup (docs/habla-mockup-v3.2.html líneas 2137-2143).
//
// Los 5 items son EXACTAMENTE los del mockup, en este orden y con estos
// labels (incluyendo "La Liga Habla!" con ! y "Reviews y Guías" con G
// mayúscula). El active state se calcula via usePathname y se aplica como
// `nav-link active` (clase del mockup).
//
// El mockup oculta `.nav-links` en mobile (<767px) vía CSS — ver
// mockup-styles.css del Lote R. En mobile se navega vía bottom-nav.
//
// Cero Tailwind utility classes en este componente. Solo `nav-link` /
// `nav-link active` del mockup.

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkDef {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

const LINKS: NavLinkDef[] = [
  {
    href: "/",
    label: "Inicio",
    match: (p) => p === "/",
  },
  {
    href: "/las-fijas",
    label: "Las Fijas",
    match: (p) =>
      p.startsWith("/las-fijas") ||
      p.startsWith("/cuotas") ||
      p.startsWith("/partidos"),
  },
  {
    href: "/liga",
    label: "La Liga Habla!",
    match: (p) =>
      p.startsWith("/liga") ||
      p.startsWith("/jugador") ||
      p.startsWith("/comunidad") ||
      p.startsWith("/torneo"),
  },
  {
    href: "/socios",
    label: "Socios",
    match: (p) => p.startsWith("/socios") || p.startsWith("/premium"),
  },
  {
    href: "/reviews-y-guias",
    label: "Reviews y Guías",
    match: (p) =>
      p.startsWith("/reviews-y-guias") ||
      p.startsWith("/casas") ||
      p.startsWith("/guias"),
  },
];

export function NavLinks() {
  const pathname = usePathname() ?? "/";

  return (
    <nav className="nav-links">
      {LINKS.map((link) => {
        const isActive = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "nav-link active" : "nav-link"}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
