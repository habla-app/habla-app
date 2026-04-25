// Alert — traducido de `.alert` / `.alert-info` / `.alert-success` del mockup.
// Banner inline con icono a la izquierda + contenido. Se monta en forms y
// pantallas donde se quiere comunicar info contextual (no intrusiva).
// Lote 6B: variantes `warning` (dorado) y `error` (rojo) para banners de
// vencimiento próximo en /wallet.
import type { ReactNode } from "react";

type AlertVariant = "info" | "success" | "warning" | "error";

interface AlertProps {
  variant?: AlertVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const VARIANTS: Record<AlertVariant, string> = {
  info: "bg-alert-info-bg border-alert-info-border text-alert-info-text",
  success:
    "bg-alert-success-bg border-alert-success-border text-alert-success-text",
  warning: "bg-brand-gold-dim border-brand-gold text-dark",
  error: "bg-pred-wrong/10 border-pred-wrong text-accent-clasico-dark",
};

const DEFAULT_ICON: Record<AlertVariant, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "🚨",
};

export function Alert({
  variant = "info",
  icon,
  children,
  className,
}: AlertProps) {
  const cls = [
    "mb-4 flex items-start gap-3 rounded-md border px-4 py-3.5 text-[13px] leading-relaxed",
    VARIANTS[variant],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div role="status" className={cls}>
      <span aria-hidden className="flex-shrink-0 text-[20px] leading-none">
        {icon ?? DEFAULT_ICON[variant]}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
