// Servicio de canjes.
//
// Lote 2 (Abr 2026): demolido el sistema de Lukas. Mientras Lote 3 no
// elimine la tabla Canje + /tienda completa, el flujo de canje se queda
// en modo "tienda en mantenimiento": cualquier intento de crear un canje
// nuevo lanza TIENDA_NO_DISPONIBLE. Las transiciones de estado del admin
// sobre canjes históricos siguen funcionando para no perder trazabilidad
// (ENVIADO/ENTREGADO), pero la cancelación ya no reembolsa nada (no hay
// saldo). Sin transacciones contables nuevas en este lote.

import { prisma, Prisma, type Canje, type EstadoCanje } from "@habla/db";
import {
  DomainError,
  LimiteExcedido,
  toErrorResponse as _toErrorResponse,
} from "./errors";
import { logger } from "./logger";
import {
  notifyCanjeEnviado,
  notifyCanjeEntregado,
} from "./notificaciones.service";

void _toErrorResponse;

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
}

// ---------------------------------------------------------------------------
// Crear canje — disabled hasta que Lote 3 elimine la tienda.
// ---------------------------------------------------------------------------

export async function crearCanje(
  _usuarioId: string,
  _input: CrearCanjeInput,
): Promise<CrearCanjeResult> {
  throw new DomainError(
    "TIENDA_NO_DISPONIBLE",
    "La tienda está en mantenimiento. Esta funcionalidad volverá pronto con un nuevo formato.",
    503,
  );
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

const TRANSICIONES: Record<EstadoCanje, EstadoCanje[]> = {
  PENDIENTE: ["PROCESANDO", "CANCELADO"],
  PROCESANDO: ["ENVIADO", "CANCELADO"],
  ENVIADO: ["ENTREGADO", "CANCELADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

export interface ActualizarEstadoInput {
  estado: EstadoCanje;
  metodo?: string;
  codigoSeguimiento?: string;
  motivoCancelacion?: string;
}

export async function actualizarEstadoAdmin(
  canjeId: string,
  input: ActualizarEstadoInput,
): Promise<{ canje: Canje }> {
  const canje = await prisma.canje.findUnique({
    where: { id: canjeId },
    include: {
      premio: true,
      usuario: { select: { id: true, nombre: true, email: true } },
    },
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

  const updated = await prisma.$transaction(async (tx) => {
    if (input.estado === "CANCELADO") {
      // Lote 2: ya no reembolsamos saldo (no hay sistema de Lukas).
      // Restituimos stock para que admin pueda reasignar el premio.
      await tx.premio.update({
        where: { id: canje.premioId },
        data: { stock: { increment: 1 } },
      });
    }
    return tx.canje.update({
      where: { id: canjeId },
      data: { estado: input.estado },
    });
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
