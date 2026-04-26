// Auditoría completa del sistema de balances de Lukas — Lote 6C-fix3.
//
// Verifica las 13 invariantes que el sistema de 3 bolsas debe cumplir para
// CADA usuario y CADA torneo. Diseñado para ser eficiente: todas las
// queries son agregadas (groupBy) en una sola roundtrip de BD por
// invariante, sin N+1. Para ~1000 usuarios y ~10k transacciones, el scan
// completo termina en <1s.
//
// USO:
//  - `auditarTodos()`: scan masivo. Endpoint admin manual o cron diario.
//  - `auditarUsuario(id)`: drill-down de un solo usuario con detalle
//    cronológico de sus transacciones.
//
// Solo lectura — nunca muta. La corrección la decide el operador caso por
// caso vía endpoints de corrección dedicados.
//
// ============================================================================
// INVARIANTES (lo que el sistema DEBE cumplir):
// ============================================================================
//
// COHERENCIA INTERNA DEL USUARIO:
//   I1. balanceLukas === balanceCompradas + balanceBonus + balanceGanadas
//   I2. balanceLukas === SUM(TransaccionLukas.monto)
//   I3. balanceCompradas === SUM(tx.monto WHERE bolsa=COMPRADAS)
//   I4. balanceBonus === SUM(tx.monto WHERE bolsa=BONUS)
//   I5. balanceGanadas === SUM(tx.monto WHERE bolsa=GANADAS)
//   I6. balanceCompradas === SUM(saldoVivo de COMPRA vigentes con saldoVivo>0)
//   I7. Toda compra con venceEn < now debe tener saldoVivo = 0
//   I8. balanceCompradas/Bonus/Ganadas/Lukas NUNCA pueden ser < 0
//
// COHERENCIA DE TRANSACCIONES:
//   I9.  Toda ENTRADA_TORNEO post-Lote 6A debe tener metadata.composicion
//        Y la suma de los items.monto debe igualar |tx.monto|
//   I10. Todo Ticket debe tener una ENTRADA_TORNEO con metadata.ticketId
//        (excepción: tickets pre-Lote 6A pueden no tener metadata)
//
// COHERENCIA DE TORNEOS:
//   I11. Por torneo: SUM(|ENTRADA_TORNEO|) === pozoBruto
//   I12. Torneo CANCELADO: SUM(REEMBOLSO refId=torneo) === pozoBruto
//   I13. Torneo FINALIZADO: SUM(PREMIO_TORNEO refId=torneo) === pozoNeto
//        Y SUM(tickets.premioLukas) === pozoNeto
// ============================================================================

import { prisma, type BolsaLukas, type TipoTransaccion } from "@habla/db";

// ----------------------------------------------------------------------------
// Tipos
// ----------------------------------------------------------------------------

export type Severidad = "error" | "warn";

export interface Hallazgo {
  /** Código corto: "I1", "I2", ... */
  invariante: string;
  severidad: Severidad;
  mensaje: string;
  usuarioId?: string;
  username?: string;
  torneoId?: string;
  detalle: Record<string, unknown>;
}

export interface InvarianteSummary {
  codigo: string;
  nombre: string;
  descripcion: string;
  /** Cuántos elementos (usuarios o torneos) cumplen la invariante. */
  ok: number;
  /** Cuántos NO cumplen. */
  fallidos: number;
}

export interface ReporteAuditoriaTodos {
  scaneadoEn: string;
  durationMs: number;
  totales: {
    usuariosAuditados: number;
    torneosAuditados: number;
    transaccionesEvaluadas: number;
  };
  invariantes: InvarianteSummary[];
  /** Top N hallazgos. Si supera el límite, ver per-usuario para drill-down. */
  hallazgos: Hallazgo[];
  hallazgosTruncados: boolean;
  totalHallazgos: number;
  usuariosConProblemas: number;
  torneosConProblemas: number;
}

export interface AuditoriaUsuarioReporte {
  usuario: {
    id: string;
    username: string;
    nombre: string;
    deletedAt: Date | null;
    creadoEn: Date;
    /** 4 campos de balance tal cual están en BD. */
    balances: {
      balanceLukas: number;
      balanceCompradas: number;
      balanceBonus: number;
      balanceGanadas: number;
    };
  };
  /** Hallazgos que afectan a este usuario. */
  hallazgos: Hallazgo[];
  /** Comparación entre lo almacenado y lo calculado. */
  reconstruccion: {
    sumaBolsasAlmacenadas: number;
    sumaTxTotal: number;
    sumaTxPorBolsa: {
      COMPRADAS: number;
      BONUS: number;
      GANADAS: number;
      sinBolsa: number;
    };
    sumaTxPorTipo: Record<string, { count: number; monto: number }>;
    saldoVivoCompradasVigentes: number;
  };
  /** Transacciones cronológicas (más nuevas primero). Limitado a 200. */
  transacciones: Array<{
    id: string;
    creadoEn: Date;
    tipo: TipoTransaccion;
    bolsa: BolsaLukas | null;
    monto: number;
    descripcion: string;
    refId: string | null;
    saldoVivo: number | null;
    venceEn: Date | null;
  }>;
}

const MAX_HALLAZGOS_TODOS = 100;
const MAX_TX_PER_USER = 200;

// Catálogo de invariantes — descripciones canónicas para el reporte.
const INVARIANTES_META: Record<string, Pick<InvarianteSummary, "codigo" | "nombre" | "descripcion">> = {
  I1: {
    codigo: "I1",
    nombre: "Suma de bolsas == balanceLukas",
    descripcion: "balanceLukas debe ser exactamente balanceCompradas + balanceBonus + balanceGanadas.",
  },
  I2: {
    codigo: "I2",
    nombre: "Suma de transacciones == balanceLukas",
    descripcion: "La suma de TODAS las TransaccionLukas.monto del usuario debe igualar balanceLukas.",
  },
  I3: {
    codigo: "I3",
    nombre: "Compradas en BD == suma tx COMPRADAS",
    descripcion: "balanceCompradas debe igualar la suma de transacciones con bolsa=COMPRADAS.",
  },
  I4: {
    codigo: "I4",
    nombre: "Bonus en BD == suma tx BONUS",
    descripcion: "balanceBonus debe igualar la suma de transacciones con bolsa=BONUS.",
  },
  I5: {
    codigo: "I5",
    nombre: "Ganadas en BD == suma tx GANADAS",
    descripcion: "balanceGanadas debe igualar la suma de transacciones con bolsa=GANADAS.",
  },
  I6: {
    codigo: "I6",
    nombre: "Compradas == saldoVivo de compras vigentes",
    descripcion: "balanceCompradas debe igualar la suma de saldoVivo de las COMPRA vigentes (no vencidas).",
  },
  I7: {
    codigo: "I7",
    nombre: "Compras vencidas con saldoVivo > 0",
    descripcion: "Toda compra con venceEn pasado debe tener saldoVivo = 0 (vencida).",
  },
  I8: {
    codigo: "I8",
    nombre: "Balances negativos",
    descripcion: "Ningún campo balance puede ser menor a 0.",
  },
  I9: {
    codigo: "I9",
    nombre: "ENTRADA_TORNEO sin composición o composición inválida",
    descripcion: "Toda ENTRADA_TORNEO post-Lote 6A debe tener metadata.composicion con suma == |monto|.",
  },
  I10: {
    codigo: "I10",
    nombre: "Ticket sin transacción ENTRADA_TORNEO",
    descripcion: "Todo Ticket debe tener una ENTRADA_TORNEO asociada (refId=torneoId, metadata.ticketId=ticket.id).",
  },
  I11: {
    codigo: "I11",
    nombre: "Pozo bruto != suma de entradas",
    descripcion: "Para cada torneo, la suma de los montos de ENTRADA_TORNEO con refId=torneoId debe igualar pozoBruto.",
  },
  I12: {
    codigo: "I12",
    nombre: "Torneo cancelado: reembolsos != pozo bruto",
    descripcion: "Para torneos CANCELADO, la suma de REEMBOLSO con refId=torneoId debe igualar pozoBruto.",
  },
  I13: {
    codigo: "I13",
    nombre: "Torneo finalizado: premios != pozo neto",
    descripcion: "Para torneos FINALIZADO, la suma de PREMIO_TORNEO con refId=torneoId debe igualar pozoNeto, y suma de tickets.premioLukas también.",
  },
};

// ----------------------------------------------------------------------------
// auditarTodos — scan masivo
// ----------------------------------------------------------------------------

export async function auditarTodos(): Promise<ReporteAuditoriaTodos> {
  const start = Date.now();
  const now = new Date();

  // -- Query 1: usuarios activos con balances ---------------------------
  const usuarios = await prisma.usuario.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      username: true,
      balanceLukas: true,
      balanceCompradas: true,
      balanceBonus: true,
      balanceGanadas: true,
    },
  });
  const usuarioById = new Map(usuarios.map((u) => [u.id, u]));

  // -- Query 2: suma de TODAS las transacciones por usuario --------------
  const sumTotalByUser = await prisma.transaccionLukas.groupBy({
    by: ["usuarioId"],
    _sum: { monto: true },
    _count: true,
  });
  const sumTotalMap = new Map(
    sumTotalByUser.map((r) => [r.usuarioId, r._sum.monto ?? 0]),
  );
  const totalTransacciones = sumTotalByUser.reduce(
    (acc, r) => acc + (r._count ?? 0),
    0,
  );

  // -- Query 3: suma de transacciones por usuario+bolsa ------------------
  const sumByBolsa = await prisma.transaccionLukas.groupBy({
    by: ["usuarioId", "bolsa"],
    _sum: { monto: true },
  });
  // Map<usuarioId, { COMPRADAS, BONUS, GANADAS, sinBolsa }>
  const bolsaMap = new Map<
    string,
    { COMPRADAS: number; BONUS: number; GANADAS: number; sinBolsa: number }
  >();
  for (const r of sumByBolsa) {
    const entry = bolsaMap.get(r.usuarioId) ?? {
      COMPRADAS: 0,
      BONUS: 0,
      GANADAS: 0,
      sinBolsa: 0,
    };
    const monto = r._sum.monto ?? 0;
    if (r.bolsa === "COMPRADAS") entry.COMPRADAS += monto;
    else if (r.bolsa === "BONUS") entry.BONUS += monto;
    else if (r.bolsa === "GANADAS") entry.GANADAS += monto;
    else entry.sinBolsa += monto;
    bolsaMap.set(r.usuarioId, entry);
  }

  // -- Query 4: suma de saldoVivo de compras VIGENTES por usuario --------
  const saldoVivoByUser = await prisma.transaccionLukas.groupBy({
    by: ["usuarioId"],
    where: {
      tipo: "COMPRA",
      saldoVivo: { gt: 0 },
      venceEn: { gt: now },
    },
    _sum: { saldoVivo: true },
  });
  const saldoVivoMap = new Map(
    saldoVivoByUser.map((r) => [r.usuarioId, r._sum.saldoVivo ?? 0]),
  );

  // -- Query 5: compras vencidas que aún tienen saldoVivo > 0 ------------
  const comprasVencidasConSaldo = await prisma.transaccionLukas.findMany({
    where: {
      tipo: "COMPRA",
      saldoVivo: { gt: 0 },
      venceEn: { lt: now },
    },
    select: {
      id: true,
      usuarioId: true,
      saldoVivo: true,
      venceEn: true,
      monto: true,
    },
  });

  // -- Query 6: ENTRADA_TORNEO con monto, metadata, refId ----------------
  // Necesario para I9 (composición) e I11 (suma por torneo).
  const entradas = await prisma.transaccionLukas.findMany({
    where: { tipo: "ENTRADA_TORNEO" },
    select: {
      id: true,
      usuarioId: true,
      refId: true,
      monto: true,
      metadata: true,
      creadoEn: true,
    },
  });

  // -- Query 7: tickets para I10 ----------------------------------------
  const tickets = await prisma.ticket.findMany({
    select: { id: true, usuarioId: true, torneoId: true },
  });

  // -- Query 8: torneos para I11/12/13 ----------------------------------
  const torneos = await prisma.torneo.findMany({
    select: {
      id: true,
      estado: true,
      pozoBruto: true,
      pozoNeto: true,
      totalInscritos: true,
      entradaLukas: true,
    },
  });

  // -- Query 9: reembolsos por refId (para I12) -------------------------
  const reembolsos = await prisma.transaccionLukas.groupBy({
    by: ["refId"],
    where: { tipo: "REEMBOLSO", refId: { not: null } },
    _sum: { monto: true },
  });
  const reembolsosByTorneo = new Map(
    reembolsos.map((r) => [r.refId!, r._sum.monto ?? 0]),
  );

  // -- Query 10: premios por refId (para I13) ---------------------------
  const premios = await prisma.transaccionLukas.groupBy({
    by: ["refId"],
    where: { tipo: "PREMIO_TORNEO", refId: { not: null } },
    _sum: { monto: true },
  });
  const premiosByTorneo = new Map(
    premios.map((r) => [r.refId!, r._sum.monto ?? 0]),
  );

  // -- Query 11: tickets agrupados por torneo con suma de premios -------
  const ticketsPremiosByTorneo = await prisma.ticket.groupBy({
    by: ["torneoId"],
    _sum: { premioLukas: true },
  });
  const ticketsPremiosMap = new Map(
    ticketsPremiosByTorneo.map((r) => [r.torneoId, r._sum.premioLukas ?? 0]),
  );

  // ====================================================================
  // EVALUAR INVARIANTES
  // ====================================================================
  const hallazgos: Hallazgo[] = [];
  const counters: Record<string, { ok: number; fallidos: number }> = {};
  for (const k of Object.keys(INVARIANTES_META)) {
    counters[k] = { ok: 0, fallidos: 0 };
  }
  const usuariosConProblemas = new Set<string>();
  const torneosConProblemas = new Set<string>();

  // Por usuario
  for (const u of usuarios) {
    const bolsas = bolsaMap.get(u.id) ?? {
      COMPRADAS: 0,
      BONUS: 0,
      GANADAS: 0,
      sinBolsa: 0,
    };
    const sumTotal = sumTotalMap.get(u.id) ?? 0;
    const saldoVivo = saldoVivoMap.get(u.id) ?? 0;

    // -- I1: balanceLukas === sum(3 bolsas) ----------------------------
    const sumaBolsas = u.balanceCompradas + u.balanceBonus + u.balanceGanadas;
    if (u.balanceLukas !== sumaBolsas) {
      hallazgos.push({
        invariante: "I1",
        severidad: "error",
        mensaje: `balanceLukas (${u.balanceLukas}) != suma bolsas (${sumaBolsas})`,
        usuarioId: u.id,
        username: u.username,
        detalle: {
          balanceLukas: u.balanceLukas,
          sumaBolsas,
          delta: u.balanceLukas - sumaBolsas,
          balanceCompradas: u.balanceCompradas,
          balanceBonus: u.balanceBonus,
          balanceGanadas: u.balanceGanadas,
        },
      });
      counters.I1.fallidos++;
      usuariosConProblemas.add(u.id);
    } else {
      counters.I1.ok++;
    }

    // -- I2: balanceLukas === sum(tx.monto) ----------------------------
    if (u.balanceLukas !== sumTotal) {
      hallazgos.push({
        invariante: "I2",
        severidad: "error",
        mensaje: `balanceLukas (${u.balanceLukas}) != suma transacciones (${sumTotal})`,
        usuarioId: u.id,
        username: u.username,
        detalle: {
          balanceLukas: u.balanceLukas,
          sumaTransacciones: sumTotal,
          delta: u.balanceLukas - sumTotal,
        },
      });
      counters.I2.fallidos++;
      usuariosConProblemas.add(u.id);
    } else {
      counters.I2.ok++;
    }

    // -- I3/I4/I5: bolsa en BD == suma de tx por bolsa ------------------
    // Nota: tx con bolsa=null (AJUSTE, txs pre-Lote 6A) no se cuentan
    // en ninguna bolsa específica. Por eso permitimos que balanceLukas
    // diverja de la suma por bolsa cuando hay sinBolsa != 0; pero las
    // bolsas individuales SI deben cuadrar con sus tx etiquetadas.
    for (const [bolsa, valorBolsa, sumaBolsa, codigo] of [
      ["COMPRADAS", u.balanceCompradas, bolsas.COMPRADAS, "I3"],
      ["BONUS", u.balanceBonus, bolsas.BONUS, "I4"],
      ["GANADAS", u.balanceGanadas, bolsas.GANADAS, "I5"],
    ] as const) {
      if (valorBolsa !== sumaBolsa) {
        hallazgos.push({
          invariante: codigo,
          severidad: "error",
          mensaje: `balance${bolsa[0]}${bolsa.slice(1).toLowerCase()} (${valorBolsa}) != suma tx ${bolsa} (${sumaBolsa})`,
          usuarioId: u.id,
          username: u.username,
          detalle: {
            bolsa,
            balanceAlmacenado: valorBolsa,
            sumaTransacciones: sumaBolsa,
            delta: valorBolsa - sumaBolsa,
          },
        });
        counters[codigo].fallidos++;
        usuariosConProblemas.add(u.id);
      } else {
        counters[codigo].ok++;
      }
    }

    // -- I6: balanceCompradas == saldoVivo vigente ---------------------
    if (u.balanceCompradas !== saldoVivo) {
      hallazgos.push({
        invariante: "I6",
        severidad: "error",
        mensaje: `balanceCompradas (${u.balanceCompradas}) != suma saldoVivo vigente (${saldoVivo})`,
        usuarioId: u.id,
        username: u.username,
        detalle: {
          balanceCompradas: u.balanceCompradas,
          saldoVivoVigente: saldoVivo,
          delta: u.balanceCompradas - saldoVivo,
        },
      });
      counters.I6.fallidos++;
      usuariosConProblemas.add(u.id);
    } else {
      counters.I6.ok++;
    }

    // -- I8: balances no negativos -------------------------------------
    const negativos: Record<string, number> = {};
    if (u.balanceLukas < 0) negativos.balanceLukas = u.balanceLukas;
    if (u.balanceCompradas < 0) negativos.balanceCompradas = u.balanceCompradas;
    if (u.balanceBonus < 0) negativos.balanceBonus = u.balanceBonus;
    if (u.balanceGanadas < 0) negativos.balanceGanadas = u.balanceGanadas;
    if (Object.keys(negativos).length > 0) {
      hallazgos.push({
        invariante: "I8",
        severidad: "error",
        mensaje: "Balance(s) negativo(s) detectado(s)",
        usuarioId: u.id,
        username: u.username,
        detalle: { negativos },
      });
      counters.I8.fallidos++;
      usuariosConProblemas.add(u.id);
    } else {
      counters.I8.ok++;
    }
  }

  // -- I7: compras vencidas con saldoVivo > 0 (sobre dataset filtrado) -
  // El query 5 ya devuelve solo las que ROMPEN la invariante. Las que
  // cumplen no se cuentan individualmente — reportamos un agregado.
  const totalCompras = await prisma.transaccionLukas.count({
    where: { tipo: "COMPRA" },
  });
  if (comprasVencidasConSaldo.length > 0) {
    for (const c of comprasVencidasConSaldo) {
      const u = usuarioById.get(c.usuarioId);
      hallazgos.push({
        invariante: "I7",
        severidad: "warn",
        mensaje: `Compra vencida (${c.venceEn?.toISOString().slice(0, 10)}) con saldoVivo=${c.saldoVivo}`,
        usuarioId: c.usuarioId,
        username: u?.username,
        detalle: {
          compraId: c.id,
          monto: c.monto,
          saldoVivo: c.saldoVivo,
          venceEn: c.venceEn,
        },
      });
      counters.I7.fallidos++;
      usuariosConProblemas.add(c.usuarioId);
    }
  }
  counters.I7.ok = totalCompras - comprasVencidasConSaldo.length;

  // -- I9: ENTRADA_TORNEO sin composición o composición rota -----------
  for (const e of entradas) {
    const u = usuarioById.get(e.usuarioId);
    const meta = e.metadata as
      | { composicion?: Array<{ bolsa: string; monto: number }>; ticketId?: string }
      | null;
    const composicion = meta?.composicion ?? null;
    if (!composicion || composicion.length === 0) {
      hallazgos.push({
        invariante: "I9",
        severidad: "warn",
        mensaje: "ENTRADA_TORNEO sin metadata.composicion",
        usuarioId: e.usuarioId,
        username: u?.username,
        torneoId: e.refId ?? undefined,
        detalle: {
          txId: e.id,
          monto: e.monto,
          creadoEn: e.creadoEn,
          esPreLote6A: e.creadoEn < new Date("2026-04-25"),
        },
      });
      counters.I9.fallidos++;
      usuariosConProblemas.add(e.usuarioId);
      continue;
    }
    // Validar que la suma de composición == |monto|
    const sumaComp = composicion.reduce((acc, c) => acc + c.monto, 0);
    if (sumaComp !== Math.abs(e.monto)) {
      hallazgos.push({
        invariante: "I9",
        severidad: "error",
        mensaje: `Composición suma ${sumaComp} pero |monto| es ${Math.abs(e.monto)}`,
        usuarioId: e.usuarioId,
        username: u?.username,
        torneoId: e.refId ?? undefined,
        detalle: {
          txId: e.id,
          monto: e.monto,
          sumaComposicion: sumaComp,
          composicion,
        },
      });
      counters.I9.fallidos++;
      usuariosConProblemas.add(e.usuarioId);
    } else {
      counters.I9.ok++;
    }
  }

  // -- I10: ticket sin ENTRADA_TORNEO asociada -------------------------
  // Indexamos entradas por ticketId (de metadata)
  const ticketIdsConEntrada = new Set<string>();
  for (const e of entradas) {
    const meta = e.metadata as { ticketId?: string } | null;
    if (meta?.ticketId) ticketIdsConEntrada.add(meta.ticketId);
  }
  // Para tickets pre-Lote 6A, también aceptamos que exista una
  // ENTRADA_TORNEO con refId=torneoId del mismo usuario (sin matching
  // exacto de ticketId). Indexamos por (usuarioId, torneoId).
  const entradasPorUsuarioTorneo = new Set<string>();
  for (const e of entradas) {
    if (e.refId) entradasPorUsuarioTorneo.add(`${e.usuarioId}::${e.refId}`);
  }
  for (const t of tickets) {
    const matchExacto = ticketIdsConEntrada.has(t.id);
    const matchAprox = entradasPorUsuarioTorneo.has(
      `${t.usuarioId}::${t.torneoId}`,
    );
    if (!matchExacto && !matchAprox) {
      const u = usuarioById.get(t.usuarioId);
      hallazgos.push({
        invariante: "I10",
        severidad: "error",
        mensaje: "Ticket sin ENTRADA_TORNEO asociada",
        usuarioId: t.usuarioId,
        username: u?.username,
        torneoId: t.torneoId,
        detalle: { ticketId: t.id },
      });
      counters.I10.fallidos++;
      usuariosConProblemas.add(t.usuarioId);
    } else {
      counters.I10.ok++;
    }
  }

  // -- I11/I12/I13 — por torneo ----------------------------------------
  // Suma de entradas por torneo
  const entradasByTorneo = new Map<string, number>();
  for (const e of entradas) {
    if (!e.refId) continue;
    const acc = entradasByTorneo.get(e.refId) ?? 0;
    // Suma del valor absoluto (las entradas son negativas)
    entradasByTorneo.set(e.refId, acc + Math.abs(e.monto));
  }

  for (const t of torneos) {
    // I11: pozoBruto == suma entradas
    const sumaEntradas = entradasByTorneo.get(t.id) ?? 0;
    if (sumaEntradas !== t.pozoBruto) {
      hallazgos.push({
        invariante: "I11",
        severidad: "error",
        mensaje: `Torneo: pozoBruto ${t.pozoBruto} != suma entradas ${sumaEntradas}`,
        torneoId: t.id,
        detalle: {
          pozoBruto: t.pozoBruto,
          sumaEntradas,
          totalInscritos: t.totalInscritos,
          entradaLukas: t.entradaLukas,
          delta: t.pozoBruto - sumaEntradas,
        },
      });
      counters.I11.fallidos++;
      torneosConProblemas.add(t.id);
    } else {
      counters.I11.ok++;
    }

    // I12: torneo CANCELADO → reembolsos == pozoBruto
    if (t.estado === "CANCELADO") {
      const sumaReembolsos = reembolsosByTorneo.get(t.id) ?? 0;
      if (sumaReembolsos !== t.pozoBruto) {
        hallazgos.push({
          invariante: "I12",
          severidad: "error",
          mensaje: `Torneo CANCELADO: reembolsos ${sumaReembolsos} != pozoBruto ${t.pozoBruto}`,
          torneoId: t.id,
          detalle: {
            pozoBruto: t.pozoBruto,
            sumaReembolsos,
            delta: t.pozoBruto - sumaReembolsos,
          },
        });
        counters.I12.fallidos++;
        torneosConProblemas.add(t.id);
      } else {
        counters.I12.ok++;
      }
    }

    // I13: torneo FINALIZADO → premios == pozoNeto
    if (t.estado === "FINALIZADO") {
      const sumaPremios = premiosByTorneo.get(t.id) ?? 0;
      const sumaTicketsPremios = ticketsPremiosMap.get(t.id) ?? 0;
      const errorTx = sumaPremios !== t.pozoNeto;
      const errorTickets = sumaTicketsPremios !== t.pozoNeto;
      if (errorTx || errorTickets) {
        hallazgos.push({
          invariante: "I13",
          severidad: "error",
          mensaje: `Torneo FINALIZADO: pozoNeto=${t.pozoNeto}, premiosTx=${sumaPremios}, ticketsPremios=${sumaTicketsPremios}`,
          torneoId: t.id,
          detalle: {
            pozoNeto: t.pozoNeto,
            sumaPremiosTx: sumaPremios,
            sumaTicketsPremios,
            deltaTx: t.pozoNeto - sumaPremios,
            deltaTickets: t.pozoNeto - sumaTicketsPremios,
          },
        });
        counters.I13.fallidos++;
        torneosConProblemas.add(t.id);
      } else {
        counters.I13.ok++;
      }
    }
  }

  // ====================================================================
  // ARMAR SUMARIO
  // ====================================================================
  const invariantes: InvarianteSummary[] = Object.keys(INVARIANTES_META).map(
    (k) => ({
      ...INVARIANTES_META[k]!,
      ok: counters[k]!.ok,
      fallidos: counters[k]!.fallidos,
    }),
  );

  const totalHallazgos = hallazgos.length;
  // Ordenar: errors antes que warns; mismo severidad, por código.
  hallazgos.sort((a, b) => {
    const sevDiff = (a.severidad === "error" ? 0 : 1) - (b.severidad === "error" ? 0 : 1);
    if (sevDiff !== 0) return sevDiff;
    return a.invariante.localeCompare(b.invariante);
  });
  const truncados = hallazgos.length > MAX_HALLAZGOS_TODOS;
  const slice = truncados ? hallazgos.slice(0, MAX_HALLAZGOS_TODOS) : hallazgos;

  return {
    scaneadoEn: now.toISOString(),
    durationMs: Date.now() - start,
    totales: {
      usuariosAuditados: usuarios.length,
      torneosAuditados: torneos.length,
      transaccionesEvaluadas: totalTransacciones,
    },
    invariantes,
    hallazgos: slice,
    hallazgosTruncados: truncados,
    totalHallazgos,
    usuariosConProblemas: usuariosConProblemas.size,
    torneosConProblemas: torneosConProblemas.size,
  };
}

// ----------------------------------------------------------------------------
// auditarUsuario — drill-down per-user
// ----------------------------------------------------------------------------

export async function auditarUsuario(
  usuarioId: string,
): Promise<AuditoriaUsuarioReporte | null> {
  const now = new Date();

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      username: true,
      nombre: true,
      deletedAt: true,
      creadoEn: true,
      balanceLukas: true,
      balanceCompradas: true,
      balanceBonus: true,
      balanceGanadas: true,
    },
  });
  if (!usuario) return null;

  const transacciones = await prisma.transaccionLukas.findMany({
    where: { usuarioId },
    orderBy: { creadoEn: "desc" },
    take: MAX_TX_PER_USER,
    select: {
      id: true,
      creadoEn: true,
      tipo: true,
      bolsa: true,
      monto: true,
      descripcion: true,
      refId: true,
      saldoVivo: true,
      venceEn: true,
      metadata: true,
    },
  });

  // Agregados (sobre TODAS las tx del usuario, no solo el slice)
  const aggBolsa = await prisma.transaccionLukas.groupBy({
    by: ["bolsa"],
    where: { usuarioId },
    _sum: { monto: true },
  });
  const aggTipo = await prisma.transaccionLukas.groupBy({
    by: ["tipo"],
    where: { usuarioId },
    _sum: { monto: true },
    _count: true,
  });
  const aggSaldoVivoVigente = await prisma.transaccionLukas.aggregate({
    where: {
      usuarioId,
      tipo: "COMPRA",
      saldoVivo: { gt: 0 },
      venceEn: { gt: now },
    },
    _sum: { saldoVivo: true },
  });
  const sumTotalTx = await prisma.transaccionLukas.aggregate({
    where: { usuarioId },
    _sum: { monto: true },
  });

  const sumaTxPorBolsa = {
    COMPRADAS: 0,
    BONUS: 0,
    GANADAS: 0,
    sinBolsa: 0,
  };
  for (const r of aggBolsa) {
    const monto = r._sum.monto ?? 0;
    if (r.bolsa === "COMPRADAS") sumaTxPorBolsa.COMPRADAS = monto;
    else if (r.bolsa === "BONUS") sumaTxPorBolsa.BONUS = monto;
    else if (r.bolsa === "GANADAS") sumaTxPorBolsa.GANADAS = monto;
    else sumaTxPorBolsa.sinBolsa = monto;
  }
  const sumaTxPorTipo: Record<string, { count: number; monto: number }> = {};
  for (const r of aggTipo) {
    sumaTxPorTipo[r.tipo] = {
      count: r._count,
      monto: r._sum.monto ?? 0,
    };
  }

  // Hallazgos del usuario (subset de las invariantes que aplican a él)
  const hallazgos: Hallazgo[] = [];
  const sumaBolsasAlmacenadas =
    usuario.balanceCompradas + usuario.balanceBonus + usuario.balanceGanadas;
  const sumTotal = sumTotalTx._sum.monto ?? 0;
  const saldoVivoVigente = aggSaldoVivoVigente._sum.saldoVivo ?? 0;

  if (usuario.balanceLukas !== sumaBolsasAlmacenadas) {
    hallazgos.push({
      invariante: "I1",
      severidad: "error",
      mensaje: `balanceLukas (${usuario.balanceLukas}) != suma bolsas (${sumaBolsasAlmacenadas})`,
      usuarioId: usuario.id,
      username: usuario.username,
      detalle: {
        balanceLukas: usuario.balanceLukas,
        sumaBolsas: sumaBolsasAlmacenadas,
        delta: usuario.balanceLukas - sumaBolsasAlmacenadas,
      },
    });
  }
  if (usuario.balanceLukas !== sumTotal) {
    hallazgos.push({
      invariante: "I2",
      severidad: "error",
      mensaje: `balanceLukas (${usuario.balanceLukas}) != suma tx (${sumTotal})`,
      usuarioId: usuario.id,
      username: usuario.username,
      detalle: {
        balanceLukas: usuario.balanceLukas,
        sumaTransacciones: sumTotal,
        delta: usuario.balanceLukas - sumTotal,
      },
    });
  }
  for (const [bolsa, valorBolsa, sumaBolsa, codigo] of [
    ["COMPRADAS", usuario.balanceCompradas, sumaTxPorBolsa.COMPRADAS, "I3"],
    ["BONUS", usuario.balanceBonus, sumaTxPorBolsa.BONUS, "I4"],
    ["GANADAS", usuario.balanceGanadas, sumaTxPorBolsa.GANADAS, "I5"],
  ] as const) {
    if (valorBolsa !== sumaBolsa) {
      hallazgos.push({
        invariante: codigo,
        severidad: "error",
        mensaje: `balance${bolsa} (${valorBolsa}) != suma tx ${bolsa} (${sumaBolsa})`,
        usuarioId: usuario.id,
        username: usuario.username,
        detalle: {
          bolsa,
          balanceAlmacenado: valorBolsa,
          sumaTransacciones: sumaBolsa,
          delta: valorBolsa - sumaBolsa,
        },
      });
    }
  }
  if (usuario.balanceCompradas !== saldoVivoVigente) {
    hallazgos.push({
      invariante: "I6",
      severidad: "error",
      mensaje: `balanceCompradas (${usuario.balanceCompradas}) != saldoVivo vigente (${saldoVivoVigente})`,
      usuarioId: usuario.id,
      username: usuario.username,
      detalle: {
        balanceCompradas: usuario.balanceCompradas,
        saldoVivoVigente,
        delta: usuario.balanceCompradas - saldoVivoVigente,
      },
    });
  }
  // I8 negativos
  const negativos: Record<string, number> = {};
  if (usuario.balanceLukas < 0) negativos.balanceLukas = usuario.balanceLukas;
  if (usuario.balanceCompradas < 0) negativos.balanceCompradas = usuario.balanceCompradas;
  if (usuario.balanceBonus < 0) negativos.balanceBonus = usuario.balanceBonus;
  if (usuario.balanceGanadas < 0) negativos.balanceGanadas = usuario.balanceGanadas;
  if (Object.keys(negativos).length > 0) {
    hallazgos.push({
      invariante: "I8",
      severidad: "error",
      mensaje: "Balance(s) negativo(s)",
      usuarioId: usuario.id,
      username: usuario.username,
      detalle: { negativos },
    });
  }

  return {
    usuario: {
      id: usuario.id,
      username: usuario.username,
      nombre: usuario.nombre,
      deletedAt: usuario.deletedAt,
      creadoEn: usuario.creadoEn,
      balances: {
        balanceLukas: usuario.balanceLukas,
        balanceCompradas: usuario.balanceCompradas,
        balanceBonus: usuario.balanceBonus,
        balanceGanadas: usuario.balanceGanadas,
      },
    },
    hallazgos,
    reconstruccion: {
      sumaBolsasAlmacenadas,
      sumaTxTotal: sumTotal,
      sumaTxPorBolsa,
      sumaTxPorTipo,
      saldoVivoCompradasVigentes: saldoVivoVigente,
    },
    transacciones: transacciones.map((t) => ({
      id: t.id,
      creadoEn: t.creadoEn,
      tipo: t.tipo,
      bolsa: t.bolsa,
      monto: t.monto,
      descripcion: t.descripcion,
      refId: t.refId,
      saldoVivo: t.saldoVivo,
      venceEn: t.venceEn,
    })),
  };
}
