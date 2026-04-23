// GET /api/v1/auth/username-disponible?u=<handle>
//
// Registro formal (Abr 2026). Endpoint público — no requiere sesión. Lo
// consumen los formularios de /auth/signup y /auth/completar-perfil con
// debounce 300ms para feedback visual ✓/✗.
//
// Respuesta:
//   { disponible: true }
//   { disponible: false, razon: "FORMATO_INVALIDO" | "RESERVADO" | "TOMADO" }

import type { NextRequest } from "next/server";
import { prisma } from "@habla/db";
import { esReservado } from "@/lib/config/usernames-reservados";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

type Razon = "FORMATO_INVALIDO" | "RESERVADO" | "TOMADO";

export async function GET(req: NextRequest) {
  try {
    const raw = req.nextUrl.searchParams.get("u") ?? "";
    const normalizado = raw.trim().toLowerCase();

    if (!USERNAME_REGEX.test(normalizado)) {
      return Response.json({
        disponible: false,
        razon: "FORMATO_INVALIDO" satisfies Razon,
      });
    }

    if (esReservado(normalizado)) {
      return Response.json({
        disponible: false,
        razon: "RESERVADO" satisfies Razon,
      });
    }

    const existente = await prisma.usuario.findUnique({
      where: { username: normalizado },
      select: { id: true },
    });

    if (existente) {
      return Response.json({
        disponible: false,
        razon: "TOMADO" satisfies Razon,
      });
    }

    return Response.json({ disponible: true });
  } catch (err) {
    logger.error({ err }, "GET /auth/username-disponible falló");
    return Response.json(
      {
        error: {
          code: "INTERNAL",
          message: "No se pudo verificar la disponibilidad.",
        },
      },
      { status: 500 },
    );
  }
}
