// Agrega la data que /wallet necesita SSR: balance, totales por tipo,
// próximo vencimiento (Lukas COMPRADOS con venceEn > ahora) e historial
// ordenado. No es un endpoint — el page.tsx lo consume directo en SSR.
//
// Abr 2026: las transacciones `ENTRADA_TORNEO` y `PREMIO_TORNEO` ahora
// incluyen el partido relacionado (resuelto vía refId → Torneo → Partido)
// para que el historial del wallet muestre "Alianza vs Cristal" y no
// dependa sólo del `descripcion` del torneo. El filtro "Inscripciones"
// del wallet muestra este enriquecimiento.
//
// Nota Sub-Sprint 2: cuando llegue Culqi habrá endpoints `/lukas/balance`
// y `/lukas/historial`. Este helper puede convivir (para SSR) o reemplazarse
// por `authedFetch` si se prefiere mover todo a client-side.
import { prisma, type TipoTransaccion } from "@habla/db";

export interface WalletTotales {
  comprado: number;
  ganado: number;
  canjeado: number;
  bonos: number;
  inscripciones: number;
}

export interface WalletProxVencimiento {
  lukas: number;
  fecha: Date;
}

export interface WalletTxPartido {
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  /** "Alianza 2-1 Cristal" si ya hay goles, "Alianza vs Cristal" si no. */
  resumen: string;
}

export interface WalletTransaccion {
  id: string;
  tipo: TipoTransaccion;
  monto: number;
  descripcion: string;
  refId: string | null;
  creadoEn: Date;
  /** Solo presente para tipos que referencian un torneo — ENTRADA_TORNEO,
   *  PREMIO_TORNEO, REEMBOLSO. Resuelto vía refId → Torneo → Partido. */
  partido: WalletTxPartido | null;
}

export interface WalletView {
  balance: number;
  totales: WalletTotales;
  proxVencimiento: WalletProxVencimiento | null;
  transacciones: WalletTransaccion[];
  totalMovimientos: number;
}

const HISTORIAL_LIMITE = 100;

const TIPOS_CON_TORNEO: TipoTransaccion[] = [
  "ENTRADA_TORNEO",
  "PREMIO_TORNEO",
  "REEMBOLSO",
];

function resumenPartido(p: {
  equipoLocal: string;
  equipoVisita: string;
  golesLocal: number | null;
  golesVisita: number | null;
  estado: string;
}): string {
  if (p.estado === "FINALIZADO" && p.golesLocal !== null && p.golesVisita !== null) {
    return `${p.equipoLocal} ${p.golesLocal}-${p.golesVisita} ${p.equipoVisita}`;
  }
  return `${p.equipoLocal} vs ${p.equipoVisita}`;
}

export async function obtenerWalletView(
  usuarioId: string,
  balance: number,
): Promise<WalletView> {
  const [agregado, proxVenc, transaccionesRaw, totalMovimientos] =
    await Promise.all([
      prisma.transaccionLukas.groupBy({
        by: ["tipo"],
        where: { usuarioId },
        _sum: { monto: true },
      }),
      prisma.transaccionLukas.findFirst({
        where: {
          usuarioId,
          tipo: "COMPRA",
          venceEn: { gt: new Date() },
          monto: { gt: 0 },
        },
        orderBy: { venceEn: "asc" },
        select: { venceEn: true },
      }),
      prisma.transaccionLukas.findMany({
        where: { usuarioId },
        orderBy: { creadoEn: "desc" },
        take: HISTORIAL_LIMITE,
        select: {
          id: true,
          tipo: true,
          monto: true,
          descripcion: true,
          refId: true,
          creadoEn: true,
        },
      }),
      prisma.transaccionLukas.count({ where: { usuarioId } }),
    ]);

  // Resolver partidos para las transacciones referentes a torneos.
  const torneoIds = Array.from(
    new Set(
      transaccionesRaw
        .filter((t) => TIPOS_CON_TORNEO.includes(t.tipo) && t.refId)
        .map((t) => t.refId!),
    ),
  );
  const partidosPorTorneo = new Map<string, WalletTxPartido>();
  if (torneoIds.length > 0) {
    const torneos = await prisma.torneo.findMany({
      where: { id: { in: torneoIds } },
      include: { partido: true },
    });
    for (const t of torneos) {
      partidosPorTorneo.set(t.id, {
        liga: t.partido.liga,
        equipoLocal: t.partido.equipoLocal,
        equipoVisita: t.partido.equipoVisita,
        resumen: resumenPartido(t.partido),
      });
    }
  }

  const transacciones: WalletTransaccion[] = transaccionesRaw.map((t) => ({
    ...t,
    partido:
      TIPOS_CON_TORNEO.includes(t.tipo) && t.refId
        ? partidosPorTorneo.get(t.refId) ?? null
        : null,
  }));

  const totales: WalletTotales = {
    comprado: 0,
    ganado: 0,
    canjeado: 0,
    bonos: 0,
    inscripciones: 0,
  };
  for (const row of agregado) {
    const abs = Math.abs(row._sum.monto ?? 0);
    switch (row.tipo) {
      case "COMPRA":
        totales.comprado = abs;
        break;
      case "PREMIO_TORNEO":
        totales.ganado = abs;
        break;
      case "CANJE":
        totales.canjeado = abs;
        break;
      case "BONUS":
        totales.bonos = abs;
        break;
      case "ENTRADA_TORNEO":
        totales.inscripciones = abs;
        break;
      default:
        break;
    }
  }

  let proxVencimiento: WalletProxVencimiento | null = null;
  if (proxVenc?.venceEn) {
    const lukasVigentes = await prisma.transaccionLukas.aggregate({
      where: {
        usuarioId,
        tipo: "COMPRA",
        venceEn: { gt: new Date() },
        monto: { gt: 0 },
      },
      _sum: { monto: true },
    });
    const lukas = lukasVigentes._sum.monto ?? 0;
    if (lukas > 0) {
      proxVencimiento = { lukas, fecha: proxVenc.venceEn };
    }
  }

  return {
    balance,
    totales,
    proxVencimiento,
    transacciones,
    totalMovimientos,
  };
}
