// Servicio de usuarios — Sub-Sprint 7.
//
// Expone:
//  - `obtenerMiPerfil(usuarioId)` → perfil completo + stats + nivel
//  - `actualizarPerfil(usuarioId, patch)` → edita nombre, username, ubicación
//    (correo y fecha de nacimiento son INMUTABLES post-registro)
//  - `solicitarEliminarCuenta(usuarioId)` → genera token + envía email
//  - `confirmarEliminarCuenta(token)` → anonimiza PII, marca deletedAt
//  - `generarExportDatos(usuarioId)` → ZIP con datos del usuario (JSON)

import { prisma, Prisma } from "@habla/db";
import crypto from "node:crypto";
import { DomainError, NoAutenticado, ValidacionFallida } from "./errors";
import { logger } from "./logger";
import {
  calcularNivel,
  faltanParaSiguiente,
  siguienteNivel,
  type Nivel,
} from "../utils/nivel";
import { calcularStats } from "./tickets.service";
import {
  notifyDatosDescargados,
  notifySolicitudEliminar,
} from "./notificaciones.service";

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export interface PerfilCompleto {
  id: string;
  email: string;
  nombre: string;
  username: string | null;
  telefono: string | null;
  telefonoVerif: boolean;
  dniVerif: boolean;
  fechaNac: Date | null;
  ubicacion: string | null;
  rol: "JUGADOR" | "ADMIN";
  balanceLukas: number;
  creadoEn: Date;
  image: string | null;
  emailVerified: Date | null;
  nivel: {
    actual: Nivel;
    torneosJugados: number;
    siguiente: Nivel | null;
    faltanParaSiguiente: number;
  };
  stats: Awaited<ReturnType<typeof calcularStats>>;
}

export async function obtenerMiPerfil(usuarioId: string): Promise<PerfilCompleto> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      email: true,
      nombre: true,
      username: true,
      telefono: true,
      telefonoVerif: true,
      dniVerif: true,
      fechaNac: true,
      ubicacion: true,
      rol: true,
      balanceLukas: true,
      creadoEn: true,
      image: true,
      emailVerified: true,
      deletedAt: true,
    },
  });
  if (!usuario || usuario.deletedAt) throw new NoAutenticado();

  // Torneos jugados = tickets únicos por torneo
  const torneosDistintos = await prisma.ticket.findMany({
    where: { usuarioId },
    select: { torneoId: true },
    distinct: ["torneoId"],
  });
  const torneosJugados = torneosDistintos.length;

  const nivelActual = calcularNivel(torneosJugados);
  const stats = await calcularStats(usuarioId);

  return {
    id: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    username: usuario.username,
    telefono: usuario.telefono,
    telefonoVerif: usuario.telefonoVerif,
    dniVerif: usuario.dniVerif,
    fechaNac: usuario.fechaNac,
    ubicacion: usuario.ubicacion,
    rol: usuario.rol,
    balanceLukas: usuario.balanceLukas,
    creadoEn: usuario.creadoEn,
    image: usuario.image,
    emailVerified: usuario.emailVerified,
    nivel: {
      actual: nivelActual,
      torneosJugados,
      siguiente: siguienteNivel(nivelActual),
      faltanParaSiguiente: faltanParaSiguiente(torneosJugados),
    },
    stats,
  };
}

export interface ActualizarPerfilInput {
  nombre?: string;
  username?: string;
  ubicacion?: string;
  telefono?: string;
  image?: string;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/i;

export async function actualizarPerfil(
  usuarioId: string,
  patch: ActualizarPerfilInput,
): Promise<PerfilCompleto> {
  // Validaciones
  if (patch.nombre !== undefined && patch.nombre.trim().length < 2) {
    throw new ValidacionFallida("El nombre debe tener al menos 2 caracteres.", {
      field: "nombre",
    });
  }
  if (patch.username !== undefined) {
    const u = patch.username.trim().toLowerCase();
    if (!USERNAME_REGEX.test(u)) {
      throw new ValidacionFallida(
        "El usuario debe tener 3-20 caracteres (letras, números, guión bajo).",
        { field: "username" },
      );
    }
    // Verificar que no esté tomado por otro usuario
    const existente = await prisma.usuario.findFirst({
      where: { username: u, id: { not: usuarioId } },
      select: { id: true },
    });
    if (existente) {
      throw new DomainError(
        "USERNAME_EN_USO",
        "Ese nombre de usuario ya está tomado.",
        409,
        { field: "username" },
      );
    }
    patch = { ...patch, username: u };
  }

  try {
    await prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        ...(patch.nombre !== undefined ? { nombre: patch.nombre.trim() } : {}),
        ...(patch.username !== undefined ? { username: patch.username } : {}),
        ...(patch.ubicacion !== undefined
          ? { ubicacion: patch.ubicacion.trim() || null }
          : {}),
        ...(patch.telefono !== undefined
          ? { telefono: patch.telefono.trim() || null, telefonoVerif: false }
          : {}),
        ...(patch.image !== undefined ? { image: patch.image } : {}),
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new DomainError(
        "USERNAME_EN_USO",
        "Ese nombre de usuario ya está tomado.",
        409,
      );
    }
    throw err;
  }

  return obtenerMiPerfil(usuarioId);
}

// ---------------------------------------------------------------------------
// Eliminar cuenta (soft delete)
// ---------------------------------------------------------------------------

const ELIMINAR_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h

export async function solicitarEliminarCuenta(
  usuarioId: string,
  baseUrl: string,
): Promise<{ tokenUrl: string; expiraEn: Date; balanceAdvertido: number }> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { balanceLukas: true, email: true, deletedAt: true },
  });
  if (!usuario || usuario.deletedAt) throw new NoAutenticado();

  const token = crypto.randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + ELIMINAR_TOKEN_TTL_MS);

  await prisma.solicitudEliminacion.create({
    data: {
      usuarioId,
      token,
      expiraEn,
    },
  });

  const tokenUrl = `${baseUrl.replace(/\/$/, "")}/perfil/eliminar/confirmar?token=${token}`;

  void notifySolicitudEliminar({
    usuarioId,
    tokenUrl,
    balanceLukas: usuario.balanceLukas,
  });

  logger.info({ usuarioId, expiraEn }, "solicitud eliminar cuenta creada");

  return { tokenUrl, expiraEn, balanceAdvertido: usuario.balanceLukas };
}

export async function confirmarEliminarCuenta(
  token: string,
): Promise<{ usuarioId: string }> {
  const solicitud = await prisma.solicitudEliminacion.findUnique({
    where: { token },
  });
  if (!solicitud) {
    throw new DomainError(
      "TOKEN_INVALIDO",
      "Link inválido o ya usado.",
      404,
    );
  }
  if (solicitud.expiraEn.getTime() < Date.now()) {
    throw new DomainError(
      "TOKEN_EXPIRADO",
      "El link de confirmación expiró. Solicita uno nuevo.",
      410,
    );
  }
  if (solicitud.confirmadaEn) {
    throw new DomainError(
      "YA_CONFIRMADO",
      "Esta solicitud ya fue confirmada.",
      409,
    );
  }

  // Soft delete: anonimiza PII, marca deletedAt, invalida username.
  // Preservamos: transacciones (audit), tickets (integridad de torneos),
  // canjes (audit de premios ya entregados).
  await prisma.$transaction(async (tx) => {
    await tx.solicitudEliminacion.update({
      where: { id: solicitud.id },
      data: { confirmadaEn: new Date() },
    });

    const anonEmail = `deleted-${solicitud.usuarioId.slice(0, 8)}-${Date.now()}@deleted.habla.local`;
    await tx.usuario.update({
      where: { id: solicitud.usuarioId },
      data: {
        nombre: "Usuario eliminado",
        email: anonEmail,
        username: null,
        telefono: null,
        ubicacion: null,
        image: null,
        deletedAt: new Date(),
      },
    });

    // Invalidar sesiones activas
    await tx.session.deleteMany({ where: { userId: solicitud.usuarioId } });
  });

  logger.info({ usuarioId: solicitud.usuarioId }, "cuenta eliminada (soft)");

  return { usuarioId: solicitud.usuarioId };
}

// ---------------------------------------------------------------------------
// Exportar datos (job async — MVP lo hace sync y devuelve el JSON grande)
// ---------------------------------------------------------------------------

export interface DatosExportados {
  perfil: Omit<PerfilCompleto, "nivel" | "stats">;
  transacciones: Array<{
    id: string;
    tipo: string;
    monto: number;
    descripcion: string;
    creadoEn: Date;
  }>;
  tickets: Array<{
    id: string;
    torneoId: string;
    torneoNombre: string;
    predResultado: string;
    predBtts: boolean;
    predMas25: boolean;
    predTarjetaRoja: boolean;
    predMarcadorLocal: number;
    predMarcadorVisita: number;
    puntosTotal: number;
    posicionFinal: number | null;
    premioLukas: number;
    creadoEn: Date;
  }>;
  canjes: Array<{
    id: string;
    premioNombre: string;
    lukasUsados: number;
    estado: string;
    creadoEn: Date;
  }>;
  generadoEn: Date;
}

export async function generarExportDatos(
  usuarioId: string,
): Promise<DatosExportados> {
  const perfil = await obtenerMiPerfil(usuarioId);
  const [transacciones, tickets, canjes] = await Promise.all([
    prisma.transaccionLukas.findMany({
      where: { usuarioId },
      orderBy: { creadoEn: "desc" },
      select: {
        id: true,
        tipo: true,
        monto: true,
        descripcion: true,
        creadoEn: true,
      },
    }),
    prisma.ticket.findMany({
      where: { usuarioId },
      include: { torneo: { select: { nombre: true } } },
      orderBy: { creadoEn: "desc" },
    }),
    prisma.canje.findMany({
      where: { usuarioId },
      include: { premio: { select: { nombre: true } } },
      orderBy: { creadoEn: "desc" },
    }),
  ]);

  const { nivel: _nivel, stats: _stats, ...perfilCore } = perfil;
  return {
    perfil: perfilCore,
    transacciones,
    tickets: tickets.map((t) => ({
      id: t.id,
      torneoId: t.torneoId,
      torneoNombre: t.torneo.nombre,
      predResultado: t.predResultado,
      predBtts: t.predBtts,
      predMas25: t.predMas25,
      predTarjetaRoja: t.predTarjetaRoja,
      predMarcadorLocal: t.predMarcadorLocal,
      predMarcadorVisita: t.predMarcadorVisita,
      puntosTotal: t.puntosTotal,
      posicionFinal: t.posicionFinal,
      premioLukas: t.premioLukas,
      creadoEn: t.creadoEn,
    })),
    canjes: canjes.map((c) => ({
      id: c.id,
      premioNombre: c.premio.nombre,
      lukasUsados: c.lukasUsados,
      estado: c.estado,
      creadoEn: c.creadoEn,
    })),
    generadoEn: new Date(),
  };
}

/**
 * Job del endpoint /me/datos-download: genera el export y lo envía por email
 * como JSON inline (no ZIP — evitamos deps). El usuario baja el archivo.
 */
export async function solicitarExportDatos(
  usuarioId: string,
  baseUrl: string,
): Promise<{ ok: true; urlDescarga: string }> {
  // MVP: generamos un link a `/api/v1/usuarios/me/datos-download/file?u=<id>`
  // que se sirve directo — el token JWT de la sesión ya autentica.
  const urlDescarga = `${baseUrl.replace(/\/$/, "")}/api/v1/usuarios/me/datos-download/file`;
  void notifyDatosDescargados({
    usuarioId,
    urlDescarga,
    expiraEnHoras: 24,
  });
  return { ok: true, urlDescarga };
}
