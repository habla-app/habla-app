// Layout admin — Lote O (May 2026): refactor para alinear counters del
// sidebar con las vistas del mockup v3.2 admin operación.
//
// Counters dinámicos: partidos sin Filtro 1 + análisis pendiente, picks
// pendientes (legacy PickPremium), Top 10 con pendientes de verificación,
// alarmas activas. Vinculaciones queda con counter undefined hasta Lote P.
//
// Auth: server-side (defensa en profundidad sobre el middleware). El shell
// es client component (necesita usePathname).

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { AdminLayoutShell } from "@/components/ui/admin/AdminLayoutShell";
import { obtenerLeaderboardMesActual } from "@/lib/services/leaderboard.service";
import { obtenerVinculacionesPendientesCount } from "@/lib/services/vinculaciones.service";

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

  const ahora = new Date();
  const en7d = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [partidosSinFiltro1, picksPendientes, alarmasActivas, ligaTopPendientes, vinculacionesPendientes] =
    await Promise.all([
      // Partidos próximos 7d que aún no pasaron Filtro 1 (mostrarAlPublico=false)
      prisma.partido
        .count({
          where: {
            fechaInicio: { gte: ahora, lte: en7d },
            mostrarAlPublico: false,
          },
        })
        .catch(() => 0),
      prisma.pickPremium.count({ where: { estado: "PENDIENTE" } }).catch(() => 0),
      prisma.alarma.count({ where: { activa: true } }).catch(() => 0),
      contarTop10Pendientes(),
      obtenerVinculacionesPendientesCount(),
    ]);

  const username = await prisma.usuario
    .findUnique({
      where: { email: session.user.email ?? undefined },
      select: { username: true, nombre: true },
    })
    .catch(() => null);

  return (
    <AdminLayoutShell
      user={{
        name: username?.nombre ?? session.user.name ?? session.user.email ?? "Admin",
        email: session.user.email ?? "",
        username: username?.username ?? null,
        image: session.user.image ?? null,
      }}
      counters={{
        partidos: partidosSinFiltro1,
        picksPendientes,
        ligaVerificacionPendientes: ligaTopPendientes,
        vinculacionesPendientes,
        alarmasActivas,
      }}
    >
      {children}
    </AdminLayoutShell>
  );
}

// Cuenta cuántos del Top 10 actual de la Liga del mes en curso aún no tienen
// yapeNumero capturado (bloqueante para cobrar el premio). El leaderboard del
// mes en curso se calcula on-the-fly desde tickets finalizados. Fail-soft.
async function contarTop10Pendientes(): Promise<number> {
  try {
    const lb = await obtenerLeaderboardMesActual({});
    const top10 = lb.filas.slice(0, 10).map((f) => f.userId);
    if (top10.length === 0) return 0;

    const verificados = await prisma.usuario.count({
      where: {
        id: { in: top10 },
        yapeNumero: { not: null },
      },
    });
    return Math.max(0, top10.length - verificados);
  } catch {
    return 0;
  }
}
