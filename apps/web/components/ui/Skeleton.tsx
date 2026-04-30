// Skeleton — placeholder shimmer durante loading. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §12.
//
// Variantes:
// - text   → 1 línea horizontal (1em alto)
// - lines  → N líneas (prop count)
// - circle → avatar circular (size-prop required)
// - rect   → rectángulo arbitrario (className override)
//
// Usa la animación `shimmer` definida en tailwind.config (Lote 0).
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type SkeletonVariant = "text" | "lines" | "circle" | "rect";

interface SkeletonBaseProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

interface SkeletonLinesProps extends SkeletonBaseProps {
  variant: "lines";
  count: number;
}

type SkeletonProps = SkeletonBaseProps | SkeletonLinesProps;

const SHIMMER =
  "bg-gradient-to-r from-subtle via-hover to-subtle bg-[length:400px_100%] animate-shimmer rounded-sm";

export function Skeleton(props: SkeletonProps) {
  const { variant = "text", className, ...rest } = props;

  if (variant === "lines") {
    const count = (props as SkeletonLinesProps).count ?? 3;
    return (
      <div
        aria-hidden
        className={cn("flex flex-col gap-2", className)}
        {...rest}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className={cn(SHIMMER, "h-3.5", i === count - 1 ? "w-3/4" : "w-full")}
          />
        ))}
      </div>
    );
  }

  if (variant === "circle") {
    return (
      <div
        aria-hidden
        className={cn(SHIMMER, "rounded-full", className)}
        {...rest}
      />
    );
  }

  if (variant === "rect") {
    return (
      <div aria-hidden className={cn(SHIMMER, className)} {...rest} />
    );
  }

  // default: text
  return (
    <div
      aria-hidden
      className={cn(SHIMMER, "h-4 w-full", className)}
      {...rest}
    />
  );
}
