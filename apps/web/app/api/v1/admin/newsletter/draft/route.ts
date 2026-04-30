// POST /api/v1/admin/newsletter/draft — Lote 10.
//
// Genera un draft del digest semanal a demanda. Si ya existe el draft de
// la semana, lo devuelve sin regenerar; si no, lo crea desde cero
// (`generarDigestSemanal()` + persistir en `digests_enviados`).
//
// Auth: sesión ADMIN o Bearer CRON_SECRET.
//
// Body: { semana?: string }. Default = semana actual.
//
// PUT /api/v1/admin/newsletter/draft — actualiza el JSONB del draft (admin
// puede editar a mano antes de aprobar).

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma, Prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import {
  crearDraftSemanal,
  getSemanaIsoKey,
  obtenerDraftPorSemana,
} from "@/lib/services/newsletter.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PostSchema = z
  .object({
    semana: z
      .string()
      .regex(/^\d{4}-W\d{2}$/)
      .optional(),
  })
  .strict();

const PutSchema = z
  .object({
    semana: z.string().regex(/^\d{4}-W\d{2}$/),
    contenido: z.unknown(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = PostSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const semana = parsed.data.semana ?? getSemanaIsoKey();
    // Si pasaron `semana` futura/pasada, generamos para esa fecha.
    const result = await crearDraftSemanal(referenceDeSemana(semana));
    const draft = await obtenerDraftPorSemana(result.semana);

    logger.info(
      { semana: result.semana, created: result.created },
      "POST /api/v1/admin/newsletter/draft",
    );
    return Response.json({ data: { ...result, draft } });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-newsletter-draft" },
      "POST /api/v1/admin/newsletter/draft falló",
    );
    return toErrorResponse(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin(req);
    const raw = await req.json().catch(() => ({}));
    const parsed = PutSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const fila = await prisma.digestEnviado.findUnique({
      where: { semana: parsed.data.semana },
    });
    if (!fila) {
      throw new ValidacionFallida(
        `No existe draft para semana ${parsed.data.semana}.`,
      );
    }
    if (fila.enviadoEn) {
      throw new ValidacionFallida(
        `El digest de ${parsed.data.semana} ya fue enviado — no se puede editar.`,
      );
    }
    await prisma.digestEnviado.update({
      where: { id: fila.id },
      data: {
        contenido: parsed.data.contenido as Prisma.InputJsonValue,
      },
    });
    const draft = await obtenerDraftPorSemana(parsed.data.semana);
    return Response.json({ data: { draft } });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-newsletter-draft" },
      "PUT /api/v1/admin/newsletter/draft falló",
    );
    return toErrorResponse(err);
  }
}

async function requireAdmin(req: NextRequest): Promise<void> {
  const session = await auth();
  const isAdmin = session?.user?.id && session.user.rol === "ADMIN";
  if (isAdmin) return;
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    if (!session?.user?.id) throw new NoAutenticado();
    throw new NoAutorizado("Solo administradores o Bearer CRON_SECRET.");
  }
}

/**
 * Devuelve un Date que cae dentro de la semana ISO dada — útil para
 * generar el digest pasando esa fecha a `generarDigestSemanal(date)`.
 * Mantiene la lógica simple: el lunes ~12:00 UTC es estable bajo cualquier
 * offset.
 */
function referenceDeSemana(semana: string): Date {
  const m = /^(\d{4})-W(\d{2})$/.exec(semana);
  if (!m) return new Date();
  const year = Number(m[1]);
  const week = Number(m[2]);
  // ISO 8601: la semana 1 contiene el primer jueves del año.
  const jan4 = new Date(Date.UTC(year, 0, 4, 12));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86_400_000);
}
