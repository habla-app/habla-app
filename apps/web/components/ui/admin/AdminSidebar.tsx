"use client";

// AdminSidebar — sidebar lateral fijo 240px. v3.1 (Lote A, preview). Spec:
// docs/ux-spec/00-design-system/componentes-admin.md §2.
//
// Reemplaza completamente al `<AdminTopNav>` actual (Lote 7+10) en el
// Lote F. En Lote A se crea el componente con la estructura jerárquica
// canónica del v3.1 (Dashboard / Operación / Análisis / Contenido /
// Sistema) usando los tokens admin-* nuevos, pero NO se cablea en
// `app/admin/layout.tsx` — esa migración la hace Lote F.
//
// API: el caller pasa `currentPath` para destacar el ítem activo. Los
// items permiten un counter opcional (ej. picks Premium pendientes ●3).
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface AdminSidebarItem {
  label: string;
  href: string;
  icon?: ReactNode;
  /** Badge counter (ej. picks pendientes). undefined = no badge. */
  counter?: number;
  counterTone?: "gold" | "red";
}

export interface AdminSidebarSection {
  /** Section label en uppercase. undefined = sin header (ítem raíz). */
  label?: string;
  items: AdminSidebarItem[];
}

interface AdminSidebarProps {
  currentPath: string;
  sections: AdminSidebarSection[];
  /** Render extra abajo (ej. user profile + logout). */
  footer?: ReactNode;
  className?: string;
}

function isActive(currentPath: string, href: string): boolean {
  if (href === "/admin") return currentPath === "/admin";
  return currentPath === href || currentPath.startsWith(href + "/");
}

export function AdminSidebar({
  currentPath,
  sections,
  footer,
  className,
}: AdminSidebarProps) {
  return (
    <aside
      aria-label="Navegación administrativa"
      className={cn(
        "flex h-screen w-60 flex-col bg-admin-sidebar-bg text-admin-sidebar-text",
        "sticky top-0 z-sidebar",
        className,
      )}
    >
      {/* Logo / nombre app */}
      <div className="flex h-14 items-center gap-2 border-b border-admin-sidebar-divider px-4">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-radial text-[14px] font-extrabold text-brand-blue-dark"
        >
          ⊕
        </span>
        <span className="font-display text-display-xs uppercase tracking-[0.06em] text-white">
          Habla! Admin
        </span>
      </div>

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto py-3">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="mb-4">
            {section.label && (
              <div className="px-4 pb-1.5 pt-2 text-label-sm text-admin-sidebar-section-label">
                {section.label}
              </div>
            )}
            <ul className="flex flex-col">
              {section.items.map((item) => {
                const active = isActive(currentPath, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-2 px-4 text-admin-body transition-colors",
                        active
                          ? "bg-admin-sidebar-active-bg text-admin-sidebar-active-text"
                          : "text-admin-sidebar-text hover:bg-admin-sidebar-hover-bg",
                      )}
                    >
                      {/* Barra dorada izquierda en activo */}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-y-0 left-0 w-[3px] bg-brand-gold"
                        />
                      )}
                      {item.icon && (
                        <span aria-hidden className="text-[14px] leading-none">
                          {item.icon}
                        </span>
                      )}
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.counter !== undefined && item.counter > 0 && (
                        <span
                          className={cn(
                            "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                            item.counterTone === "red"
                              ? "bg-status-red text-white"
                              : "bg-brand-gold text-brand-blue-dark",
                          )}
                        >
                          {item.counter > 99 ? "99+" : item.counter}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer (user profile, logout) */}
      {footer && (
        <div className="border-t border-admin-sidebar-divider p-3">
          {footer}
        </div>
      )}
    </aside>
  );
}
