// POST /api/v1/lukas/comprar — Lote 8.
//
// Inicia un cargo en la pasarela. Si `pagosHabilitados()` es false, devuelve
// 503 (modo PREVIEW: la UI muestra tooltip "Próximamente").

import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { getPack, type PackLukasId } from "@/lib/constants/packs-lukas";
import { pagosHabilitados } from "@/lib/feature-flags";
import { getPasarelaPagos } from "@/lib/services/pasarela-pagos";
import { verificarLimiteCompra } from "@/lib/services/limites.service";
import {
  DomainError,
  NoAutenticado,
  ValidacionFallida,
  toErrorResponse,
} from "@/lib/services/errors";
import { logger } from "@/lib/services/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  packId: z.enum(["basic", "medium", "large", "vip"]),
});

export async function POST(req: NextRequest) {
  try {
    if (!pagosHabilitados()) {
      return Response.json(
        {
          error: {
            code: "PAGOS_DESHABILITADOS",
            message: "Pagos próximamente disponibles. Estamos cerrando Culqi.",
          },
        },
        { status: 503 },
      );
    }

    const session = await auth();
    if (!session?.user?.id) throw new NoAutenticado();

    const body = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(body);
    if (!parsed.success) {
      throw new ValidacionFallida("Pack inválido.", {
        issues: parsed.error.flatten(),
      });
    }
    const packId = parsed.data.packId as PackLukasId;
    const pack = getPack(packId);
    if (!pack) throw new ValidacionFallida(`Pack ${packId} no existe.`);

    const usuario = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, emailVerified: true, deletedAt: true },
    });
    if (!usuario || usuario.deletedAt) throw new NoAutenticado();
    if (!usuario.emailVerified) {
      throw new DomainError(
        "EMAIL_NO_VERIFICADO",
        "Verificá tu email antes de comprar Lukas.",
        403,
      );
    }

    // Bloquea por límite mensual + auto-exclusión. (1 Luka = S/1 — montoLukas = soles).
    await verificarLimiteCompra({
      usuarioId: usuario.id,
      montoLukas: pack.soles,
    });

    const pasarela = getPasarelaPagos();
    const cargo = await pasarela.crearCargo({
      monto: pack.soles,
      descripcion: `Habla! · Pack ${pack.id} (${pack.lukas + pack.bonus} Lukas)`,
      metadata: { usuarioId: usuario.id, packId: pack.id },
    });

    logger.info(
      { usuarioId: usuario.id, packId: pack.id, cargoId: cargo.cargoId },
      "POST /lukas/comprar: cargo iniciado",
    );

    return Response.json({
      ok: true,
      data: {
        cargoId: cargo.cargoId,
        estado: cargo.estado,
        monto: pack.soles,
        packId: pack.id,
      },
    });
  } catch (err) {
    if (!(err instanceof DomainError)) {
      logger.error({ err }, "POST /lukas/comprar falló");
    }
    return toErrorResponse(err);
  }
}
