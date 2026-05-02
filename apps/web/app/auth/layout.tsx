// Auth layout — Lote B v3.1.
// Spec: docs/ux-spec/02-pista-usuario-publica/auth.spec.md.
//
// Background gradient sutil navy con acento dorado en esquina superior
// derecha. Logo centrado arriba. Container centrado max-width 460px,
// padding lateral generoso en mobile. Layout aislado: sin BottomNav ni
// Footer global (auth no debe distraer al usuario del flujo).

import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-brand-blue-dark via-[#001550] to-[#000420] px-4 py-8 md:py-12">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-gold/15 blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-brand-blue-light/20 blur-3xl"
      />

      <Link
        href="/"
        aria-label="Habla! inicio"
        className="relative mb-6 flex items-center gap-2.5 font-display text-display-md font-black leading-none text-white md:text-display-lg"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-radial text-base font-black text-black shadow-gold"
        >
          ⊕
        </span>
        <span>Habla!</span>
      </Link>

      <div className="relative w-full max-w-[460px]">{children}</div>
    </div>
  );
}
