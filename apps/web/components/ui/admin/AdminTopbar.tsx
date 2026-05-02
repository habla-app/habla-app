// AdminTopbar — topbar de página admin. v3.1 (Lote A, preview). Spec:
// docs/ux-spec/00-design-system/componentes-admin.md §3 (AdminPageHeader).
//
// Decisión de naming Lote A: el user prompt llama a este componente
// `<AdminTopbar>` mientras la spec interna lo llama `<AdminPageHeader>`.
// Mantenemos el componente existente `apps/web/components/admin/
// AdminPageHeader.tsx` (Lote 7) intacto para no romper callers actuales,
// y creamos `<AdminTopbar>` como variante v3.1 que usa tokens nuevos
// admin-*. El Lote F migra los callers desde AdminPageHeader →
// AdminTopbar y borra el legacy.
//
// Layout:
// - Title + description izquierda
// - Breadcrumbs encima del title (opcional)
// - Actions derecha (botones contextuales export/crear/etc)
// - Border bottom sutil para separar del contenido
//
// Tipografía: `text-admin-page-title` para el title.
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface Crumb {
  label: string;
  href?: string;
}

interface AdminTopbarProps {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  className?: string;
}

export function AdminTopbar({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: AdminTopbarProps) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-end justify-between gap-3 border-b border-admin-table-border pb-4 mb-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5">
            <ol className="flex items-center gap-1 text-admin-meta text-muted-d">
              {breadcrumbs.map((crumb, i) => (
                <li key={i} className="flex items-center gap-1">
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-dark transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {i < breadcrumbs.length - 1 && (
                    <span aria-hidden className="text-soft">
                      ›
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1 className="text-admin-page-title text-dark truncate">{title}</h1>
        {description && (
          <p className="mt-1 text-admin-body text-muted-d">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </header>
  );
}
