import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";

// HomeHeroFree — Lote N v3.2 · port literal del bloque
// `<div class="home-hero logged-only">` del mockup (líneas 2228-2239).
//
// Server component: cuenta tickets activos del usuario en partidos
// próximos del mes y resuelve cuándo cierra el siguiente.

interface Props {
  username: string | null;
  miPosicion: number | null;
}

export async function HomeHeroFree({ username, miPosicion }: Props) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const ahora = new Date();
  let pendientes = 0;
  let proximoCierreMs: number | null = null;

  if (userId) {
    const tickets = await prisma.ticket.findMany({
      where: {
        usuarioId: userId,
        torneo: {
          partido: {
            fechaInicio: { gt: ahora },
            estado: "PROGRAMADO",
          },
        },
      },
      select: {
        torneo: {
          select: {
            partido: { select: { fechaInicio: true } },
          },
        },
      },
    });
    pendientes = tickets.length;
    for (const t of tickets) {
      const ms = t.torneo.partido.fechaInicio.getTime();
      if (proximoCierreMs === null || ms < proximoCierreMs) {
        proximoCierreMs = ms;
      }
    }
  }

  const cierreLabel = proximoCierreMs
    ? formatHasta(proximoCierreMs - ahora.getTime())
    : null;

  const userLabel = username ? `@${username}` : "tipster";
  const posLabel = miPosicion ? `#${miPosicion} del mes` : "Sin posición aún";

  return (
    <div className="home-hero logged-only">
      <div className="home-hero-eyebrow">👋 Hola {userLabel} · {posLabel}</div>
      <h1>Todas las fijas<br />en una</h1>
      <p className="home-hero-desc">
        {pendientes > 0 ? (
          <>
            Tenés{" "}
            <strong style={{ color: "var(--gold)" }}>
              {pendientes} {pendientes === 1 ? "combinada pendiente" : "combinadas pendientes"}
            </strong>{" "}
            para hoy.{cierreLabel ? ` El próximo cierra en ${cierreLabel}.` : ""}
          </>
        ) : (
          <>
            Sin combinadas activas. Armá la próxima en La Liga Habla! para sumar puntos del mes.
          </>
        )}
      </p>
      <div className="home-hero-ctas">
        <Link href="/liga" className="btn btn-primary">🏆 Ir a mis combinadas</Link>
        <Link href="/las-fijas" className="btn btn-ghost">Ver las fijas</Link>
      </div>
    </div>
  );
}

function formatHasta(ms: number): string {
  if (ms <= 0) return "0min";
  const h = Math.floor(ms / (1000 * 60 * 60));
  const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}min`;
  return `${m}min`;
}
