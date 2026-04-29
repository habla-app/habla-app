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
