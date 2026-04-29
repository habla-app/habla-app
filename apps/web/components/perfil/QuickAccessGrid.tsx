// QuickAccessGrid — mockup `.quick-access-grid` (línea 3930). Cards con
// ícono coloreado + label.
//
// Lote 3 (Abr 2026): se retiraron los accesos a /wallet (sistema demolido
// en Lote 2) y /tienda (demolido en Lote 3). Quedan los dos accesos que
// siguen vigentes en el modelo editorial/comunidad: mis combinadas y
// centro de ayuda.

import Link from "next/link";

const ITEMS: Array<{
  href: string;
  icon: string;
  bg: string;
  label: string;
}> = [
  {
    href: "/mis-combinadas",
    icon: "🎯",
    bg: "bg-brand-gold-dim",
    label: "Mis combinadas",
  },
  {
    href: "/ayuda/faq",
    icon: "❓",
    bg: "bg-accent-champions-bg",
    label: "Centro de ayuda",
  },
];

export function QuickAccessGrid() {
  return (
    <nav
      aria-label="Accesos rápidos"
      className="mb-7 grid grid-cols-2 gap-3"
    >
      {ITEMS.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className="flex flex-col items-center gap-2 rounded-md border border-light bg-card p-4 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-md"
        >
          <span
            aria-hidden
            className={`flex h-12 w-12 items-center justify-center rounded-sm text-[22px] ${it.bg}`}
          >
            {it.icon}
          </span>
          <span className="text-xs font-bold leading-[1.3] text-dark">
            {it.label}
          </span>
        </Link>
      ))}
    </nav>
  );
}
