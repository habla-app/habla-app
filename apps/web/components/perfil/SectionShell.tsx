// SectionShell — contenedor `.profile-section` del mockup: borde, header
// con ícono coloreado + títulos + badge opcional, children debajo.
//
// Los paneles individuales (VerificacionPanel, PreferenciasPanel, etc.)
// envuelven su contenido en este shell para mantener consistencia 1:1
// con el mockup sin duplicar scaffolding.

import type { ReactNode } from "react";

export type SectionIconTone =
  | "verif"
  | "data"
  | "notif"
  | "respon"
  | "secur"
  | "help"
  | "legal"
  | "danger";

const ICON_BG: Record<SectionIconTone, string> = {
  verif: "bg-alert-success-bg",
  data: "bg-accent-champions-bg",
  notif: "bg-urgent-med-bg",
  respon: "bg-pred-wrong-bg",
  secur: "bg-[#DDD6FE]",
  help: "bg-[#CFFAFE]",
  legal: "bg-subtle border border-light",
  danger: "bg-pred-wrong-bg",
};

interface SectionShellProps {
  title: string;
  subtitle?: string;
  icon: string;
  iconTone?: SectionIconTone;
  urgent?: boolean;
  badge?: string;
  children: ReactNode;
}

export function SectionShell({
  title,
  subtitle,
  icon,
  iconTone = "data",
  urgent = false,
  badge,
  children,
}: SectionShellProps) {
  const outer = urgent
    ? "mb-3.5 overflow-hidden rounded-md border border-urgent-high/35 bg-card shadow-[0_4px_12px_rgba(255,122,0,0.08)]"
    : "mb-3.5 overflow-hidden rounded-md border border-light bg-card shadow-sm";
  const headBg = urgent
    ? "bg-[#FFF7ED] border-b border-urgent-high/20"
    : "bg-subtle border-b border-light";
  return (
    <section className={outer}>
      <header className={`flex items-center gap-3 px-5 py-4 ${headBg}`}>
        <div
          aria-hidden
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm text-lg ${ICON_BG[iconTone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[18px] font-extrabold uppercase leading-tight tracking-[0.02em] text-dark">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-d">{subtitle}</p>
          ) : null}
        </div>
        {badge ? (
          <span className="flex-shrink-0 rounded-full bg-urgent-high px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-white">
            {badge}
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}
