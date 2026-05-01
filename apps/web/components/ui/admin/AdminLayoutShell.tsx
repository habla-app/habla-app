"use client";

// AdminLayoutShell — wrapper que aplica el layout v3.1 admin (sidebar
// lateral 240px + main area). Lote F (May 2026). Spec:
// docs/ux-spec/05-pista-admin-operacion/00-layout-admin.spec.md.
//
// Por qué client component: el sidebar lee `usePathname` para destacar
// el item activo + `<MobileGuard>` necesita `useEffect` para medir
// viewport. El layout en sí (auth check) sigue siendo server component
// (`app/admin/layout.tsx`) que envuelve a este shell.
//
// Acepta `counters` que vienen del padre server component (ej. picks
// pendientes, alarmas activas) — los counts no se calculan acá para no
// bloquear el render del shell.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "next-auth/react";

import { AdminSidebar, type AdminSidebarSection } from "./AdminSidebar";
import { MobileGuard } from "./MobileGuard";

export interface AdminLayoutCounters {
  picksPendientes?: number;
  alarmasActivas?: number;
}

export interface AdminLayoutUser {
  name: string;
  email: string;
  image?: string | null;
}

interface AdminLayoutShellProps {
  user: AdminLayoutUser;
  counters?: AdminLayoutCounters;
  children: ReactNode;
}

export function AdminLayoutShell({
  user,
  counters,
  children,
}: AdminLayoutShellProps) {
  const pathname = usePathname() ?? "/admin";

  const sections: AdminSidebarSection[] = [
    {
      items: [{ label: "Dashboard", href: "/admin/dashboard", icon: "🏠" }],
    },
    {
      label: "OPERACIÓN",
      items: [
        {
          label: "Picks Premium",
          href: "/admin/picks-premium",
          icon: "🎯",
          counter: counters?.picksPendientes,
          counterTone: "red",
        },
        { label: "Channel WhatsApp", href: "/admin/channel-whatsapp", icon: "💬" },
        { label: "Suscripciones", href: "/admin/suscripciones", icon: "💎" },
        { label: "Afiliados", href: "/admin/afiliados", icon: "🤝" },
        { label: "Conversiones", href: "/admin/conversiones", icon: "💵" },
        { label: "Newsletter", href: "/admin/newsletter", icon: "📨" },
        {
          label: "Premios mensuales",
          href: "/admin/premios-mensuales",
          icon: "🏆",
        },
      ],
    },
    {
      label: "ANÁLISIS",
      items: [
        { label: "Métricas", href: "/admin/metricas", icon: "📊" },
        { label: "Leaderboard", href: "/admin/leaderboard", icon: "📈" },
      ],
    },
    {
      label: "CONTENIDO",
      items: [
        { label: "Torneos", href: "/admin/torneos", icon: "⚽" },
      ],
    },
    {
      label: "SISTEMA",
      items: [
        { label: "Logs", href: "/admin/logs", icon: "🐛" },
        { label: "Usuarios", href: "/admin/usuarios", icon: "👥" },
      ],
    },
  ];

  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "A";

  return (
    <MobileGuard minWidth={1280}>
      <div className="grid min-h-screen grid-cols-[240px_1fr] bg-admin-content-bg">
        <AdminSidebar
          currentPath={pathname}
          sections={sections}
          footer={
            <div className="space-y-2">
              <Link
                href="/"
                className="flex items-center gap-2 px-1 py-1 text-admin-meta text-admin-sidebar-text-muted transition-colors hover:text-white"
              >
                <span aria-hidden>←</span>
                Volver a la app
              </Link>
              <div className="flex items-center gap-2 px-1 pt-1">
                <span
                  aria-hidden
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white"
                >
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-admin-meta text-white">
                    {user.name}
                  </div>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="text-[10px] uppercase tracking-[0.06em] text-admin-sidebar-text-muted transition-colors hover:text-white"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          }
        />
        <main className="min-w-0 px-6 py-6">{children}</main>
      </div>
    </MobileGuard>
  );
}
