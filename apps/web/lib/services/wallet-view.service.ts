// Agrega la data que /wallet necesita SSR: balance, totales por tipo,
// próximo vencimiento (Lukas COMPRADOS con venceEn > ahora) e historial
// ordenado. No es un endpoint — el page.tsx lo consume directo en SSR.
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

export interface WalletTransaccion {
  id: string;
  tipo: TipoTransaccion;
  monto: number;
  descripcion: string;
  refId: string | null;
  creadoEn: Date;
}

export interface WalletView {
  balance: number;
  totales: WalletTotales;
  proxVencimiento: WalletProxVencimiento | null;
  transacciones: WalletTransaccion[];
  totalMovimientos: number;
}

const HISTORIAL_LIMITE = 100;

export async function obtenerWalletView(
  usuarioId: string,
  balance: number,
): Promise<WalletView> {
  const [agregado, proxVenc, transacciones, totalMovimientos] =
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
