// Button — CTA primario en emails (Lote H).
//
// Render como `<a>` con padding (NO `<button>`) — Outlook rompe `<button>`
// en emails y el spec del Lote H exige `<a>` puro.
//
// Variantes:
//   gold       (default)  — fondo amarillo Habla! sobre texto navy
//   outline               — borde navy sobre fondo blanco
//   whatsapp              — fondo verde #25D366 sobre texto blanco

import { Link, Section } from "@react-email/components";
import type { ReactNode } from "react";

type Variant = "gold" | "outline" | "whatsapp";

interface ButtonProps {
  href: string;
  variant?: Variant;
  children: ReactNode;
  align?: "left" | "center" | "right";
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  gold: {
    backgroundColor: "#FFB800",
    color: "#001050",
    border: "none",
  },
  outline: {
    backgroundColor: "#FFFFFF",
    color: "#001050",
    border: "2px solid #001050",
  },
  whatsapp: {
    backgroundColor: "#25D366",
    color: "#FFFFFF",
    border: "none",
  },
};

const baseStyles: React.CSSProperties = {
  display: "inline-block",
  padding: "14px 28px",
  borderRadius: "10px",
  fontWeight: 700,
  textDecoration: "none",
  fontSize: "15px",
  lineHeight: "1.2",
};

export function Button({
  href,
  variant = "gold",
  children,
  align = "center",
}: ButtonProps) {
  const wrapStyle: React.CSSProperties = {
    textAlign: align,
    margin: "24px 0",
  };
  const linkStyle = { ...baseStyles, ...VARIANT_STYLES[variant] };
  return (
    <Section style={wrapStyle}>
      <Link href={href} style={linkStyle}>
        {children}
      </Link>
    </Section>
  );
}
