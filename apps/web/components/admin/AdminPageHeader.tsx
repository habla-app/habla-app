// AdminPageHeader — header consistente para páginas /admin/* (Lote 5.1).
//
// Server component puro. Reemplaza los headers ad-hoc que cada página
// tenía. Provee:
//   - Título grande con icon opcional (h1).
//   - Subtítulo opcional debajo.
//   - Slot de acciones a la derecha (botón / link / toggle).
//
// El "← Volver al home" y el switching entre vistas admin viven en
// `AdminTopNav` (sticky), así que este header NO repite ni breadcrumbs ni
// links de navegación intra-admin.

import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  /** Emoji o icon string a la izquierda del título. */
  icon?: string;
  title: string;
  /** Línea secundaria. Texto plano o nodo con énfasis. */
  description?: ReactNode;
  /** Botones / links de acción a la derecha. Renderizado en flex. */
  actions?: ReactNode;
}

export function AdminPageHeader({
  icon,
  title,
  description,
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-[28px] font-black uppercase leading-tight tracking-[0.02em] text-dark md:text-[36px]">
          {icon ? (
            <span aria-hidden className="mr-2">
              {icon}
            </span>
          ) : null}
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-d md:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
