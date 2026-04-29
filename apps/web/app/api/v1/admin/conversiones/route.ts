// POST /api/v1/admin/conversiones — registrar conversión manual (Lote 7).
// GET  /api/v1/admin/conversiones — listar con filtros (?afiliadoId=, ?desde=, ?hasta=).
//
// Las conversiones (REGISTRO/FTD) las reportan las casas en su panel
// afiliado. Acá las cargamos manualmente para tener el record on-platform
// y poder reconciliar con lo que paga la casa al final del mes.

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  listarConversiones,
  registrarConversionManual,
  TIPOS_CONVERSION,
} from "@/lib/services/afiliacion.service";
import {
  NoAutenticado,
  NoAutorizado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CrearSchema = z.object({
  afiliadoId: z.string().min(1),
  tipo: z.enum(TIPOS_CONVERSION),
  montoComision: z.number().min(0).max(1_000_000).nullable().optional(),
  reportadoEn: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"))
    .transform((v) => new Date(v)),
  notas: z.string().max(2000).nullable().optional(),
  userId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = CrearSchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }

    const conv = await registrarConversionManual(parsed.data);
    logger.info(
      {
        conversionId: conv.id,
        afiliadoId: conv.afiliadoId,
        tipo: conv.tipo,
      },
      "POST /api/v1/admin/conversiones — conversión registrada",
    );
    return Response.json(
      { data: { conversion: conv } },
      { status: 201 },
    );
  } catch (err) {
    if ((err as { code?: string })?.code === "P2003") {
      // FK fallida: afiliadoId no existe.
      return toErrorResponse(
        new ValidacionFallida(
          "El afiliado seleccionado no existe.",
          { field: "afiliadoId" },
        ),
      );
    }
    logger.error(
      { err, source: "api:admin-conversiones" },
      "POST /api/v1/admin/conversiones falló",
    );
    return toErrorResponse(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const sp = req.nextUrl.searchParams;
    const afiliadoId = sp.get("afiliadoId") ?? undefined;
    const desdeStr = sp.get("desde");
    const hastaStr = sp.get("hasta");

    const conversiones = await listarConversiones({
      afiliadoId,
      desde: desdeStr ? new Date(desdeStr) : undefined,
      hasta: hastaStr ? new Date(hastaStr) : undefined,
    });

    return Response.json({ data: { conversiones } });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-conversiones" },
      "GET /api/v1/admin/conversiones falló",
    );
    return toErrorResponse(err);
  }
}
