// POST /api/v1/admin/newsletter/test — Lote F.
//
// Envía un email de prueba al admin con el draft de la semana indicada.
// Imprescindible antes del envío masivo: la spec del Lote F (regla del
// flow newsletter) exige test obligatorio antes de "Aprobar y enviar".
//
// Auth: ADMIN obligatorio. Sin Bearer CRON_SECRET (es flujo manual).

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { firmarTokenNewsletter } from "@/lib/services/newsletter.service";
import { digestSemanalTemplate } from "@/lib/emails/templates";
import { enviarEmail } from "@/lib/services/email.service";
import {
  NoAutenticado,
  NoAutorizado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  semana: z.string().regex(/^\d{4}-W\d{2}$/),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") throw new NoAutorizado("Solo ADMIN");

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido", {
        issues: parsed.error.flatten(),
      });
    }

    const fila = await prisma.digestEnviado.findUnique({
      where: { semana: parsed.data.semana },
    });
    if (!fila) {
      throw new ValidacionFallida("No existe draft para esa semana");
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://hablaplay.com";
    const unsubToken = await firmarTokenNewsletter(session.user.email, "unsub");
    const unsubscribeUrl = `${baseUrl}/api/v1/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}`;
    const tpl = digestSemanalTemplate({
      digest: fila.contenido as unknown as Parameters<typeof digestSemanalTemplate>[0]["digest"],
      baseUrl,
      unsubscribeUrl,
    });

    const r = await enviarEmail({
      to: session.user.email,
      ...tpl,
      subject: `[TEST] ${tpl.subject}`,
    });

    if (!r.ok) {
      throw new Error("Falló el envío de email de prueba");
    }

    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email,
      accion: "newsletter.test_a_mi_email",
      entidad: "DigestEnviado",
      entidadId: parsed.data.semana,
      resumen: `Test de digest semana ${parsed.data.semana} enviado a ${session.user.email}`,
    });

    return Response.json({ ok: true, to: session.user.email });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-newsletter-test" },
      "POST /api/v1/admin/newsletter/test falló",
    );
    return toErrorResponse(err);
  }
}
