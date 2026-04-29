// Auditoría continua del sistema contable — Lote 8 §2.D.
//
// Verifica las invariantes contables. C1-C3 disparan hallazgo `error` si no
// cuadran; C5-C6 son `warn` (informativo). El Job I del cron in-process
// llama `ejecutarAuditoria()` cada 23h, persiste el resultado en
// `AuditoriaContableLog` y, si los últimos 2 fallos son consecutivos,
// dispara email al ADMIN_ALERT_EMAIL.
//
// Lote 2 (Abr 2026): la invariante C4 (pasivos Lukas == suma balances
// usuarios) se removió porque el sistema de Lukas ya no existe.

import { prisma, Prisma } from "@habla/db";

export type Severidad = "error" | "warn";

export interface HallazgoContable {
  codigo: string; // "C1", "C2", ...
  severidad: Severidad;
  mensaje: string;
  detalle?: Record<string, unknown>;
}

export interface AuditoriaContableResult {
  ok: boolean;
  scaneadoEn: string;
  durationMs: number;
  hallazgos: HallazgoContable[];
  totalHallazgos: number;
  errores: number;
  warns: number;
  totales: {
    cuentas: number;
    asientos: number;
    lineas: number;
    movimientosEsperados: number;
    movimientosReales: number;
  };
}

const TOLERANCIA_DECIMAL = 0.01;
const TOLERANCIA_BANCO = 50; // S/ 50

function eq(a: number, b: number, tol = TOLERANCIA_DECIMAL): boolean {
  return Math.abs(a - b) <= tol;
}

function dec(v: Prisma.Decimal | number | string): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return Number(v.toString());
}

export async function ejecutarAuditoria(): Promise<AuditoriaContableResult> {
  const t0 = Date.now();
  const hallazgos: HallazgoContable[] = [];

  const [cuentas, asientos, lineas, movEspCount, movRealCount] = await Promise.all([
    prisma.cuentaContable.findMany(),
    prisma.asiento.findMany({ select: { id: true, totalDebe: true, totalHaber: true, fecha: true } }),
    prisma.asientoLinea.findMany({
      select: { id: true, asientoId: true, cuentaId: true, debe: true, haber: true },
    }),
    prisma.movimientoBancoEsperado.count(),
    prisma.movimientoBancoReal.count(),
  ]);

  // --- C2: cada asiento balanceado, y suma de líneas == totales -----------
  const lineasPorAsiento = new Map<string, { debe: number; haber: number }>();
  for (const l of lineas) {
    const acc = lineasPorAsiento.get(l.asientoId) ?? { debe: 0, haber: 0 };
    acc.debe += dec(l.debe);
    acc.haber += dec(l.haber);
    lineasPorAsiento.set(l.asientoId, acc);
  }
  for (const a of asientos) {
    const totalD = dec(a.totalDebe);
    const totalH = dec(a.totalHaber);
    if (!eq(totalD, totalH)) {
      hallazgos.push({
        codigo: "C2",
        severidad: "error",
        mensaje: `Asiento ${a.id} desbalanceado: debe=${totalD} ≠ haber=${totalH}`,
        detalle: { asientoId: a.id, totalDebe: totalD, totalHaber: totalH },
      });
      continue;
    }
    const sumaLineas = lineasPorAsiento.get(a.id) ?? { debe: 0, haber: 0 };
    if (!eq(sumaLineas.debe, totalD) || !eq(sumaLineas.haber, totalH)) {
      hallazgos.push({
        codigo: "C2",
        severidad: "error",
        mensaje: `Asiento ${a.id} líneas no cuadran con totales`,
        detalle: {
          asientoId: a.id,
          totalDebe: totalD,
          totalHaber: totalH,
          sumaLineas,
        },
      });
    }
  }

  // --- C3: saldoActual == suma derivada de líneas -------------------------
  const saldoDerivado = new Map<string, number>();
  for (const l of lineas) {
    saldoDerivado.set(
      l.cuentaId,
      (saldoDerivado.get(l.cuentaId) ?? 0) + (dec(l.debe) - dec(l.haber)),
    );
  }
  for (const c of cuentas) {
    const debe_haber = saldoDerivado.get(c.id) ?? 0;
    const esperado =
      c.tipo === "ACTIVO" || c.tipo === "GASTO" ? debe_haber : -debe_haber;
    const real = dec(c.saldoActual);
    if (!eq(real, esperado)) {
      hallazgos.push({
        codigo: "C3",
        severidad: "error",
        mensaje: `Cuenta ${c.codigo} ${c.nombre}: saldoActual=${real} ≠ derivado=${esperado.toFixed(2)}`,
        detalle: {
          codigo: c.codigo,
          tipo: c.tipo,
          saldoActual: real,
          esperado,
        },
      });
    }
  }

  // --- C1: identidad fundamental Activo = Pasivo + Patrimonio + (Ingreso - Gasto) ----
  let totalActivo = 0;
  let totalPasivo = 0;
  let totalPatrimonio = 0;
  let totalIngreso = 0;
  let totalGasto = 0;
  for (const c of cuentas) {
    const s = dec(c.saldoActual);
    if (c.tipo === "ACTIVO") totalActivo += s;
    else if (c.tipo === "PASIVO") totalPasivo += s;
    else if (c.tipo === "PATRIMONIO") totalPatrimonio += s;
    else if (c.tipo === "INGRESO") totalIngreso += s;
    else if (c.tipo === "GASTO") totalGasto += s;
  }
  const lhs = totalActivo;
  const rhs = totalPasivo + totalPatrimonio + (totalIngreso - totalGasto);
  if (!eq(lhs, rhs)) {
    hallazgos.push({
      codigo: "C1",
      severidad: "error",
      mensaje: `Identidad fundamental rota: Activo=${lhs.toFixed(2)} ≠ Pasivo+Patrimonio+Resultado=${rhs.toFixed(2)} (delta ${(lhs - rhs).toFixed(2)})`,
      detalle: {
        totalActivo,
        totalPasivo,
        totalPatrimonio,
        totalIngreso,
        totalGasto,
      },
    });
  }

  // --- C5: conciliación bancaria del último mes (warn) -------------------
  const ahora = new Date();
  const haceMes = new Date(ahora);
  haceMes.setMonth(haceMes.getMonth() - 1);
  const cargas = await prisma.cargaExtractoBanco.findMany({
    where: { cargadoEn: { gte: haceMes } },
    orderBy: { cargadoEn: "desc" },
    take: 1,
  });
  if (cargas.length > 0) {
    // Si hay extracto reciente, miramos los esperados sin conciliar del mes.
    const desde = new Date(haceMes);
    const espNoConciliados = await prisma.movimientoBancoEsperado.aggregate({
      where: { conciliadoConId: null, fecha: { gte: desde } },
      _sum: { monto: true },
    });
    const sumNoConc = dec(espNoConciliados._sum.monto ?? new Prisma.Decimal(0));
    if (Math.abs(sumNoConc) > TOLERANCIA_BANCO) {
      hallazgos.push({
        codigo: "C5",
        severidad: "warn",
        mensaje: `Caja-Banco vs extracto: ${sumNoConc.toFixed(2)} en esperados sin conciliar (>${TOLERANCIA_BANCO})`,
        detalle: { sumNoConciliados: sumNoConc },
      });
    }
  }

  // --- C6: movimientos reales sin conciliar > 7 días (warn) -------------
  const hace7 = new Date(ahora);
  hace7.setDate(hace7.getDate() - 7);
  const huerfanos = await prisma.movimientoBancoReal.count({
    where: {
      esperados: { none: {} },
      fecha: { lt: hace7 },
    },
  });
  if (huerfanos > 0) {
    hallazgos.push({
      codigo: "C6",
      severidad: "warn",
      mensaje: `${huerfanos} movimientos reales sin conciliar con antigüedad > 7 días`,
      detalle: { count: huerfanos },
    });
  }

  const errores = hallazgos.filter((h) => h.severidad === "error").length;
  const warns = hallazgos.filter((h) => h.severidad === "warn").length;

  return {
    ok: errores === 0,
    scaneadoEn: new Date().toISOString(),
    durationMs: Date.now() - t0,
    hallazgos,
    totalHallazgos: hallazgos.length,
    errores,
    warns,
    totales: {
      cuentas: cuentas.length,
      asientos: asientos.length,
      lineas: lineas.length,
      movimientosEsperados: movEspCount,
      movimientosReales: movRealCount,
    },
  };
}
