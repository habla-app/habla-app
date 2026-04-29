// POST /api/v1/admin/afiliados — crear afiliado (Lote 7).
// GET  /api/v1/admin/afiliados — listar todos (incluye inactivos).
//
// Auth: sesión ADMIN (el layout admin ya valida pero defensa en
// profundidad acá). El middleware existente bloquea a no-admins, pero
// volvemos a chequear porque este endpoint también puede llamarse fuera
// del contexto del layout admin (curl, scripts).

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  crearAfiliado,
  listarTodos,
  MODELOS_COMISION,
  obtenerStatsResumenTodos,
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

// El slug debe ser kebab-case ASCII: minúsculas, números y guiones. No
// permite guiones al inicio/fin ni dobles. Esto sirve para:
//   - construir paths /go/[slug] sin escape;
//   - matchear los `<CasaCTA slug="..." />` en MDX sin sorpresas.
const SlugRe = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const StringArraySchema = z
  .array(z.string().trim().min(1).max(200))
  .max(20);

const CrearSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(SlugRe, "El slug debe ser kebab-case (minúsculas, números, guiones)."),
  nombre: z.string().min(1).max(100),
  logoUrl: z.string().url().max(500).nullable().optional(),
  autorizadoMincetur: z.boolean().optional(),
  urlBase: z.string().url().max(2000),
  modeloComision: z.enum(MODELOS_COMISION),
  montoCpa: z.number().int().nonnegative().nullable().optional(),
  porcentajeRevshare: z.number().min(0).max(100).nullable().optional(),
  bonoActual: z.string().max(200).nullable().optional(),
  metodosPago: StringArraySchema.optional(),
  pros: StringArraySchema.optional(),
  contras: StringArraySchema.optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  activo: z.boolean().optional(),
  ordenDestacado: z.number().int().min(0).max(9999).optional(),
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

    const a = await crearAfiliado(parsed.data);
    logger.info(
      { afiliadoId: a.id, slug: a.slug },
      "POST /api/v1/admin/afiliados — afiliado creado",
    );
    return Response.json({ data: { afiliado: a } }, { status: 201 });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002") {
      logger.error(
        { err, source: "api:admin-afiliados" },
        "POST /admin/afiliados: slug duplicado",
      );
      return toErrorResponse(
        new ValidacionFallida(
          "Ya existe un afiliado con ese slug. Elegí otro.",
          { field: "slug" },
        ),
      );
    }
    logger.error(
      { err, source: "api:admin-afiliados" },
      "POST /api/v1/admin/afiliados falló",
    );
    return toErrorResponse(err);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores.");
    }

    const [afiliados, statsResumen] = await Promise.all([
      listarTodos(),
      obtenerStatsResumenTodos(),
    ]);

    const conStats = afiliados.map((a) => ({
      ...a,
      stats: statsResumen.get(a.id) ?? {
        clicks7d: 0,
        clicks30d: 0,
        conversionesMes: 0,
      },
    }));

    return Response.json({ data: { afiliados: conStats } });
  } catch (err) {
    logger.error(
      { err, source: "api:admin-afiliados" },
      "GET /api/v1/admin/afiliados falló",
    );
    return toErrorResponse(err);
  }
}
