// Auth layout — fondo light bg-page, logo-mark + wordmark arriba, contenido
// centrado. Standalone: sin NavBar ni BottomNav, por eso no hereda de (main).
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-4 py-10">
      <Link
        href="/"
        aria-label="Habla! inicio"
        className="mb-8 flex items-center gap-2.5 font-display text-[30px] font-black leading-none text-dark"
      >
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-radial text-base font-black text-black shadow-gold"
        >
          ⊕
        </span>
        <span>Habla!</span>
      </Link>
      {children}
    </div>
  );
}
