// Servicio de usuarios — Sub-Sprint 7.
//
// Expone:
//  - `obtenerMiPerfil(usuarioId)` → perfil completo + stats + nivel
//  - `actualizarPerfil(usuarioId, patch)` → edita nombre, username, ubicación
//    (correo y fecha de nacimiento son INMUTABLES post-registro)
//  - `solicitarEliminarCuenta(usuarioId)` → genera token + envía email
//  - `confirmarEliminarCuenta(token)` → anonimiza PII, marca deletedAt
//  - `generarExportDatos(usuarioId)` → ZIP con datos del usuario (JSON)

import { prisma } from "@habla/db";
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
  notifyCuentaEliminada,
  notifyDatosDescargados,
  notifySolicitudEliminar,
} from "./notificaciones.service";
import { esReservado } from "../config/usernames-reservados";

// ---------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------

export interface PerfilCompleto {
  id: string;
  email: string;
  nombre: string;
  /** @handle público único. NOT NULL en BD desde el registro formal
   *  (Abr 2026) — siempre es string. */
  username: string;
  /** true si el @handle ya fue elegido por el usuario (post-signup o
   *  post-completar-perfil). false mientras es temporal `new_<hex>`. */
  usernameLocked: boolean;
  /** Timestamp de aceptación de T&C + mayoría de edad. */
  tycAceptadosAt: Date | null;
  fechaNac: Date | null;
  ubicacion: string | null;
  rol: "JUGADOR" | "ADMIN";
  /** Lote 11: si false, /comunidad/[username] muestra estado "perfil
   *  privado" — no expone stats ni historial de predicciones. Default
   *  true (los usuarios existentes quedan visibles). */
  perfilPublico: boolean;
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
      usernameLocked: true,
      tycAceptadosAt: true,
      fechaNac: true,
      ubicacion: true,
      rol: true,
      perfilPublico: true,
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
    usernameLocked: usuario.usernameLocked,
    tycAceptadosAt: usuario.tycAceptadosAt,
    fechaNac: usuario.fechaNac,
    ubicacion: usuario.ubicacion,
    rol: usuario.rol,
    perfilPublico: usuario.perfilPublico,
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
  ubicacion?: string;
  image?: string;
  /** Lote 11 — toggle de privacidad del perfil público. */
  perfilPublico?: boolean;
}

export async function actualizarPerfil(
  usuarioId: string,
  patch: ActualizarPerfilInput,
): Promise<PerfilCompleto> {
  // Registro formal (Abr 2026): `username` ya NO es editable post-registro.
  // El @handle se elige una sola vez (en /auth/signup o /auth/completar-perfil)
  // y queda inmutable. El service solo permite nombre, ubicación, imagen
  // y (Lote 11) el toggle `perfilPublico`. Intentar pasar username desde
  // un caller legacy sería un bug.
  if (patch.nombre !== undefined && patch.nombre.trim().length < 2) {
    throw new ValidacionFallida("El nombre debe tener al menos 2 caracteres.", {
      field: "nombre",
    });
  }

  await prisma.usuario.update({
    where: { id: usuarioId },
    data: {
      ...(patch.nombre !== undefined ? { nombre: patch.nombre.trim() } : {}),
      ...(patch.ubicacion !== undefined
        ? { ubicacion: patch.ubicacion.trim() || null }
        : {}),
      ...(patch.image !== undefined ? { image: patch.image } : {}),
      ...(patch.perfilPublico !== undefined
        ? { perfilPublico: patch.perfilPublico }
        : {}),
    },
  });

  return obtenerMiPerfil(usuarioId);
}

// Re-export para consumo desde tests sin drift contra la misma constante.
export { esReservado };

// ---------------------------------------------------------------------------
// Casas conectadas — Lote C v3.1 (placeholder).
//
// El modelo `UsuarioCasa` (relación many-to-many usuario↔afiliado con
// `primerFtd`, `apuestasMes`) lo crean los Lotes D/E si se decide instrumentar
// FTD reportado por usuario. En Lote C devolvemos siempre array vacío — la
// sección `<MisCasasConectadas>` del perfil renderea el empty state con CTA
// "➕ Conecta una nueva casa" hacia /casas. Cuando el modelo exista, este
// service se reescribe sin tocar callers.
// ---------------------------------------------------------------------------

export interface CasaConectada {
  slug: string;
  nombre: string;
  /** URL del logo en R2 (ya disponible en `Afiliado.logoUrl`). */
  logoUrl: string | null;
  primerFtd: Date | null;
  /** Número de apuestas reportadas en el mes calendario en curso. */
  apuestasMes: number;
}

export async function obtenerCasasConectadas(
  _userId: string,
): Promise<CasaConectada[]> {
  return [];
}

// ---------------------------------------------------------------------------
// Eliminar cuenta (soft delete)
// ---------------------------------------------------------------------------

const ELIMINAR_TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h

export async function solicitarEliminarCuenta(
  usuarioId: string,
  baseUrl: string,
): Promise<{ tokenUrl: string; expiraEn: Date }> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { email: true, deletedAt: true },
  });
  if (!usuario || usuario.deletedAt) throw new NoAutenticado();

  const token = crypto.randomBytes(32).toString("hex");
  const expiraEn = new Date(Date.now() + ELIMINAR_TOKEN_TTL_MS);

  await prisma.solicitudEliminacion.create({
    data: { usuarioId, token, expiraEn },
  });

  const tokenUrl = `${baseUrl.replace(/\/$/, "")}/perfil/eliminar/confirmar?token=${token}`;

  void notifySolicitudEliminar({ usuarioId, tokenUrl });

  logger.info({ usuarioId, expiraEn }, "solicitud eliminar cuenta creada");

  return { tokenUrl, expiraEn };
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
    // Registro formal (Abr 2026): `username` es NOT NULL. Para soft-delete
    // asignamos un handle anonimizado único `deleted_<hex10>` que no
    // coincide con la regex de usernames válidos (underscore + lowercase
    // hex, pero el prefijo `deleted_` lo hace no reclamable).
    const anonUsername = `deleted_${solicitud.usuarioId.slice(0, 10)}`;
    await tx.usuario.update({
      where: { id: solicitud.usuarioId },
      data: {
        nombre: "Usuario eliminado",
        email: anonEmail,
        username: anonUsername,
        usernameLocked: true,
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
// Eliminación inmediata in-app (Mini-lote 7.6)
// ---------------------------------------------------------------------------
//
// Reemplaza el flujo email-token por uno directo: el usuario confirma
// in-app tipeando "ELIMINAR", el endpoint llama esto, y la cuenta se
// elimina al instante. La función decide automáticamente entre:
//
//   - HARD delete: si NO hay tickets. Borra el Usuario; el
//     `onDelete: Cascade` se encarga de Account, Session,
//     PreferenciasNotif, SolicitudEliminacion. Esto libera el email
//     original Y la identidad OAuth (Account.providerAccountId) para
//     que el usuario pueda re-registrarse limpio.
//
//   - SOFT delete: si tiene tickets. Anonimiza PII, marca deletedAt y
//     borra explícitamente Account/Session + dependencias cascade en
//     una transacción atómica. Preserva Ticket (integridad de torneos
//     históricos).
//
// En ambos casos, antes de tocar la BD se lee el email original para
// poder mandar el correo de confirmación post-eliminación (fire-and-
// forget — no bloquea la respuesta al cliente).

export interface EliminarInmediatoResult {
  modo: "hard" | "soft";
}

export async function eliminarCuentaInmediato(
  usuarioId: string,
): Promise<EliminarInmediatoResult> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      email: true,
      nombre: true,
      deletedAt: true,
    },
  });
  if (!usuario || usuario.deletedAt) throw new NoAutenticado();

  // Detectar actividad histórica para decidir hard vs soft. Cualquier
  // ticket es razón suficiente para soft — la integridad de torneos
  // pasados pesa más que la limpieza total de la BD.
  const ticketsCount = await prisma.ticket.count({ where: { usuarioId } });
  const tieneActividad = ticketsCount > 0;
  const modo: "hard" | "soft" = tieneActividad ? "soft" : "hard";

  // Capturar email + nombre ANTES de mutar (luego del soft delete el
  // email queda anonimizado y no se podría recuperar para el aviso).
  const emailOriginal = usuario.email;
  const nombreOriginal = usuario.nombre;

  if (modo === "hard") {
    await prisma.$transaction(async (tx) => {
      // VerificationToken no tiene FK al Usuario (NextAuth lo indexa
      // por email/identifier). Lo limpiamos por email para no dejar
      // magic links pendientes en el aire.
      await tx.verificationToken.deleteMany({
        where: { identifier: emailOriginal },
      });
      // El delete del Usuario dispara cascade en: Account, Session,
      // PreferenciasNotif, SolicitudEliminacion. (Ticket no tiene
      // onDelete declarado, pero acá no hay ninguno — por eso es hard.)
      await tx.usuario.delete({ where: { id: usuarioId } });
    });

    logger.info({ usuarioId }, "cuenta eliminada (hard)");
  } else {
    await prisma.$transaction(async (tx) => {
      // Anonimización PII — mismo shape que confirmarEliminarCuenta para
      // que las invariantes (deleted-<id8>-<ts>@deleted.habla.local,
      // username deleted_<id10>) sigan reconocibles por las consultas
      // que filtran por `deletedAt IS NOT NULL`.
      const anonEmail = `deleted-${usuarioId.slice(0, 8)}-${Date.now()}@deleted.habla.local`;
      const anonUsername = `deleted_${usuarioId.slice(0, 10)}`;
      await tx.usuario.update({
        where: { id: usuarioId },
        data: {
          nombre: "Usuario eliminado",
          email: anonEmail,
          username: anonUsername,
          usernameLocked: true,
          ubicacion: null,
          image: null,
          deletedAt: new Date(),
        },
      });

      // Borrar OAuth links (libera providerAccountId para que un futuro
      // sign-in con la misma cuenta de Google cree un usuario nuevo en
      // vez de chocar con el unique compuesto). El soft delete previo
      // (confirmarEliminarCuenta) NO hacía esto y bloqueaba re-registro.
      await tx.account.deleteMany({ where: { userId: usuarioId } });
      await tx.session.deleteMany({ where: { userId: usuarioId } });

      // Limpiar tablas con PII residual. El cascade del Usuario.delete
      // las atendería, pero acá no borramos al Usuario — las tocamos
      // explícitas. `deleteMany` (no `delete`) para que no falle si no
      // hay registro previo (PreferenciasNotif puede no existir hasta
      // que el usuario abra /perfil por primera vez).
      await tx.preferenciasNotif.deleteMany({ where: { usuarioId } });
      await tx.solicitudEliminacion.deleteMany({ where: { usuarioId } });

      // Magic links pendientes al email original.
      await tx.verificationToken.deleteMany({
        where: { identifier: emailOriginal },
      });
    });

    logger.info(
      { usuarioId, ticketsCount },
      "cuenta eliminada (soft inmediato)",
    );
  }

  // Email de confirmación al email original (fire-and-forget — no
  // bloquea la respuesta del endpoint).
  void notifyCuentaEliminada({
    email: emailOriginal,
    nombre: nombreOriginal,
    modo,
  });

  return { modo };
}

// ---------------------------------------------------------------------------
// Exportar datos (job async — MVP lo hace sync y devuelve el JSON grande)
// ---------------------------------------------------------------------------

export interface DatosExportados {
  perfil: Omit<PerfilCompleto, "nivel" | "stats">;
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
    creadoEn: Date;
  }>;
  generadoEn: Date;
}

export async function generarExportDatos(
  usuarioId: string,
): Promise<DatosExportados> {
  const perfil = await obtenerMiPerfil(usuarioId);
  const tickets = await prisma.ticket.findMany({
    where: { usuarioId },
    include: { torneo: { select: { nombre: true } } },
    orderBy: { creadoEn: "desc" },
  });

  const { nivel: _nivel, stats: _stats, ...perfilCore } = perfil;
  return {
    perfil: perfilCore,
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
      creadoEn: t.creadoEn,
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

// ---------------------------------------------------------------------------
// Admin queries y acciones — Lote G
// ---------------------------------------------------------------------------

import { Prisma } from "@habla/db";

export type UsuarioEstado = "activo" | "banned" | "soft_deleted";

export interface UsuarioAdminFila {
  id: string;
  email: string;
  nombre: string;
  username: string;
  rol: "JUGADOR" | "ADMIN";
  estado: UsuarioEstado;
  image: string | null;
  emailVerified: Date | null;
  creadoEn: Date;
  ticketsCount: number;
}

export interface ListarUsuariosInput {
  query?: string;
  rol?: "JUGADOR" | "ADMIN";
  estado?: UsuarioEstado;
  page?: number;
  pageSize?: number;
}

export async function listarUsuariosAdmin(
  input: ListarUsuariosInput = {},
): Promise<{
  rows: UsuarioAdminFila[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    total: number;
    activos: number;
    admins: number;
    softDeleted: number;
  };
}> {
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, input.pageSize ?? 50));

  const where: Prisma.UsuarioWhereInput = {};
  if (input.query && input.query.trim()) {
    const q = input.query.trim();
    where.OR = [
      { email: { contains: q, mode: "insensitive" } },
      { nombre: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }
  if (input.rol) where.rol = input.rol;
  if (input.estado === "activo") where.deletedAt = null;
  if (input.estado === "soft_deleted") where.deletedAt = { not: null };
  // estado === "banned" — convención: nombre arranca con "[BAN]" o user
  // tiene flag custom. v3.1 no tiene un flag explícito de "banned"; usamos
  // soft_deleted como ban definitivo + queda anonimizado. Para "ban" sin
  // anonimización (caso temporal) → usamos `deletedAt` también pero
  // metadatamos en auditoría.

  const [rows, total, statsTotal, statsActivos, statsAdmins, statsSoftDeleted] =
    await Promise.all([
      prisma.usuario.findMany({
        where,
        orderBy: { creadoEn: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          nombre: true,
          username: true,
          rol: true,
          image: true,
          emailVerified: true,
          creadoEn: true,
          deletedAt: true,
          _count: { select: { tickets: true } },
        },
      }),
      prisma.usuario.count({ where }),
      prisma.usuario.count(),
      prisma.usuario.count({ where: { deletedAt: null } }),
      prisma.usuario.count({ where: { rol: "ADMIN", deletedAt: null } }),
      prisma.usuario.count({ where: { deletedAt: { not: null } } }),
    ]);

  return {
    rows: rows.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      username: u.username,
      rol: u.rol,
      estado: (u.deletedAt ? "soft_deleted" : "activo") as UsuarioEstado,
      image: u.image,
      emailVerified: u.emailVerified,
      creadoEn: u.creadoEn,
      ticketsCount: u._count.tickets,
    })),
    total,
    page,
    pageSize,
    stats: {
      total: statsTotal,
      activos: statsActivos,
      admins: statsAdmins,
      softDeleted: statsSoftDeleted,
    },
  };
}

export interface UsuarioDetalleAdmin {
  id: string;
  email: string;
  nombre: string;
  username: string;
  rol: "JUGADOR" | "ADMIN";
  estado: UsuarioEstado;
  image: string | null;
  emailVerified: Date | null;
  creadoEn: Date;
  fechaNac: Date | null;
  ubicacion: string | null;
  perfilPublico: boolean;
  telefono: string | null;
  /** Contadores agregados de actividad. */
  ticketsCount: number;
  conversionesAfiliadosCount: number;
  suscripcionActiva: {
    plan: string;
    estado: string;
    activa: boolean;
    iniciada: Date;
    proximoCobro: Date | null;
  } | null;
}

export async function obtenerDetalleUsuarioAdmin(
  id: string,
): Promise<UsuarioDetalleAdmin | null> {
  const user = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      nombre: true,
      username: true,
      rol: true,
      image: true,
      emailVerified: true,
      creadoEn: true,
      deletedAt: true,
      fechaNac: true,
      ubicacion: true,
      perfilPublico: true,
      telefono: true,
      _count: {
        select: { tickets: true, conversionesAfiliados: true },
      },
      suscripciones: {
        where: { activa: true },
        orderBy: { iniciada: "desc" },
        take: 1,
        select: {
          plan: true,
          estado: true,
          activa: true,
          iniciada: true,
          proximoCobro: true,
        },
      },
    },
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    username: user.username,
    rol: user.rol,
    estado: (user.deletedAt ? "soft_deleted" : "activo") as UsuarioEstado,
    image: user.image,
    emailVerified: user.emailVerified,
    creadoEn: user.creadoEn,
    fechaNac: user.fechaNac,
    ubicacion: user.ubicacion,
    perfilPublico: user.perfilPublico,
    telefono: user.telefono,
    ticketsCount: user._count.tickets,
    conversionesAfiliadosCount: user._count.conversionesAfiliados,
    suscripcionActiva: user.suscripciones[0]
      ? {
          plan: user.suscripciones[0].plan,
          estado: user.suscripciones[0].estado,
          activa: user.suscripciones[0].activa,
          iniciada: user.suscripciones[0].iniciada,
          proximoCobro: user.suscripciones[0].proximoCobro,
        }
      : null,
  };
}

export interface CambiarRolInput {
  usuarioId: string;
  nuevoRol: "JUGADOR" | "ADMIN";
}

/**
 * Cambia el rol de un usuario. El caller (server action / endpoint admin)
 * debe llamar `logAuditoria` con motivo + diff antes/después.
 */
export async function cambiarRolUsuario(
  input: CambiarRolInput,
): Promise<{ rolAnterior: "JUGADOR" | "ADMIN"; rolNuevo: "JUGADOR" | "ADMIN" }> {
  const user = await prisma.usuario.findUnique({
    where: { id: input.usuarioId },
    select: { rol: true, deletedAt: true },
  });
  if (!user) throw new DomainError("USUARIO_NO_ENCONTRADO", "Usuario no existe", 404);
  if (user.deletedAt) {
    throw new DomainError(
      "USUARIO_ELIMINADO",
      "No se puede cambiar el rol de un usuario eliminado",
      409,
    );
  }
  if (user.rol === input.nuevoRol) {
    return { rolAnterior: user.rol, rolNuevo: user.rol };
  }
  await prisma.usuario.update({
    where: { id: input.usuarioId },
    data: { rol: input.nuevoRol },
  });
  return { rolAnterior: user.rol, rolNuevo: input.nuevoRol };
}

/**
 * "Banear" un usuario: equivalente a soft-delete + invalidar sesiones.
 * v3.1 no tiene flag separado de "banned" — el ban es definitivo. Si un
 * día se necesita ban temporal, agregar campo en schema. El motivo va a
 * auditoría (caller responsable).
 *
 * Decisión: aplicar el mismo path que `eliminarCuentaInmediato` modo SOFT
 * (anonimiza PII + libera username) pero sin disparar email al usuario.
 * Soft-delete admin = ban — el resultado funcional es idéntico desde la
 * perspectiva del usuario (no puede iniciar sesión, pierde su perfil).
 */
export async function banearUsuario(usuarioId: string): Promise<void> {
  const user = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, email: true, deletedAt: true, rol: true },
  });
  if (!user) throw new DomainError("USUARIO_NO_ENCONTRADO", "Usuario no existe", 404);
  if (user.deletedAt) {
    throw new DomainError(
      "USUARIO_YA_INACTIVO",
      "Este usuario ya estaba eliminado o baneado",
      409,
    );
  }
  if (user.rol === "ADMIN") {
    throw new DomainError(
      "NO_BANEAR_ADMIN",
      "No se puede banear a otro admin desde la UI. Cambia rol antes.",
      403,
    );
  }

  await prisma.$transaction(async (tx) => {
    const anonEmail = `banned-${user.id.slice(0, 8)}-${Date.now()}@deleted.habla.local`;
    const anonUsername = `banned_${user.id.slice(0, 10)}`;
    await tx.usuario.update({
      where: { id: user.id },
      data: {
        nombre: "Usuario suspendido",
        email: anonEmail,
        username: anonUsername,
        usernameLocked: true,
        ubicacion: null,
        image: null,
        deletedAt: new Date(),
      },
    });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.preferenciasNotif.deleteMany({ where: { usuarioId: user.id } });
    await tx.solicitudEliminacion.deleteMany({ where: { usuarioId: user.id } });
    await tx.verificationToken.deleteMany({
      where: { identifier: user.email },
    });
  });
}

/**
 * Soft-delete admin: análogo a `eliminarCuentaInmediato` pero ejecutado
 * por un admin en nombre del usuario (típicamente por solicitud manual o
 * compliance). NO se puede deshacer.
 */
export async function softDeleteUsuarioAdmin(usuarioId: string): Promise<void> {
  const user = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, email: true, deletedAt: true },
  });
  if (!user) throw new DomainError("USUARIO_NO_ENCONTRADO", "Usuario no existe", 404);
  if (user.deletedAt) {
    throw new DomainError(
      "USUARIO_YA_ELIMINADO",
      "Este usuario ya estaba eliminado",
      409,
    );
  }
  await prisma.$transaction(async (tx) => {
    const anonEmail = `deleted-${user.id.slice(0, 8)}-${Date.now()}@deleted.habla.local`;
    const anonUsername = `deleted_${user.id.slice(0, 10)}`;
    await tx.usuario.update({
      where: { id: user.id },
      data: {
        nombre: "Usuario eliminado",
        email: anonEmail,
        username: anonUsername,
        usernameLocked: true,
        ubicacion: null,
        image: null,
        deletedAt: new Date(),
      },
    });
    await tx.account.deleteMany({ where: { userId: user.id } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.preferenciasNotif.deleteMany({ where: { usuarioId: user.id } });
    await tx.solicitudEliminacion.deleteMany({ where: { usuarioId: user.id } });
    await tx.verificationToken.deleteMany({
      where: { identifier: user.email },
    });
  });
}
