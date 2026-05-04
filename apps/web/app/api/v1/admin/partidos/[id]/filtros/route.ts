// PATCH /api/v1/admin/partidos/[id]/filtros — Lote L v3.2 (May 2026).
// Spec: docs/plan-trabajo-claude-code-v3.2.md § Lote L #3 + decisiones §4.1
// y §4.2 del análisis-repo-vs-mockup-v3.2.md.
//
// Mutación admin de los flags `mostrarAlPublico` (Filtro 1), `elegibleLiga`
// (Filtro 2) y `visibilidadOverride` (override regla 7d) sobre un Partido.
//
// Disparadores derivados:
//   - mostrarAlPublico false → true: dispara generación inmediata del
//     AnalisisPartido vía worker fire-and-forget. Si ya existía análisis
//     ARCHIVADO, lo restaura a PENDIENTE en lugar de regenerar.
//   - mostrarAlPublico true → false: si había análisis APROBADO, pasa a
//     ARCHIVADO con timestamp `archivadoEn`. La URL pública responde 410 Gone
//     desde Lote M (la vista /las-fijas/[slug] respeta este estado).
//
// Auditoría 100% en cualquier cambio de flag (regla 21 del CLAUDE.md).
//
// Auth: sesión ADMIN. No aceptamos CRON_SECRET acá — la mutación de filtros
// es decisión humana siempre.

import { NextRequest } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import {
  NoAutenticado,
  NoAutorizado,
  PartidoNoEncontrado,
  toErrorResponse,
  ValidacionFallida,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";
import { logAuditoria } from "@/lib/services/auditoria.service";
import { generarAnalisisParaPartido } from "@/lib/services/analisis-partido-generador.service";
import { iniciarCaptura } from "@/lib/services/captura-cuotas.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z
  .object({
    mostrarAlPublico: z.boolean().optional(),
    elegibleLiga: z.boolean().optional(),
    visibilidadOverride: z
      .enum(["forzar_visible", "forzar_oculto"])
      .nullable()
      .optional(),
  })
  .strict();

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();
    if (session.user.rol !== "ADMIN") {
      throw new NoAutorizado("Solo administradores pueden mutar filtros de partido.");
    }

    const raw = await req.json().catch(() => ({}));
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      throw new ValidacionFallida("Body inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const body = parsed.data;
    if (
      body.mostrarAlPublico === undefined &&
      body.elegibleLiga === undefined &&
      body.visibilidadOverride === undefined
    ) {
      throw new ValidacionFallida(
        "Al menos un flag debe enviarse (mostrarAlPublico, elegibleLiga o visibilidadOverride).",
      );
    }

    const partido = await prisma.partido.findUnique({
      where: { id: params.id },
      include: { analisisPartido: true },
    });
    if (!partido) throw new PartidoNoEncontrado(params.id);

    // Detectar transición de Filtro 1.
    const filtro1Antes = partido.mostrarAlPublico;
    const filtro1Nuevo =
      body.mostrarAlPublico !== undefined ? body.mostrarAlPublico : filtro1Antes;
    const transicionActivacion = !filtro1Antes && filtro1Nuevo;
    const transicionDesactivacion = filtro1Antes && !filtro1Nuevo;

    // Update transaccional:
    //   1. Mutar flags.
    //   2. Si desactivamos Filtro 1 sobre análisis APROBADO → archivar.
    const updates: {
      mostrarAlPublico?: boolean;
      elegibleLiga?: boolean;
      visibilidadOverride?: "forzar_visible" | "forzar_oculto" | null;
    } = {};
    if (body.mostrarAlPublico !== undefined)
      updates.mostrarAlPublico = body.mostrarAlPublico;
    if (body.elegibleLiga !== undefined)
      updates.elegibleLiga = body.elegibleLiga;
    if (body.visibilidadOverride !== undefined)
      updates.visibilidadOverride = body.visibilidadOverride;

    await prisma.$transaction(async (tx) => {
      await tx.partido.update({
        where: { id: partido.id },
        data: updates,
      });

      if (
        transicionDesactivacion &&
        partido.analisisPartido &&
        partido.analisisPartido.estado === "APROBADO"
      ) {
        await tx.analisisPartido.update({
          where: { id: partido.analisisPartido.id },
          data: {
            estado: "ARCHIVADO",
            archivadoEn: new Date(),
          },
        });
      }
    });

    // Auditoría 100% — regla 21
    await logAuditoria({
      actorId: session.user.id,
      actorEmail: session.user.email ?? null,
      accion: "partido.filtros_actualizar",
      entidad: "Partido",
      entidadId: partido.id,
      resumen: `Filtros actualizados sobre partido ${partido.equipoLocal} vs ${partido.equipoVisita}`,
      metadata: {
        antes: {
          mostrarAlPublico: partido.mostrarAlPublico,
          elegibleLiga: partido.elegibleLiga,
          visibilidadOverride: partido.visibilidadOverride,
        },
        despues: {
          mostrarAlPublico: updates.mostrarAlPublico ?? partido.mostrarAlPublico,
          elegibleLiga: updates.elegibleLiga ?? partido.elegibleLiga,
          visibilidadOverride:
            updates.visibilidadOverride !== undefined
              ? updates.visibilidadOverride
              : partido.visibilidadOverride,
        },
        transicionActivacion,
        transicionDesactivacion,
      },
    });

    // Worker fire-and-forget: dispara generación si activamos Filtro 1.
    let generacionDisparada = false;
    let cuotasDisparadas = false;
    if (transicionActivacion) {
      generacionDisparada = true;
      void generarAnalisisParaPartido(partido.id)
        .then((r) => {
          logger.info(
            {
              partidoId: partido.id,
              motivo: r.motivo,
              analisisId: r.analisisId,
              source: "admin:partidos:filtros",
            },
            "filtros: generación disparada por activación de Filtro 1",
          );
        })
        .catch((err) => {
          logger.error(
            { err, partidoId: partido.id, source: "admin:partidos:filtros" },
            "filtros: generación falló post-activación",
          );
        });

      // Lote V.9.1: con Playwright universal, ya NO hace falta el discovery
      // HTTP previo (los endpoints están todos rotos/bloqueados). El worker
      // BullMQ con Playwright resuelve discovery + captura en una sola
      // pasada por casa. Solo encolamos los 7 jobs y dejamos que el worker
      // se encargue.
      cuotasDisparadas = true;
      void (async () => {
        try {
          const r = await iniciarCaptura(partido.id);
          logger.info(
            {
              partidoId: partido.id,
              casasEncoladas: r.casasEncoladas.length,
              casasSinCola: r.casasSinEventId.length,
              source: "admin:partidos:filtros:captura",
            },
            `filtros: iniciarCaptura completado · ${r.casasEncoladas.length}/7 jobs en cola`,
          );
        } catch (err) {
          logger.error(
            { err, partidoId: partido.id, source: "admin:partidos:filtros:captura" },
            "filtros: iniciarCaptura falló",
          );
        }
      })();
    }

    return Response.json({
      ok: true,
      partidoId: partido.id,
      transicionActivacion,
      transicionDesactivacion,
      generacionDisparada,
      cuotasDisparadas,
    });
  } catch (err) {
    logger.error(
      { err, partidoId: params.id, source: "api:admin-partidos-filtros" },
      "PATCH /api/v1/admin/partidos/[id]/filtros falló",
    );
    return toErrorResponse(err);
  }
}
