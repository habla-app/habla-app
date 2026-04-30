// QuickAccessGrid — mockup `.quick-access-grid` (línea 3930).
//
// Lote 11 (May 2026): 4 accesos rápidos (mockup pivot editorial):
//   - Mi link de referido (placeholder a Lote 13 — disabled).
//   - Mis predicciones → /mis-combinadas
//   - Newsletter → /perfil/preferencias  (anchor a la sección de toggles).
//   - Soporte → /ayuda/faq

import Link from "next/link";

const ITEMS: Array<{
  href: string;
  icon: string;
  bg: string;
  label: string;
  /** Si true, el card no es clickeable y muestra "Próximamente". */
  disabled?: boolean;
}> = [
  {
    href: "/perfil/referidos",
    icon: "🤝",
    bg: "bg-brand-blue-main/10",
    label: "Mi link de referido",
    disabled: true,
  },
  {
    href: "/mis-combinadas",
    icon: "🎯",
    bg: "bg-brand-gold-dim",
    label: "Mis predicciones",
  },
  {
    href: "/perfil#notificaciones",
    icon: "📬",
    bg: "bg-accent-mundial-bg",
    label: "Newsletter",
  },
  {
    href: "/ayuda/faq",
    icon: "❓",
    bg: "bg-accent-champions-bg",
    label: "Soporte",
  },
];

export function QuickAccessGrid() {
  return (
    <nav
      aria-label="Accesos rápidos"
      className="mb-7 grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {ITEMS.map((it) => {
        if (it.disabled) {
          return (
            <div
              key={it.href}
              className="flex cursor-not-allowed flex-col items-center gap-2 rounded-md border border-light bg-card p-4 text-center opacity-60 shadow-sm"
              aria-disabled="true"
              title="Próximamente"
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
              <span className="rounded-full bg-subtle px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-muted-d">
                Próximamente
              </span>
            </div>
          );
        }
        return (
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
        );
      })}
    </nav>
  );
}
