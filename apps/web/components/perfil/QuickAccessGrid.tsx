// QuickAccessGrid — mockup `.quick-access-grid` (línea 3930). 4 cards
// con ícono coloreado + label. Links a mis-combinadas, wallet, tienda,
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
    href: "/wallet",
    icon: "💰",
    bg: "bg-alert-success-bg",
    label: "Billetera",
  },
  {
    href: "/tienda",
    icon: "🎁",
    bg: "bg-[#FCE7F3]",
    label: "Tienda de premios",
  },
  {
    href: "/faq",
    icon: "❓",
    bg: "bg-accent-champions-bg",
    label: "Centro de ayuda",
  },
];

export function QuickAccessGrid() {
  return (
    <nav
      aria-label="Accesos rápidos"
      className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4"
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
