// Servicio de canjes — Sub-Sprint 6.
//
// Flujo crítico: un usuario canjea un premio. Todo atómico:
//   1. Valida que el premio exista, esté activo y tenga stock.
//   2. Valida que el usuario tenga balance suficiente.
//   3. Verifica los límites de juego responsable (auto-exclusión bloquea).
//   4. Si el premio requiere dirección, la exige en el input.
//   5. En $transaction:
//      - Descuenta Lukas del usuario
//      - Decrementa stock del premio
//      - Crea el registro `Canje` con estado PENDIENTE
//      - Crea `TransaccionLukas { tipo: CANJE }`
//   6. Fire-and-forget: dispara email de confirmación respetando preferencias.
//
// Admin CRUD:
//  - listarPendientes → panel /admin
//  - actualizarEstado → transición permitida según máquina de estados
//    (PENDIENTE → PROCESANDO → ENVIADO → ENTREGADO, o → CANCELADO en cualquier etapa ≠ ENTREGADO)
//  - Cancelación reembolsa Lukas + restituye stock.

import { prisma, Prisma, type Canje, type EstadoCanje } from "@habla/db";
import { getBalanceCanjeable } from "../lukas-display";
import {
  BalanceInsuficiente,
  DomainError,
  LimiteExcedido,
  NoAutenticado,
  ValidacionFallida,
} from "./errors";
import { logger } from "./logger";
import { verificarLimiteCanje } from "./limites.service";
import { verificarConsistenciaBalance } from "./balance-consistency.helper";
import {
  notifyCanjeEnviado,
  notifyCanjeEntregado,
  notifyCanjeSolicitado,
} from "./notificaciones.service";
import { registrarCanjeAprobado } from "./contabilidad/contabilidad.service";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface DireccionEnvio {
  nombre: string;
  telefono: string;
  direccion: string;
  ciudad: string;
  referencia?: string;
}

export interface CrearCanjeInput {
  premioId: string;
  direccion?: DireccionEnvio;
}

export interface CrearCanjeResult {
  canje: Canje;
  nuevoBalance: number;
}

// ---------------------------------------------------------------------------
// Crear canje
// ---------------------------------------------------------------------------

export async function crearCanje(
  usuarioId: string,
  input: CrearCanjeInput,
): Promise<CrearCanjeResult> {
  // 1-4: validaciones fuera de la transacción para salir rápido.
  const premio = await prisma.premio.findUnique({ where: { id: input.premioId } });
  if (!premio) {
    throw new DomainError(
      "PREMIO_NO_ENCONTRADO",
      `No existe el premio ${input.premioId}.`,
      404,
    );
  }
  if (!premio.activo) {
    throw new DomainError(
      "PREMIO_INACTIVO",
      "Este premio ya no está disponible.",
      409,
    );
  }
  if (premio.stock <= 0) {
    throw new DomainError("SIN_STOCK", "Este premio se agotó.", 409, {
      premioId: premio.id,
    });
  }

  if (premio.requiereDireccion) {
    if (!input.direccion) {
      throw new ValidacionFallida(
        "Este premio requiere una dirección de envío.",
        { premioId: premio.id },
      );
    }
    if (
      !input.direccion.nombre ||
      !input.direccion.telefono ||
      !input.direccion.direccion ||
      !input.direccion.ciudad
    ) {
      const dir = input.direccion as unknown as Record<string, unknown>;
      throw new ValidacionFallida("Completa todos los campos de dirección.", {
        faltantes: ["nombre", "telefono", "direccion", "ciudad"].filter(
          (k) => !dir[k],
        ),
      });
    }
  }

  // Verificar auto-exclusión (bloquea cualquier acción que mueva Lukas).
  await verificarLimiteCanje({ usuarioId });

  const result = await prisma.$transaction(async (tx) => {
    // Re-leer dentro de la tx para aislar race-conditions (otro canje
    // paralelo que agote stock).
    const usuario = await tx.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        balanceLukas: true,
        balanceCompradas: true,
        balanceBonus: true,
        balanceGanadas: true,
        deletedAt: true,
      },
    });
    if (!usuario || usuario.deletedAt) throw new NoAutenticado();

    const premioDb = await tx.premio.findUnique({
      where: { id: input.premioId },
      select: { stock: true, activo: true, costeLukas: true, nombre: true },
    });
    if (!premioDb || !premioDb.activo) {
      throw new DomainError(
        "PREMIO_NO_ENCONTRADO",
        "Premio no disponible.",
        404,
      );
    }
    if (premioDb.stock <= 0) {
      throw new DomainError("SIN_STOCK", "Este premio se agotó.", 409);
    }

    // Lote 6A: solo se puede canjear con Lukas GANADOS en torneos.
    const canjeable = getBalanceCanjeable(usuario);
    if (canjeable < premioDb.costeLukas) {
      throw new BalanceInsuficiente(canjeable, premioDb.costeLukas);
    }

    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        // Descuenta de balanceGanadas + mantiene balanceLukas en sync
        balanceGanadas: { decrement: premioDb.costeLukas },
        balanceLukas: { decrement: premioDb.costeLukas },
      },
    });

    await tx.premio.update({
      where: { id: input.premioId },
      data: { stock: { decrement: 1 } },
    });

    const canje = await tx.canje.create({
      data: {
        usuarioId,
        premioId: input.premioId,
        lukasUsados: premioDb.costeLukas,
        estado: "PENDIENTE",
        direccion: input.direccion
          ? (input.direccion as unknown as Prisma.InputJsonValue)
          : undefined,
      },
    });

    await tx.transaccionLukas.create({
      data: {
        usuarioId,
        tipo: "CANJE",
        bolsa: "GANADAS",
        monto: -premioDb.costeLukas,
        descripcion: `Canje de ${premioDb.nombre}`,
        refId: canje.id,
      },
    });

    // Lote 6C-fix3: guard de consistencia post-mutación.
    await verificarConsistenciaBalance(tx, usuarioId, "canjes.solicitar");

    return {
      canje,
      nuevoBalance: usuario.balanceLukas - premioDb.costeLukas,
      nombrePremio: premioDb.nombre,
    };
  });

  // Fire-and-forget: email al usuario (no bloquea respuesta).
  void notifyCanjeSolicitado({
    usuarioId,
    nombrePremio: result.nombrePremio,
    lukasUsados: result.canje.lukasUsados,
    requiereDireccion: premio.requiereDireccion,
  });

  logger.info(
    {
      canjeId: result.canje.id,
      usuarioId,
      premioId: premio.id,
      lukas: result.canje.lukasUsados,
      nuevoBalance: result.nuevoBalance,
    },
    "canje creado",
  );

  return { canje: result.canje, nuevoBalance: result.nuevoBalance };
}

// ---------------------------------------------------------------------------
// Mis canjes
// ---------------------------------------------------------------------------

export interface ListarMisCanjesInput {
  estado?: EstadoCanje;
  limit?: number;
  offset?: number;
}

export async function listarMisCanjes(
  usuarioId: string,
  input: ListarMisCanjesInput = {},
) {
  const where: Prisma.CanjeWhereInput = { usuarioId };
  if (input.estado) where.estado = input.estado;

  const [canjes, total] = await Promise.all([
    prisma.canje.findMany({
      where,
      include: { premio: true },
      orderBy: { creadoEn: "desc" },
      take: Math.min(100, input.limit ?? 20),
      skip: input.offset ?? 0,
    }),
    prisma.canje.count({ where }),
  ]);

  return { canjes, total };
}

// ---------------------------------------------------------------------------
// Admin: listar pendientes + transicionar estado
// ---------------------------------------------------------------------------

export async function listarCanjesAdmin(
  filtros: { estado?: EstadoCanje; limit?: number; offset?: number } = {},
) {
  const where: Prisma.CanjeWhereInput = {};
  if (filtros.estado) where.estado = filtros.estado;

  const [canjes, total] = await Promise.all([
    prisma.canje.findMany({
      where,
      include: {
        premio: true,
        usuario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { creadoEn: "desc" },
      take: Math.min(100, filtros.limit ?? 50),
      skip: filtros.offset ?? 0,
    }),
    prisma.canje.count({ where }),
  ]);

  return { canjes, total };
}

// Transiciones permitidas: PENDIENTE -> PROCESANDO -> ENVIADO -> ENTREGADO,
// y CANCELADO permitido desde cualquier estado previo a ENTREGADO.
const TRANSICIONES: Record<EstadoCanje, EstadoCanje[]> = {
  PENDIENTE: ["PROCESANDO", "CANCELADO"],
  PROCESANDO: ["ENVIADO", "CANCELADO"],
  ENVIADO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

export interface ActualizarEstadoInput {
  estado: EstadoCanje;
  metodo?: string; // para ENVIADO
  codigoSeguimiento?: string; // para ENVIADO
  motivoCancelacion?: string; // para CANCELADO
}

export async function actualizarEstadoAdmin(
  canjeId: string,
  input: ActualizarEstadoInput,
): Promise<{ canje: Canje; reembolso?: number }> {
  const canje = await prisma.canje.findUnique({
    where: { id: canjeId },
    include: { premio: true, usuario: { select: { id: true, nombre: true, email: true } } },
  });
  if (!canje) {
    throw new DomainError("CANJE_NO_ENCONTRADO", "Canje no encontrado.", 404);
  }

  const permitidas = TRANSICIONES[canje.estado];
  if (!permitidas.includes(input.estado)) {
    throw new LimiteExcedido(
      `Transición ${canje.estado} → ${input.estado} no permitida.`,
      { desde: canje.estado, hacia: input.estado, permitidas },
    );
  }

  if (input.estado === "CANCELADO") {
    // Reembolso: sumar Lukas al usuario (bolsa GANADAS) + restituir stock + crear transacción.
    const result = await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id: canje.usuarioId },
        data: {
          balanceGanadas: { increment: canje.lukasUsados },
          balanceLukas: { increment: canje.lukasUsados },
        },
      });
      await tx.premio.update({
        where: { id: canje.premioId },
        data: { stock: { increment: 1 } },
      });
      await tx.transaccionLukas.create({
        data: {
          usuarioId: canje.usuarioId,
          tipo: "REEMBOLSO",
          bolsa: "GANADAS",
          monto: canje.lukasUsados,
          descripcion: `Reembolso canje ${canje.premio.nombre}${input.motivoCancelacion ? ` · ${input.motivoCancelacion}` : ""}`,
          refId: canje.id,
        },
      });
      const updated = await tx.canje.update({
        where: { id: canjeId },
        data: { estado: "CANCELADO" },
      });
      // Lote 6C-fix3: guard de consistencia post-mutación.
      await verificarConsistenciaBalance(tx, canje.usuarioId, "canjes.cancelar");
      return updated;
    });
    logger.info(
      { canjeId, reembolso: canje.lukasUsados, usuarioId: canje.usuarioId },
      "canje cancelado + reembolsado",
    );
    return { canje: result, reembolso: canje.lukasUsados };
  }

  // Transiciones no destructivas: update + asiento contable si aplica + notify.
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.canje.update({
      where: { id: canjeId },
      data: { estado: input.estado },
    });
    // Lote 8: aprobación SOLICITADO/PENDIENTE → PROCESANDO genera asiento.
    if (canje.estado === "PENDIENTE" && input.estado === "PROCESANDO") {
      await registrarCanjeAprobado(canjeId, tx);
    }
    return u;
  });

  if (input.estado === "ENVIADO") {
    void notifyCanjeEnviado({
      usuarioId: canje.usuarioId,
      nombrePremio: canje.premio.nombre,
      metodo: input.metodo ?? "Entrega coordinada",
      codigoSeguimiento: input.codigoSeguimiento,
    });
  } else if (input.estado === "ENTREGADO") {
    void notifyCanjeEntregado({
      usuarioId: canje.usuarioId,
      nombrePremio: canje.premio.nombre,
    });
  }

  logger.info(
    { canjeId, estado: input.estado, usuarioId: canje.usuarioId },
    "canje actualizado",
  );
  return { canje: updated };
}
