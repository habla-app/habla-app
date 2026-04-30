// SectionShell — contenedor `.profile-section` del mockup. Borde + header
// con ícono coloreado + título + subtítulo + badge opcional. Los paneles
// envuelven su contenido en este shell para consistencia 1:1 con el
// mockup (docs/habla-mockup-completo.html líneas 3951-4289).

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
  /** Lote 11 — id para anchor links desde QuickAccessGrid (ej.
   *  /perfil#notificaciones). */
  anchorId?: string;
  children: ReactNode;
}

export function SectionShell({
  title,
  subtitle,
  icon,
  iconTone = "data",
  urgent = false,
  badge,
  anchorId,
  children,
}: SectionShellProps) {
  const outer = urgent
    ? "mb-3.5 overflow-hidden rounded-md border border-urgent-high/35 bg-card shadow-[0_4px_12px_rgba(255,122,0,0.08)]"
    : "mb-3.5 overflow-hidden rounded-md border border-light bg-card shadow-sm";
  const headBg = urgent
    ? "bg-[#FFF7ED] border-b border-urgent-high/20"
    : "bg-subtle border-b border-light";
  return (
    <section className={outer} id={anchorId}>
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

// MenuItem compartido — el "pmenu-item" del mockup: icono pequeño + label +
// subtítulo + arrow chevron. Usado en Seguridad/Ayuda/Legal/Juego
// responsable. Expuesto acá para que no duplique entre secciones.
export function MenuItem({
  icon,
  label,
  sub,
  onClick,
  href,
  disabled,
  newTab,
}: {
  icon: string;
  label: string;
  sub?: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  newTab?: boolean;
}) {
  const inner = (
    <>
      <div
        aria-hidden
        className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-sm bg-subtle text-base"
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-dark">{label}</div>
        {sub ? (
          <div className="text-xs leading-[1.4] text-muted-d">{sub}</div>
        ) : null}
      </div>
      <span aria-hidden className="flex-shrink-0 text-lg text-soft">
        ›
      </span>
    </>
  );
  const cls =
    "flex w-full items-center gap-3.5 border-b border-light px-5 py-3.5 text-left transition last:border-b-0 hover:bg-subtle disabled:opacity-50";
  if (href) {
    const isExternal = href.startsWith("http") || href.startsWith("mailto:");
    return (
      <a
        href={href}
        target={newTab || isExternal ? "_blank" : undefined}
        rel={newTab || isExternal ? "noopener noreferrer" : undefined}
        className={cls}
      >
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {inner}
    </button>
  );
}
