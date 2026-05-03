import Link from "next/link";
import { prisma } from "@habla/db";

// HomeHeroSocios — Lote N v3.2 · port literal del bloque
// `<div class="home-hero home-hero-socio socios-only">` del mockup
// (líneas 2241-2275).
//
// Server component. Calcula stats reales del mes en curso:
//   - EV+ del mes (promedio de evPctSugerido de picks aprobados del mes)
//   - Picks recibidos (count aprobados del mes)
//   - Pendientes (aprobados sin resultado, partido futuro)
//   - Pick top de hoy (el más reciente aprobado, partido hoy o mañana)

interface Props {
  username: string | null;
}

interface PickTop {
  equipoLocal: string;
  mercadoLabel: string;
  cuota: number;
  hora: string;
}

function formatMercadoCorto(mercado: string, outcome: string): string {
  switch (mercado) {
    case "RESULTADO_1X2":
      if (outcome === "home") return "Local";
      if (outcome === "draw") return "Empate";
      if (outcome === "away") return "Visita";
      return "1X2";
    case "BTTS":
      return outcome === "btts_si" ? "BTTS Sí" : "BTTS No";
    case "OVER_UNDER_25":
      return outcome === "over" ? "Más 2.5" : "Menos 2.5";
    case "TARJETA_ROJA":
      return outcome === "roja_si" ? "Roja Sí" : "Roja No";
    case "MARCADOR_EXACTO":
      return outcome;
    default:
      return mercado;
  }
}

function horaLima(fecha: Date): string {
  const fmt = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return fmt.format(fecha);
}

export async function HomeHeroSocios({ username }: Props) {
  const ahora = new Date();
  const inicioMes = new Date(
    new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" })).getFullYear(),
    new Date(ahora.toLocaleString("en-US", { timeZone: "America/Lima" })).getMonth(),
    1,
  );

  let picksRecibidos = 0;
  let pendientes = 0;
  let evPromedio: number | null = null;
  let pickTop: PickTop | null = null;

  try {
    const [aprobadosMes, pendientesActivos, ultimoAprobado] = await Promise.all([
      prisma.pickPremium.findMany({
        where: {
          aprobado: true,
          aprobadoEn: { gte: inicioMes },
        },
        select: { evPctSugerido: true },
      }),
      prisma.pickPremium.count({
        where: {
          aprobado: true,
          resultadoFinal: null,
          partido: { fechaInicio: { gt: ahora }, estado: "PROGRAMADO" },
        },
      }),
      prisma.pickPremium.findFirst({
        where: {
          aprobado: true,
          partido: { fechaInicio: { gt: ahora }, estado: "PROGRAMADO" },
        },
        orderBy: { aprobadoEn: "desc" },
        select: {
          mercado: true,
          outcome: true,
          cuotaSugerida: true,
          partido: {
            select: { equipoLocal: true, equipoVisita: true, fechaInicio: true },
          },
        },
      }),
    ]);

    picksRecibidos = aprobadosMes.length;
    pendientes = pendientesActivos;
    const evValores = aprobadosMes
      .map((p) => p.evPctSugerido)
      .filter((v): v is number => typeof v === "number");
    if (evValores.length > 0) {
      evPromedio =
        evValores.reduce((a, b) => a + b, 0) / evValores.length;
    }
    if (ultimoAprobado) {
      pickTop = {
        equipoLocal: ultimoAprobado.partido.equipoLocal,
        mercadoLabel: formatMercadoCorto(
          ultimoAprobado.mercado,
          ultimoAprobado.outcome,
        ),
        cuota: ultimoAprobado.cuotaSugerida,
        hora: horaLima(ultimoAprobado.partido.fechaInicio),
      };
    }
  } catch {
    // Si el modelo no existe aún o falla la query, dejamos los defaults
    // (ceros + null) y la UI muestra "—" / placeholder.
  }

  const userLabel = username ? `@${username}` : "tipster";
  const evLabel =
    evPromedio === null
      ? "—"
      : `${evPromedio >= 0 ? "+" : ""}${(evPromedio * 100).toFixed(1)}%`;

  return (
    <div className="home-hero home-hero-socio socios-only">
      <div className="home-hero-eyebrow">💎 Hola {userLabel} · Socio activo</div>
      <h1>Todas las fijas<br />en una</h1>
      <p className="home-hero-desc">
        {picksRecibidos > 0 ? (
          <>
            <strong style={{ color: "var(--gold)" }}>
              {pendientes} {pendientes === 1 ? "pick nuevo" : "picks nuevos"}
            </strong>{" "}
            hoy en tu canal · próximo análisis profundo el martes
          </>
        ) : (
          <>Sin picks nuevos hoy · próximo análisis profundo el martes</>
        )}
      </p>

      {/* Stats inline del mes */}
      <div className="hero-socio-stats">
        <div className="hero-socio-stat">
          <div
            className="hero-socio-stat-val"
            style={evPromedio !== null && evPromedio >= 0 ? { color: "var(--green)" } : undefined}
          >
            {evLabel}
          </div>
          <div className="hero-socio-stat-lbl">EV+ del mes</div>
        </div>
        <div className="hero-socio-stat">
          <div className="hero-socio-stat-val">{picksRecibidos}</div>
          <div className="hero-socio-stat-lbl">Picks recibidos</div>
        </div>
        <div className="hero-socio-stat">
          <div className="hero-socio-stat-val">{pendientes}</div>
          <div className="hero-socio-stat-lbl">Pendientes</div>
        </div>
      </div>

      {/* Pick top destacado */}
      {pickTop ? (
        <div className="hero-socio-pick-top">
          <span className="hero-socio-pick-eyebrow">⭐ Pick top de hoy</span>
          <span className="hero-socio-pick-content">
            {pickTop.equipoLocal} + {pickTop.mercadoLabel} @ {pickTop.cuota.toFixed(2)} · {pickTop.hora}
          </span>
        </div>
      ) : null}

      <div className="home-hero-ctas">
        <Link href="/socios-hub" className="btn btn-primary">Ver mi hub Socios →</Link>
        <a
          href={process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
        >
          📲 Abrir canal WhatsApp
        </a>
      </div>
    </div>
  );
}
