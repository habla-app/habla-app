// AdminCard — wrapper de card admin con título + acciones. v3.1 (Lote A,
// preview). Spec: docs/ux-spec/00-design-system/componentes-admin.md
// (forma genérica derivada de KPISection, sección de tabla, etc.).
//
// Uso típico:
//
//   <AdminCard title="Picks Premium pendientes" actions={<Button>...</Button>}>
//     <AdminTable ... />
//   </AdminCard>
//
// El cuerpo (`children`) se renderiza dentro de un contenedor con el
// padding admin estándar. Para variantes sin título, usar `<Card>` base
// con prop `variant="default"`.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface AdminCardProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  /** Padding del body. Default md (p-4). */
  bodyPadding?: "none" | "sm" | "md" | "lg";
  children: ReactNode;
  className?: string;
}

const PADDING: Record<NonNullable<AdminCardProps["bodyPadding"]>, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export function AdminCard({
  title,
  description,
  actions,
  bodyPadding = "md",
  children,
  className,
}: AdminCardProps) {
  return (
    <section
      className={cn(
        "rounded-md bg-admin-card-bg shadow-sm border border-admin-table-border overflow-hidden",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-admin-table-border px-4 py-3">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-admin-card-title text-dark truncate">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-admin-meta text-muted-d truncate">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </header>
      )}
      <div className={PADDING[bodyPadding]}>{children}</div>
    </section>
  );
}
