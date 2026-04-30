// Avatar — foto o iniciales. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §14.
//
// Si hay `src` → renderiza <img>. Si no, fallback con iniciales sobre
// gradiente dorado (`bg-gold-diagonal`).
//
// Tamaños: xs (24px), sm (32px), md (40px), lg (56px), xl (80px hero).
import { useMemo } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string | null;
  alt?: string;
  /** Nombre completo o display name; si no hay src, se extraen iniciales. */
  name?: string;
  size?: AvatarSize;
}

const SIZES: Record<AvatarSize, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[12px]",
  md: "h-10 w-10 text-[14px]",
  lg: "h-14 w-14 text-[18px]",
  xl: "h-20 w-20 text-[28px]",
};

function initialsFromName(name: string | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  const first = parts[0]![0] ?? "";
  const last = parts[parts.length - 1]![0] ?? "";
  return (first + last).toUpperCase();
}

export function Avatar({
  src,
  alt,
  name,
  size = "md",
  className,
  ...rest
}: AvatarProps) {
  const initials = useMemo(() => initialsFromName(name), [name]);
  const baseCls = cn(
    "inline-flex items-center justify-center overflow-hidden rounded-full font-display font-extrabold",
    SIZES[size],
    className,
  );

  if (src) {
    return (
      <span className={baseCls} {...rest}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? name ?? "Avatar"}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(baseCls, "bg-gold-diagonal text-brand-blue-dark")}
      aria-label={alt ?? name ?? "Avatar"}
      {...rest}
    >
      <span aria-hidden>{initials}</span>
    </span>
  );
}
