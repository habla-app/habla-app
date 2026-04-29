"use client";

// PublicNavLinks — Lote 8.
//
// Links del header público. Mismo lenguaje visual que `NavLinks` del
// NavBar logueado (token de contraste WCAG AA, hover tint). En mobile
// se compactan en un menú hamburguesa simple (details/summary nativo,
// cero JS extra) — el público no es la pantalla principal en mobile,
// pero queremos que igual se pueda navegar entre pages.

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLinkDef {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
}

const LINKS: NavLinkDef[] = [
  { href: "/blog", label: "Blog", match: (p) => p.startsWith("/blog") },
  { href: "/casas", label: "Casas", match: (p) => p.startsWith("/casas") },
  { href: "/guias", label: "Guías", match: (p) => p.startsWith("/guias") },
  {
    href: "/pronosticos",
    label: "Pronósticos",
    match: (p) => p.startsWith("/pronosticos"),
  },
  { href: "/cuotas", label: "Cuotas", match: (p) => p.startsWith("/cuotas") },
  {
    href: "/comunidad",
    label: "Comunidad",
    match: (p) => p.startsWith("/comunidad"),
  },
];

const INACTIVE = "text-white/80 hover:bg-white/[0.06] hover:text-white";
const ACTIVE = "bg-brand-gold-dim text-brand-gold";

export function PublicNavLinks() {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {/* Desktop */}
      <nav
        className="hidden items-center gap-0.5 lg:flex"
        aria-label="Pública principal"
      >
        {LINKS.map((link) => {
          const isActive = link.match(pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`rounded-sm px-4 py-[9px] text-[13px] font-semibold transition-colors duration-150 ${
                isActive ? ACTIVE : INACTIVE
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: details/summary (sin JS extra) */}
      <details className="relative lg:hidden">
        <summary
          aria-label="Menú"
          className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-sm text-white/80 hover:bg-white/[0.06] hover:text-white"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </summary>
        <nav
          className="absolute left-0 top-full z-[101] mt-1 w-[200px] overflow-hidden rounded-md border border-dark-border bg-dark-surface shadow-lg"
          aria-label="Pública principal mobile"
        >
          {LINKS.map((link) => {
            const isActive = link.match(pathname);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`block px-4 py-2.5 text-[14px] font-semibold ${
                  isActive
                    ? "bg-brand-gold-dim text-brand-gold"
                    : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </details>
    </>
  );
}
