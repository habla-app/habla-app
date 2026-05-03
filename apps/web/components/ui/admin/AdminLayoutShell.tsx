"use client";

// AdminLayoutShell — Lote O (May 2026): port literal del shell admin del
// mockup `docs/habla-mockup-v3.2.html` § admin-shell (líneas 4803-4933).
// HTML idéntico al mockup, clases del mockup (admin-shell, admin-sidebar,
// admin-sidebar-*, admin-main, admin-mobile-guard, logo-mark) que viven
// en `apps/web/app/mockup-styles.css` desde el Lote R.
//
// Comportamiento del mobile guard: inline en el HTML (display:none por
// default + @media (max-width:1279px) { display:flex }). NO usa el
// `<MobileGuard>` JS del Lote A — el mockup lo resuelve con CSS puro y
// el shell siempre se renderiza.
//
// Counters dinámicos (partidos / picks / liga-verificacion / alarmas) se
// reciben desde el server component padre via prop y se pintan en los
// `admin-sidebar-item-counter`.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { ReactNode } from "react";

export interface AdminLayoutCounters {
  partidos?: number;
  picksPendientes?: number;
  ligaVerificacionPendientes?: number;
  vinculacionesPendientes?: number;
  alarmasActivas?: number;
}

export interface AdminLayoutUser {
  name: string;
  email: string;
  username?: string | null;
  image?: string | null;
}

interface AdminLayoutShellProps {
  user: AdminLayoutUser;
  counters?: AdminLayoutCounters;
  children: ReactNode;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  counter?: number;
}

interface SidebarSection {
  label?: string;
  items: SidebarItem[];
}

function isActive(currentPath: string, href: string): boolean {
  if (href === "/admin/dashboard") return currentPath === "/admin" || currentPath === "/admin/dashboard";
  return currentPath === href || currentPath.startsWith(href + "/");
}

export function AdminLayoutShell({ user, counters, children }: AdminLayoutShellProps) {
  const pathname = usePathname() ?? "/admin";

  const sections: SidebarSection[] = [
    {
      items: [{ label: "Dashboard", href: "/admin/dashboard", icon: "🏠" }],
    },
    {
      label: "MOTOR DE FIJAS",
      items: [
        { label: "Partidos", href: "/admin/partidos", icon: "⚽", counter: counters?.partidos },
        {
          label: "Cola de validación",
          href: "/admin/picks",
          icon: "🎯",
          counter: counters?.picksPendientes,
        },
        { label: "Salud del motor", href: "/admin/motor", icon: "🤖" },
        { label: "Free vs Socios", href: "/admin/paywall", icon: "🔓" },
      ],
    },
    {
      label: "LIGA",
      items: [
        { label: "Torneo del mes", href: "/admin/liga-admin", icon: "🏆" },
        {
          label: "Verificación Top 10",
          href: "/admin/liga-verificacion",
          icon: "✅",
          counter: counters?.ligaVerificacionPendientes,
        },
        { label: "Pagos premios", href: "/admin/premios-mensuales", icon: "💰" },
      ],
    },
    {
      label: "MONETIZACIÓN",
      items: [
        { label: "Embudo de conversión", href: "/admin/embudo", icon: "📥" },
        {
          label: "Vinculaciones servicios",
          href: "/admin/vinculaciones",
          icon: "🔗",
          counter: counters?.vinculacionesPendientes,
        },
        { label: "Suscripciones", href: "/admin/suscripciones", icon: "💎" },
        { label: "Channel WhatsApp", href: "/admin/channel-whatsapp", icon: "💬" },
        { label: "Afiliados", href: "/admin/afiliados", icon: "🤝" },
        { label: "Conversiones FTD", href: "/admin/conversiones", icon: "💵" },
        { label: "Newsletter", href: "/admin/newsletter", icon: "📨" },
      ],
    },
    {
      label: "ANÁLISIS",
      items: [
        { label: "Métricas", href: "/admin/metricas", icon: "📊" },
        { label: "KPIs", href: "/admin/kpis", icon: "🎯" },
        { label: "Cohortes", href: "/admin/cohortes", icon: "👥" },
        { label: "Mobile Vitals", href: "/admin/mobile-vitals", icon: "⚡" },
        { label: "Finanzas", href: "/admin/finanzas", icon: "💰" },
        {
          label: "Alarmas",
          href: "/admin/alarmas",
          icon: "🚨",
          counter: counters?.alarmasActivas,
        },
      ],
    },
    {
      label: "SISTEMA",
      items: [
        { label: "Logs", href: "/admin/logs", icon: "🐛" },
        { label: "Auditoría", href: "/admin/auditoria", icon: "📜" },
        { label: "Usuarios", href: "/admin/usuarios", icon: "👤" },
      ],
    },
  ];

  const initials =
    user.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "A";

  const usernameDisplay = user.username ? `@${user.username}` : user.email;

  return (
    <div className="admin-shell">
      <div className="admin-mobile-guard">
        <h3>🖥️ Admin solo en desktop</h3>
        <p>El panel de administración está optimizado para desktop (1280px+). Cambia a Desktop para acceder.</p>
      </div>

      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-sidebar-logo">
            <span className="logo-mark">⊕</span>
            <span>Habla!</span>
          </div>
          <span className="admin-sidebar-badge">Admin Panel</span>
        </div>

        {sections.map((section, sIdx) => (
          <div key={sIdx} className="admin-sidebar-section">
            {section.label && <div className="admin-sidebar-section-label">{section.label}</div>}
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-sidebar-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="admin-sidebar-item-icon">{item.icon}</span> {item.label}
                  {item.counter !== undefined && item.counter > 0 && (
                    <span className="admin-sidebar-item-counter">
                      {item.counter > 99 ? "99+" : item.counter}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="admin-sidebar-footer">
          <Link href="/" className="admin-sidebar-footer-back">
            ← Volver a la app
          </Link>
          <div className="admin-sidebar-user">
            <div className="admin-sidebar-user-avatar">{initials}</div>
            <div className="admin-sidebar-user-info">
              <div className="admin-sidebar-user-name">{usernameDisplay}</div>
              <button
                type="button"
                className="admin-sidebar-user-signout"
                onClick={() => signOut({ callbackUrl: "/" })}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="admin-main">{children}</main>
    </div>
  );
}
