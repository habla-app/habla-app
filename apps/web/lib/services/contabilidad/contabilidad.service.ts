// Contabilidad de partida doble — Lote 8.
//
// Cada función pública emite un asiento balanceado (debe = haber), inserta
// sus líneas, actualiza `CuentaContable.saldoActual` según la regla del
// tipo de cuenta, y proyecta los movimientos esperados a Caja-Banco si el
// asiento toca esa cuenta.
//
// Reglas críticas:
//  - Los hooks que mutan negocio (compra Lukas, cierre torneo, canje) DEBEN
//    invocar la función contable correspondiente DENTRO de la misma
//    `prisma.$transaction` para que la atomicidad sea total.
//  - Toda función acepta un `tx?` opcional. Si no se pasa, abre su propia tx.
//  - `totalDebe === totalHaber` es validado antes de commitear. Si no calza,
//    se aborta con error explícito (regression catcher).
//
// Si un asiento debe registrarse pero ya existe (idempotencia: misma
// `origenTipo` + `origenId`), las funciones de hook hacen no-op silencioso.

import { prisma, Prisma, type Asiento } from "@habla/db";
import { COD, IGV_PCT, PLAN_DE_CUENTAS } from "./plan-de-cuentas";
import { logger } from "../logger";
import { getPack, type PackLukasId } from "../../constants/packs-lukas";

type Tx = Prisma.TransactionClient;

// ----------------------------------------------------------------------------
// Tipos auxiliares
// ----------------------------------------------------------------------------

export interface LineaInput {
  /** Código de cuenta (no ID — resolvemos ID adentro). */
  codigo: string;
  debe?: number;
  haber?: number;
  descripcion?: string;
}

export interface RegistrarAsientoInput {
  origenTipo: string;
  origenId?: string | null;
  descripcion: string;
  fecha?: Date;
  metadata?: Record<string, unknown>;
  lineas: LineaInput[];
}

const D = (n: number) => new Prisma.Decimal(n.toFixed(2));

// ----------------------------------------------------------------------------
// Plan de cuentas — seed/resolver
// ----------------------------------------------------------------------------

/** Idempotente: crea las 11 cuentas si no existen, no toca si existen. */
export async function asegurarPlanDeCuentas(tx?: Tx) {
  const client = tx ?? prisma;
  for (const c of PLAN_DE_CUENTAS) {
    await client.cuentaContable.upsert({
      where: { codigo: c.codigo },
      update: { nombre: c.nombre, tipo: c.tipo },
      create: { codigo: c.codigo, nombre: c.nombre, tipo: c.tipo },
    });
  }
}

/** Resuelve { codigo → { id, tipo } } en una sola query. */
async function resolverCuentas(
  tx: Tx,
  codigos: string[],
): Promise<Map<string, { id: string; tipo: string }>> {
  const rows = await tx.cuentaContable.findMany({
    where: { codigo: { in: codigos } },
    select: { id: true, codigo: true, tipo: true },
  });
  const m = new Map<string, { id: string; tipo: string }>();
  for (const r of rows) m.set(r.codigo, { id: r.id, tipo: r.tipo });
  for (const c of codigos) {
    if (!m.has(c)) {
      throw new Error(
        `Plan de cuentas incompleto: falta cuenta ${c}. Corre POST /admin/contabilidad/apertura.`,
      );
    }
  }
  return m;
}

// ----------------------------------------------------------------------------
// Núcleo: registrar asiento balanceado + proyectar movimientos a banco
// ----------------------------------------------------------------------------

async function registrarAsiento(
  tx: Tx,
  input: RegistrarAsientoInput,
): Promise<Asiento> {
  if (input.lineas.length < 2) {
    throw new Error(
      `Asiento inválido: requiere al menos 2 líneas, recibió ${input.lineas.length}`,
    );
  }

  let totalDebe = 0;
  let totalHaber = 0;
  for (const l of input.lineas) {
    const debe = l.debe ?? 0;
    const haber = l.haber ?? 0;
    if (debe < 0 || haber < 0) {
      throw new Error("Asiento inválido: debe/haber no pueden ser negativos.");
    }
    if (debe > 0 && haber > 0) {
      throw new Error(
        "Asiento inválido: una línea no puede tener debe Y haber a la vez.",
      );
    }
    totalDebe += debe;
    totalHaber += haber;
  }

  const debeR = Math.round(totalDebe * 100) / 100;
  const haberR = Math.round(totalHaber * 100) / 100;
  if (debeR !== haberR) {
    throw new Error(
      `Asiento desbalanceado: debe=${debeR} ≠ haber=${haberR} (origen=${input.origenTipo}/${input.origenId ?? "null"})`,
    );
  }

  const codigos = input.lineas.map((l) => l.codigo);
  const cuentas = await resolverCuentas(tx, codigos);

  const asiento = await tx.asiento.create({
    data: {
      fecha: input.fecha ?? new Date(),
      origenTipo: input.origenTipo,
      origenId: input.origenId ?? null,
      descripcion: input.descripcion,
      totalDebe: D(debeR),
      totalHaber: D(haberR),
      ...(input.metadata !== undefined
        ? { metadata: input.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });

  // Inserta líneas y actualiza saldo de cuentas en el mismo tx.
  for (const l of input.lineas) {
    const c = cuentas.get(l.codigo)!;
    const debe = l.debe ?? 0;
    const haber = l.haber ?? 0;

    await tx.asientoLinea.create({
      data: {
        asientoId: asiento.id,
        cuentaId: c.id,
        debe: D(debe),
        haber: D(haber),
        descripcion: l.descripcion ?? null,
      },
    });

    // Regla de actualización de saldo:
    //  - ACTIVO/GASTO: saldoActual += debe - haber
    //  - PASIVO/PATRIMONIO/INGRESO: saldoActual += haber - debe
    const delta =
      c.tipo === "ACTIVO" || c.tipo === "GASTO"
        ? debe - haber
        : haber - debe;
    if (delta !== 0) {
      await tx.cuentaContable.update({
        where: { id: c.id },
        data: { saldoActual: { increment: D(delta) } },
      });
    }

    // Si la línea toca Caja-Banco, proyectamos a MovimientoBancoEsperado.
    // Convención de signo: debe → entrada (positivo), haber → salida (negativo).
    if (l.codigo === COD.CAJA_BANCO) {
      const monto = debe > 0 ? debe : -haber;
      if (monto !== 0) {
        await tx.movimientoBancoEsperado.create({
          data: {
            fecha: asiento.fecha,
            monto: D(monto),
            descripcion: l.descripcion ?? input.descripcion,
            asientoId: asiento.id,
          },
        });
      }
    }
  }

  return asiento;
}

// ----------------------------------------------------------------------------
// Helpers comunes
// ----------------------------------------------------------------------------

function withTx<T>(
  fn: (tx: Tx) => Promise<T>,
  tx?: Tx,
): Promise<T> {
  if (tx) return fn(tx);
  return prisma.$transaction((innerTx) => fn(innerTx));
}

async function yaExiste(
  tx: Tx,
  origenTipo: string,
  origenId: string | null,
): Promise<boolean> {
  const existing = await tx.asiento.findFirst({
    where: { origenTipo, origenId },
    select: { id: true },
  });
  return !!existing;
}

// ----------------------------------------------------------------------------
// Funciones públicas (8 hooks)
// ----------------------------------------------------------------------------

/** Idempotente: si ya hay un asiento APERTURA, no hace nada. */
export async function registrarApertura(
  montoInicial: number,
  tx?: Tx,
): Promise<Asiento | null> {
  return withTx(async (innerTx) => {
    await asegurarPlanDeCuentas(innerTx);
    if (await yaExiste(innerTx, "APERTURA", null)) {
      logger.info("registrarApertura: asiento ya existe, skip");
      return null;
    }
    if (montoInicial <= 0) {
      throw new Error("registrarApertura: montoInicial debe ser > 0");
    }
    return registrarAsiento(innerTx, {
      origenTipo: "APERTURA",
      origenId: null,
      descripcion: `Apertura de Caja-Banco con S/ ${montoInicial.toFixed(2)} de capital`,
      lineas: [
        { codigo: COD.CAJA_BANCO, debe: montoInicial, descripcion: "Capital inicial Habla" },
        { codigo: COD.CAPITAL,    haber: montoInicial },
      ],
    });
  }, tx);
}

/**
 * Compra Lukas con Culqi. Llamado desde el webhook tras acreditar Lukas
 * al usuario, dentro de la misma tx para que sea atómico.
 *
 * El bonus del pack (si aplica) se contabiliza por separado vía
 * `registrarBonusEmitido(usuarioId, pack.bonus, "pack_bonus", tx)`.
 */
export async function registrarCompraLukas(
  usuarioId: string,
  packId: PackLukasId,
  cargoId: string,
  tx?: Tx,
): Promise<Asiento> {
  const pack = getPack(packId);
  if (!pack) throw new Error(`registrarCompraLukas: pack ${packId} no existe`);

  return withTx(async (innerTx) => {
    return registrarAsiento(innerTx, {
      origenTipo: "COMPRA_LUKAS",
      origenId: cargoId,
      descripcion: `Compra Pack ${pack.id} (S/ ${pack.soles}) por ${usuarioId}`,
      metadata: { usuarioId, packId, monto: pack.soles, lukas: pack.lukas },
      lineas: [
        { codigo: COD.CAJA_BANCO,       debe: pack.soles,  descripcion: `Cargo Culqi ${cargoId}` },
        { codigo: COD.PASIVO_COMPRADAS, haber: pack.soles, descripcion: `Lukas Compradas para ${usuarioId}` },
      ],
    });
  }, tx);
}

export type MotivoBonus = "pack_bonus" | "bienvenida" | "manual";

/**
 * Emite Lukas BONUS al usuario. El costo se carga a marketing.
 *  DEBE  Costo Marketing-Bonus
 *  HABER Pasivo Bonus
 */
export async function registrarBonusEmitido(
  usuarioId: string,
  montoLukas: number,
  motivo: MotivoBonus,
  tx?: Tx,
): Promise<Asiento> {
  if (montoLukas <= 0) {
    throw new Error("registrarBonusEmitido: monto debe ser > 0");
  }
  return withTx(async (innerTx) => {
    return registrarAsiento(innerTx, {
      origenTipo: "BONUS_EMITIDO",
      origenId: usuarioId,
      descripcion: `Bonus ${motivo} (${montoLukas} Lukas) a ${usuarioId}`,
      metadata: { usuarioId, motivo, montoLukas },
      lineas: [
        { codigo: COD.COSTO_BONUS,  debe: montoLukas },
        { codigo: COD.PASIVO_BONUS, haber: montoLukas },
      ],
    });
  }, tx);
}

/**
 * Cierre de torneo. El rake bruto se compone de las 3 bolsas según las
 * `TransaccionLukas ENTRADA_TORNEO` (FIFO Bonus → Compradas → Ganadas);
 * sumamos los descuentos por bolsa y los giramos a:
 *   DEBE  Pasivo {Bonus, Compradas, Ganadas}   ← rake del torneo
 *   HABER Ingreso por Rake (× 100/118)
 *   HABER IGV por Pagar    (× 18/118)
 *
 * Idempotente por (origenTipo=CIERRE_TORNEO, origenId=torneoId).
 */
export async function registrarCierreTorneo(
  torneoId: string,
  tx?: Tx,
): Promise<Asiento | null> {
  return withTx(async (innerTx) => {
    if (await yaExiste(innerTx, "CIERRE_TORNEO", torneoId)) {
      return null;
    }

    const torneo = await innerTx.torneo.findUnique({
      where: { id: torneoId },
      select: { rake: true, pozoBruto: true, nombre: true },
    });
    if (!torneo || torneo.rake <= 0) return null;

    // Composición proporcional del rake según los descuentos de inscripción.
    // Para cada ENTRADA_TORNEO de este torneo, leemos su `metadata.composicion`
    // y agregamos por bolsa.
    const entradas = await innerTx.transaccionLukas.findMany({
      where: { tipo: "ENTRADA_TORNEO", refId: torneoId },
      select: { monto: true, metadata: true },
    });

    const totalEntradas = entradas.reduce((acc, e) => acc + Math.abs(e.monto), 0);
    if (totalEntradas <= 0) return null;

    let bonusDescontado = 0;
    let compradasDescontado = 0;
    let ganadasDescontado = 0;

    for (const e of entradas) {
      const md = (e.metadata as { composicion?: { bolsa: string; monto: number }[] } | null) ?? null;
      const comp = md?.composicion;
      if (Array.isArray(comp) && comp.length > 0) {
        for (const c of comp) {
          if (c.bolsa === "BONUS") bonusDescontado += c.monto;
          else if (c.bolsa === "COMPRADAS") compradasDescontado += c.monto;
          else if (c.bolsa === "GANADAS") ganadasDescontado += c.monto;
        }
      } else {
        // Fallback (txs pre-Lote 6A): se asume Bonus.
        bonusDescontado += Math.abs(e.monto);
      }
    }

    // Proporción del rake = rake / totalEntradas.
    const ratio = torneo.rake / totalEntradas;
    const rakeBonus     = Math.round(bonusDescontado     * ratio * 100) / 100;
    const rakeCompradas = Math.round(compradasDescontado * ratio * 100) / 100;
    const rakeGanadas   = Math.round(ganadasDescontado   * ratio * 100) / 100;

    let rakeTotal = rakeBonus + rakeCompradas + rakeGanadas;
    // Ajuste por redondeo: si suma != torneo.rake, sumamos el delta a la
    // bolsa con mayor descuento para que cuadre el asiento.
    const delta = torneo.rake - rakeTotal;
    if (Math.abs(delta) > 0.001) {
      let bigger: "bonus" | "compradas" | "ganadas" = "bonus";
      if (rakeCompradas >= rakeBonus && rakeCompradas >= rakeGanadas) bigger = "compradas";
      if (rakeGanadas >= rakeBonus && rakeGanadas >= rakeCompradas) bigger = "ganadas";
      if (bigger === "bonus")     rakeTotal = rakeTotal - rakeBonus     + (rakeBonus + delta);
      if (bigger === "compradas") rakeTotal = rakeTotal - rakeCompradas + (rakeCompradas + delta);
      if (bigger === "ganadas")   rakeTotal = rakeTotal - rakeGanadas   + (rakeGanadas + delta);
    }

    // Recalcular tras delta:
    const recalc = bonusDescontado + compradasDescontado + ganadasDescontado;
    const fix = (n: number) => Math.round(n * 100) / 100;
    const fBonus = fix(rakeBonus);
    const fComp = fix(rakeCompradas);
    let fGan = fix(torneo.rake - fBonus - fComp);
    if (recalc <= 0) fGan = 0;
    if (fGan < 0) fGan = 0;

    const ingresoNeto = fix(torneo.rake * 100 / (100 + IGV_PCT));
    const igv = fix(torneo.rake - ingresoNeto);

    const lineas: LineaInput[] = [];
    if (fBonus > 0) lineas.push({ codigo: COD.PASIVO_BONUS,     debe: fBonus,     descripcion: "Rake desde Bonus" });
    if (fComp > 0)  lineas.push({ codigo: COD.PASIVO_COMPRADAS, debe: fComp,      descripcion: "Rake desde Compradas" });
    if (fGan > 0)   lineas.push({ codigo: COD.PASIVO_GANADAS,   debe: fGan,       descripcion: "Rake desde Ganadas" });
    lineas.push({ codigo: COD.ING_RAKE,     haber: ingresoNeto, descripcion: "Ingreso neto por rake" });
    lineas.push({ codigo: COD.IGV_POR_PAGAR, haber: igv,        descripcion: "IGV 18% por pagar" });

    return registrarAsiento(innerTx, {
      origenTipo: "CIERRE_TORNEO",
      origenId: torneoId,
      descripcion: `Cierre torneo ${torneo.nombre}: rake S/ ${torneo.rake.toFixed(2)}`,
      metadata: {
        torneoId,
        rakeTotal: torneo.rake,
        composicion: { bonus: fBonus, compradas: fComp, ganadas: fGan },
      },
      lineas,
    });
  }, tx);
}

/**
 * Aprobación de canje (PENDIENTE → PROCESANDO). Reconoce el ingreso por
 * canjes (neto + IGV) y descarga la bolsa Ganadas.
 *  DEBE  Pasivo Ganadas        lukasUsados
 *  HABER Ingreso por Canjes    (× 100/118)
 *  HABER IGV por Pagar         (× 18/118)
 *
 * Idempotente por canjeId.
 */
export async function registrarCanjeAprobado(
  canjeId: string,
  tx?: Tx,
): Promise<Asiento | null> {
  return withTx(async (innerTx) => {
    if (await yaExiste(innerTx, "CANJE_APROBADO", canjeId)) {
      return null;
    }

    const canje = await innerTx.canje.findUnique({
      where: { id: canjeId },
      include: { premio: { select: { nombre: true } } },
    });
    if (!canje) throw new Error(`registrarCanjeAprobado: canje ${canjeId} no existe`);

    const lukas = canje.lukasUsados;
    if (lukas <= 0) return null;
    const ingresoNeto = Math.round((lukas * 100) / (100 + IGV_PCT) * 100) / 100;
    const igv = Math.round((lukas - ingresoNeto) * 100) / 100;

    return registrarAsiento(innerTx, {
      origenTipo: "CANJE_APROBADO",
      origenId: canjeId,
      descripcion: `Canje aprobado: ${canje.premio.nombre} (${lukas} Lukas)`,
      metadata: { canjeId, premioId: canje.premioId, lukas, ingresoNeto, igv },
      lineas: [
        { codigo: COD.PASIVO_GANADAS,  debe: lukas },
        { codigo: COD.ING_CANJES,      haber: ingresoNeto, descripcion: "Ingreso neto por canje" },
        { codigo: COD.IGV_POR_PAGAR,   haber: igv,         descripcion: "IGV 18% por pagar" },
      ],
    });
  }, tx);
}

/**
 * Compra del premio físico para enviarlo (acción admin manual).
 *  DEBE  Costo Premios Físicos
 *  HABER Caja-Banco
 *
 * Si `costoReal === 0`, no genera asiento.
 */
export async function registrarCompraPremioFisico(
  canjeId: string,
  costoReal: number,
  tx?: Tx,
): Promise<Asiento | null> {
  if (costoReal <= 0) return null;
  return withTx(async (innerTx) => {
    return registrarAsiento(innerTx, {
      origenTipo: "COMPRA_PREMIO_FISICO",
      origenId: canjeId,
      descripcion: `Compra premio físico para canje ${canjeId} (S/ ${costoReal.toFixed(2)})`,
      metadata: { canjeId, costoReal },
      lineas: [
        { codigo: COD.COSTO_PREMIOS, debe: costoReal },
        { codigo: COD.CAJA_BANCO,    haber: costoReal, descripcion: `Pago premio canje ${canjeId}` },
      ],
    });
  }, tx);
}

/**
 * Pago de IGV a SUNAT (admin manual).
 *  DEBE  IGV por Pagar
 *  HABER Caja-Banco
 */
export async function registrarPagoIGV(
  monto: number,
  periodo: string,
  tx?: Tx,
): Promise<Asiento> {
  if (monto <= 0) throw new Error("registrarPagoIGV: monto debe ser > 0");
  return withTx(async (innerTx) => {
    return registrarAsiento(innerTx, {
      origenTipo: "PAGO_IGV",
      origenId: periodo,
      descripcion: `Pago IGV período ${periodo} (S/ ${monto.toFixed(2)})`,
      metadata: { monto, periodo },
      lineas: [
        { codigo: COD.IGV_POR_PAGAR, debe: monto },
        { codigo: COD.CAJA_BANCO,    haber: monto, descripcion: `Pago SUNAT ${periodo}` },
      ],
    });
  }, tx);
}

/**
 * Ajuste manual: el operador ingresa las líneas debe/haber. Validamos cuadre
 * adentro de `registrarAsiento`. origenTipo=AJUSTE_MANUAL, origenId opcional.
 */
export async function registrarAjusteManual(
  lineas: LineaInput[],
  descripcion: string,
  origenId: string | null,
  tx?: Tx,
): Promise<Asiento> {
  return withTx(async (innerTx) => {
    return registrarAsiento(innerTx, {
      origenTipo: "AJUSTE_MANUAL",
      origenId,
      descripcion,
      lineas,
    });
  }, tx);
}

// ----------------------------------------------------------------------------
// Re-exports
// ----------------------------------------------------------------------------

export { COD, IGV_PCT, PLAN_DE_CUENTAS };
