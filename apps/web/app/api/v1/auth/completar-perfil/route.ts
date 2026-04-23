// POST /api/v1/auth/completar-perfil
//
// Registro formal (Abr 2026). Llamado por usuarios que entraron vía OAuth
// Google y tienen `usernameLocked=false` (handle temporal `new_<hex>`).
// Actualiza el username al definitivo, acepta T&C, y marca locked=true.
// Idempotente inverso: si el usuario ya está locked, devuelve YA_COMPLETADO.
//
// Body: { username, aceptaTyc }
// Respuesta OK: { ok: true, data: { username } }

import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import {
  DomainError,
  NoAutenticado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { esReservado } from "@/lib/config/usernames-reservados";
import { esUsernameOfensivo } from "@/lib/utils/username-filter";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

// Abr 2026: case-sensitive display + unicidad case-insensitive.
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

const CompletarSchema = z.object({
  // Preservamos el case original; la comparación de unicidad se hace con
  // mode: 'insensitive' en la query.
  username: z.string().transform((s) => s.trim()),
  aceptaTyc: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = CompletarSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Datos inválidos.", {
        issues: parsed.error.flatten(),
      });
    }

    const { username, aceptaTyc } = parsed.data;

    if (!aceptaTyc) {
      throw new ValidacionFallida(
        "Debes aceptar los Términos y confirmar que sos mayor de 18 años.",
        { field: "aceptaTyc" },
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      throw new ValidacionFallida(
        "El usuario debe tener 3-20 caracteres (letras, números o guión bajo).",
        { field: "username" },
      );
    }

    if (esReservado(username.toLowerCase())) {
      throw new DomainError(
        "USERNAME_RESERVADO",
        "Ese nombre de usuario no está disponible.",
        409,
        { field: "username" },
      );
    }

    if (esUsernameOfensivo(username)) {
      throw new DomainError(
        "USERNAME_OFENSIVO",
        "Ese nombre de usuario no está permitido.",
        409,
        { field: "username" },
      );
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { usernameLocked: true, username: true, nombre: true },
    });
    if (!usuario) throw new NoAutenticado();

    if (usuario.usernameLocked) {
      throw new DomainError(
        "YA_COMPLETADO",
        "Tu @handle ya fue establecido. No se puede cambiar.",
        409,
      );
    }

    // Verificar unicidad case-insensitive (excluyendo al propio usuario
    // por si alguien reintenta con su mismo username temporal).
    const existente = await prisma.usuario.findFirst({
      where: {
        username: { equals: username, mode: "insensitive" },
        id: { not: session.user.id },
      },
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

    const actualizado = await prisma.usuario.update({
      where: { id: session.user.id },
      data: {
        username,
        usernameLocked: true,
        tycAceptadosAt: new Date(),
        // Si el nombre era el username temporal (new_xxx) lo blanqueamos
        // — el usuario lo completará desde /perfil. Si Google ya dio un
        // nombre natural, lo respetamos.
        ...(usuario.username.startsWith("new_") ? { nombre: "" } : {}),
      },
      select: { username: true, usernameLocked: true },
    });

    logger.info(
      { usuarioId: session.user.id, username },
      "completar-perfil completado",
    );

    return Response.json({ ok: true, data: actualizado });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error({ err }, "POST /auth/completar-perfil falló");
    }
    return toErrorResponse(err);
  }
}
