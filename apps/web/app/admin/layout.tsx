// Layout del panel de administración — Lote F (May 2026).
//
// v3.1 cambia de mobile-friendly a desktop-only (regla 13 del CLAUDE.md):
// sidebar lateral fijo 240px reemplaza al `<AdminTopNav>` horizontal del
// Lote 5.1. Min screen 1280px — abajo de eso, `<MobileGuard>` muestra
// pantalla de bloqueo.
//
// Auth: server-side (defensa en profundidad sobre el middleware). El shell
// es client component (necesita usePathname + medir viewport).
//
// Counters del sidebar (picks pendientes, alarmas activas) se calculan acá
// en server con Promise.all paralelo a la auth check para no agregar
// latencia perceptible.

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { AdminLayoutShell } from "@/components/ui/admin/AdminLayoutShell";

export const metadata = {
  title: "Admin · Habla!",
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin/dashboard");
  if (session.user.rol !== "ADMIN") redirect("/");

  // Counters del sidebar — fail-soft. Si la BD se cae, mostramos 0 y el
  // shell sigue navegable.
  const [picksPendientes] = await Promise.all([
    prisma.pickPremium
      .count({ where: { estado: "PENDIENTE" } })
      .catch(() => 0),
  ]);

  return (
    <AdminLayoutShell
      user={{
        name: session.user.name ?? session.user.email ?? "Admin",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
      }}
      counters={{
        picksPendientes,
        alarmasActivas: 0, // Lote G: alarmas reales con `obtenerAlarmasActivas`
      }}
    >
      {children}
    </AdminLayoutShell>
  );
}
