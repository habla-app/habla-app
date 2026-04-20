// Servicio de verificación — Sub-Sprint 7.
//
// Teléfono:
//  - solicitarCodigoTelefono(usuarioId, telefono) → genera código 6 dígitos
//    con TTL 10 min. Si Twilio configurado → SMS real. Si no → modo dev (log
//    + email de fallback).
//  - confirmarCodigoTelefono(usuarioId, codigo) → valida, TTL, máximo 3 intentos.
//    Al éxito marca Usuario.telefono + telefonoVerif=true.
//  - Código se almacena hasheado con SHA-256 (no bcrypt para no agregar dep;
//    suficiente para códigos efímeros de 6 dígitos con TTL 10 min).
//
// DNI:
//  - subirDni(usuarioId, dniNumero, imagenBase64) → guarda imagen en
//    filesystem local (`public/uploads/dni/<cuid>.jpg`) y crea
//    VerificacionDni en estado PENDIENTE. Admin aprueba/rechaza manualmente.
//  - aprobarDni(id) / rechazarDni(id, motivo) para admin.
//  - Al aprobar, Usuario.dniVerif=true.
//
// Storage decision (§15): filesystem local bajo `apps/web/public/uploads/dni/`.
// Alternativas descartadas: S3/R2 (requiere dep + credenciales). Para MVP
// en Railway con 1 réplica es suficiente. Cuando se escale a multi-réplica,
// migrar a storage compartido.

import { prisma } from "@habla/db";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DomainError, NoAutenticado, ValidacionFallida } from "./errors";
import { logger } from "./logger";
import { notifyVerifCodigoEmail } from "./notificaciones.service";

// ---------------------------------------------------------------------------
// Teléfono
// ---------------------------------------------------------------------------

const CODIGO_TTL_MS = 10 * 60 * 1000; // 10 min
const MAX_INTENTOS = 3;
const TELEFONO_REGEX = /^\+?[0-9]{8,15}$/; // Flex: acepta internacional y local

function hashCodigo(codigo: string): string {
  return crypto.createHash("sha256").update(codigo).digest("hex");
}

function generarCodigoAleatorio(): string {
  // 6 dígitos, zero-padded
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function solicitarCodigoTelefono(
  usuarioId: string,
  telefono: string,
): Promise<{ ok: true; expiraEn: Date; devCode?: string }> {
  const tel = telefono.replace(/\s+/g, "");
  if (!TELEFONO_REGEX.test(tel)) {
    throw new ValidacionFallida(
      "Formato de teléfono inválido (8-15 dígitos, opcionalmente con + inicial).",
      { field: "telefono" },
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { id: true, deletedAt: true },
  });
  if (!usuario || usuario.deletedAt) throw new NoAutenticado();

  // En modo dev (NODE_ENV !== production) devolvemos un código fijo `123456`
  // para que el smoke local sea trivial. En prod con Twilio, SMS real.
  const isDev = process.env.NODE_ENV !== "production";
  const twilioConfigurado = Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER,
  );

  const codigo = isDev && !twilioConfigurado ? "123456" : generarCodigoAleatorio();
  const expiraEn = new Date(Date.now() + CODIGO_TTL_MS);

  await prisma.verificacionTelefono.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      telefono: tel,
      codigo: hashCodigo(codigo),
      intentos: 0,
      expiraEn,
      confirmado: false,
    },
    update: {
      telefono: tel,
      codigo: hashCodigo(codigo),
      intentos: 0,
      expiraEn,
      confirmado: false,
    },
  });

  if (twilioConfigurado) {
    // Envío real vía Twilio REST API — sin agregar la dep `twilio@*`.
    await enviarSmsTwilio(tel, `Tu código Habla! es: ${codigo}`);
  } else {
    // Fallback: email con el código + log.
    logger.warn(
      { usuarioId, telefono: tel, codigo },
      "Twilio no configurado — código enviado por email (modo dev)",
    );
    void notifyVerifCodigoEmail({
      usuarioId,
      codigo,
      expiraEnMin: 10,
    });
  }

  return {
    ok: true,
    expiraEn,
    devCode: isDev && !twilioConfigurado ? codigo : undefined,
  };
}

async function enviarSmsTwilio(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    if (!resp.ok) {
      const err = await resp.text().catch(() => "");
      logger.error({ status: resp.status, err, to }, "Twilio respondió error");
    } else {
      logger.info({ to }, "SMS enviado");
    }
  } catch (err) {
    logger.error({ err, to }, "Twilio fetch error");
  }
}

export async function confirmarCodigoTelefono(
  usuarioId: string,
  codigoIngresado: string,
): Promise<{ ok: true; telefono: string }> {
  const verif = await prisma.verificacionTelefono.findUnique({
    where: { usuarioId },
  });
  if (!verif) {
    throw new DomainError(
      "SIN_CODIGO",
      "No hay código activo. Solicita uno nuevo.",
      404,
    );
  }
  if (verif.confirmado) {
    throw new DomainError(
      "YA_VERIFICADO",
      "Este teléfono ya está verificado.",
      409,
    );
  }
  if (verif.expiraEn.getTime() < Date.now()) {
    throw new DomainError(
      "CODIGO_EXPIRADO",
      "El código expiró. Solicita uno nuevo.",
      410,
    );
  }
  if (verif.intentos >= MAX_INTENTOS) {
    throw new DomainError(
      "MAX_INTENTOS",
      "Demasiados intentos. Solicita un código nuevo.",
      429,
    );
  }

  const ingresadoHash = hashCodigo(codigoIngresado.trim());
  if (ingresadoHash !== verif.codigo) {
    await prisma.verificacionTelefono.update({
      where: { usuarioId },
      data: { intentos: { increment: 1 } },
    });
    throw new DomainError(
      "CODIGO_INCORRECTO",
      `Código incorrecto. Te quedan ${MAX_INTENTOS - verif.intentos - 1} intentos.`,
      400,
    );
  }

  // Éxito
  await prisma.$transaction(async (tx) => {
    await tx.verificacionTelefono.update({
      where: { usuarioId },
      data: { confirmado: true },
    });
    await tx.usuario.update({
      where: { id: usuarioId },
      data: { telefono: verif.telefono, telefonoVerif: true },
    });
  });

  logger.info({ usuarioId }, "teléfono verificado");
  return { ok: true, telefono: verif.telefono };
}

// ---------------------------------------------------------------------------
// DNI
// ---------------------------------------------------------------------------

const DNI_REGEX = /^[0-9]{8}$/; // DNI peruano

// MVP: límite de 1.5MB para la imagen codificada en base64.
const MAX_IMAGEN_BYTES = Math.floor(1.5 * 1024 * 1024);

const UPLOAD_DIR_REL = "public/uploads/dni";
const UPLOAD_DIR_URL = "/uploads/dni";

function getUploadDir(): string {
  // Compatible con Next.js custom server: el cwd es `apps/web`.
  return path.join(process.cwd(), UPLOAD_DIR_REL);
}

export interface SubirDniInput {
  dniNumero: string;
  imagenBase64: string; // data: URL o base64 puro
  mimeType?: string; // image/jpeg | image/png
}

export async function subirDni(
  usuarioId: string,
  input: SubirDniInput,
): Promise<{ id: string; imagenUrl: string; estado: "PENDIENTE" }> {
  const dni = input.dniNumero.replace(/\s+/g, "");
  if (!DNI_REGEX.test(dni)) {
    throw new ValidacionFallida(
      "DNI inválido. Debe ser un número de 8 dígitos.",
      { field: "dniNumero" },
    );
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { dniVerif: true, deletedAt: true },
  });
  if (!usuario || usuario.deletedAt) throw new NoAutenticado();
  if (usuario.dniVerif) {
    throw new DomainError(
      "YA_VERIFICADO",
      "Tu DNI ya está verificado.",
      409,
    );
  }

  // Parse base64 (acepta "data:image/jpeg;base64,...")
  const match = input.imagenBase64.match(/^data:(image\/\w+);base64,(.+)$/);
  const mime = match ? match[1]! : input.mimeType ?? "image/jpeg";
  const base64Raw = match ? match[2]! : input.imagenBase64;
  if (!["image/jpeg", "image/jpg", "image/png"].includes(mime)) {
    throw new ValidacionFallida("Formato no soportado. Usa JPG o PNG.", {
      mime,
    });
  }
  const buffer = Buffer.from(base64Raw, "base64");
  if (buffer.length > MAX_IMAGEN_BYTES) {
    throw new ValidacionFallida(
      `Imagen demasiado grande (max ${Math.round(MAX_IMAGEN_BYTES / 1024)}KB).`,
      { size: buffer.length },
    );
  }

  const ext = mime === "image/png" ? "png" : "jpg";
  const filename = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  const dir = getUploadDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  const imagenUrl = `${UPLOAD_DIR_URL}/${filename}`;

  // Upsert (1 verificación activa por usuario)
  const verif = await prisma.verificacionDni.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      dniNumero: dni,
      imagenUrl,
      estado: "PENDIENTE",
    },
    update: {
      dniNumero: dni,
      imagenUrl,
      estado: "PENDIENTE",
      motivoRechazo: null,
      revisadoEn: null,
    },
  });

  logger.info({ usuarioId, dniVerifId: verif.id }, "DNI subido (pendiente revisión)");
  return { id: verif.id, imagenUrl, estado: "PENDIENTE" };
}

export async function aprobarDniAdmin(
  verifId: string,
): Promise<{ ok: true; usuarioId: string }> {
  const verif = await prisma.verificacionDni.findUnique({ where: { id: verifId } });
  if (!verif) {
    throw new DomainError("DNI_NO_ENCONTRADO", "Verificación no encontrada.", 404);
  }

  await prisma.$transaction(async (tx) => {
    await tx.verificacionDni.update({
      where: { id: verifId },
      data: { estado: "APROBADO", revisadoEn: new Date() },
    });
    await tx.usuario.update({
      where: { id: verif.usuarioId },
      data: { dniVerif: true },
    });
  });

  logger.info({ usuarioId: verif.usuarioId }, "DNI aprobado");
  return { ok: true, usuarioId: verif.usuarioId };
}

export async function rechazarDniAdmin(
  verifId: string,
  motivo: string,
): Promise<{ ok: true; usuarioId: string }> {
  const verif = await prisma.verificacionDni.findUnique({ where: { id: verifId } });
  if (!verif) {
    throw new DomainError("DNI_NO_ENCONTRADO", "Verificación no encontrada.", 404);
  }
  await prisma.verificacionDni.update({
    where: { id: verifId },
    data: {
      estado: "RECHAZADO",
      motivoRechazo: motivo,
      revisadoEn: new Date(),
    },
  });
  logger.info({ usuarioId: verif.usuarioId, motivo }, "DNI rechazado");
  return { ok: true, usuarioId: verif.usuarioId };
}

export async function obtenerEstadoDni(
  usuarioId: string,
): Promise<{ estado: "NO_SUBIDO" | "PENDIENTE" | "APROBADO" | "RECHAZADO"; motivo?: string }> {
  const verif = await prisma.verificacionDni.findUnique({ where: { usuarioId } });
  if (!verif) return { estado: "NO_SUBIDO" };
  return {
    estado: verif.estado,
    motivo: verif.motivoRechazo ?? undefined,
  };
}
