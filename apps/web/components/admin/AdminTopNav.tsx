"use client";
// AdminTopNav — barra de navegación admin (Lote 5.1).
//
// Sticky en el top, replica el estilo de tabs del resto de la app
// (mismo patrón que `MisTicketsTabs`): borde inferior gold en el activo,
// hover azul en los demás, scroll horizontal en mobile. Usa `usePathname`
// para marcar el item activo con `aria-current="page"`.
//
// Items del nav son los únicos paneles operativos hoy. /admin/torneos y
// /admin/usuarios siguen redirigiendo al dashboard hasta que se construyan
// como vistas independientes.

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { href: "/admin", label: "Dashboard", icon: "🏠" },
  { href: "/admin/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/admin/premios-mensuales", label: "Premios", icon: "💰" },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminTopNav() {
  const pathname = usePathname() ?? "/admin";

  return (
    <header
      role="banner"
      className="sticky top-0 z-30 border-b border-light bg-card/95 shadow-sm backdrop-blur"
    >
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 md:gap-5 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-1 whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.06em] text-muted-d transition-colors hover:text-dark"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">Volver a la app</span>
          <span className="sm:hidden">App</span>
        </Link>

        <span aria-hidden className="hidden h-6 w-px bg-light md:block" />

        <h1 className="hidden whitespace-nowrap font-display text-[15px] font-black uppercase tracking-[0.04em] text-dark md:block">
          ⚙️ Admin
        </h1>

        <nav
          aria-label="Navegación admin"
          className="-mb-3 ml-auto flex flex-1 items-center gap-0.5 overflow-x-auto md:flex-initial"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex flex-shrink-0 items-center gap-1.5 border-b-[3px] px-3 py-3 font-display text-[13px] font-bold uppercase tracking-[0.03em] transition-colors md:px-4 ${
                  active
                    ? "border-brand-gold text-dark"
                    : "border-transparent text-muted-d hover:text-brand-blue-main"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
