// /premium/mi-suscripcion — gestión de suscripción Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.
//
// Server component PROTEGIDO. Si:
// - no hay session → redirect a /auth/signin
// - no tiene suscripción (ni siquiera pasada) → redirect a /premium
// - tiene suscripción → render con estado, accesos, plan, historial,
//   cancelar/reactivar.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/services/logger";
import { PLANES, planKeyDesdeEnum } from "@/lib/premium-planes";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";
import { SuscripcionEstadoCard } from "@/components/premium/SuscripcionEstadoCard";
import { AccesosRapidosPremium } from "@/components/premium/AccesosRapidosPremium";
import { CambiarPlanSection } from "@/components/premium/CambiarPlanSection";
import { HistorialPagos } from "@/components/premium/HistorialPagos";
import { CancelarSuscripcionSection } from "@/components/premium/CancelarSuscripcionSection";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Habla! Premium · Mi suscripción",
  description: "Gestiona tu Premium: estado, plan, pagos y cancelación.",
  robots: { index: false, follow: false },
};

type Estado = "activa" | "cancelando" | "vencida";

function mapEstado(suscripcion: {
  activa: boolean;
  cancelada: boolean;
}): Estado {
  if (suscripcion.activa && suscripcion.cancelada) return "cancelando";
  if (suscripcion.activa) return "activa";
  return "vencida";
}

export default async function MiSuscripcionPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/premium/mi-suscripcion");
  }

  const userId = session.user.id;

  const suscripcion = await prisma.suscripcion
    .findFirst({
      where: { usuarioId: userId },
      orderBy: { iniciada: "desc" },
      include: {
        pagos: {
          orderBy: { fecha: "desc" },
          take: 12,
        },
      },
    })
    .catch((err) => {
      logger.error(
        { err, userId, source: "premium-mi-suscripcion" },
        "mi-suscripcion: query falló",
      );
      return null;
    });

  if (!suscripcion) {
    redirect("/premium");
  }

  const planKey = planKeyDesdeEnum(suscripcion.plan);
  const plan = PLANES[planKey];
  const estado = mapEstado(suscripcion);

  const channelInviteLink =
    process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? null;
  const botPhoneNumber = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER ?? null;

  return (
    <div className="bg-page pb-24">
      <TrackOnMount
        event="premium_mi_suscripcion_visto"
        props={{
          plan: planKey,
          estado,
          suscripcionId: suscripcion.id,
        }}
      />

      <div className="bg-card px-4 py-5">
        <h1 className="font-display text-display-md font-extrabold uppercase tracking-tight text-dark">
          Mi suscripción
        </h1>
        <p className="mt-0.5 text-body-xs text-muted-d">
          Gestiona tu plan, pagos y acceso al Channel
        </p>
      </div>

      <SuscripcionEstadoCard
        plan={plan}
        estado={estado}
        proximoCobro={suscripcion.proximoCobro}
        vencimiento={suscripcion.vencimiento}
      />

      <AccesosRapidosPremium
        channelInviteLink={
          // Si la suscripción NO está activa, no exponemos el link al
          // Channel (no tiene acceso real ahora mismo).
          estado === "vencida" ? null : channelInviteLink
        }
        botPhoneNumber={botPhoneNumber}
      />

      {estado === "activa" ? (
        <CambiarPlanSection planActual={planKey} />
      ) : null}

      <HistorialPagos
        pagos={suscripcion.pagos.map((p) => ({
          id: p.id,
          fecha: p.fecha,
          plan: planKey,
          monto: p.monto,
          estado: p.estado,
          ultimosCuatro: p.ultimosCuatro,
          marcaTarjeta: p.marcaTarjeta,
        }))}
      />

      {estado !== "vencida" ? (
        <CancelarSuscripcionSection
          modo={estado}
          vencimiento={suscripcion.vencimiento}
        />
      ) : null}

      {estado === "vencida" ? (
        <div className="px-4 py-5 text-center">
          <p className="mb-3 text-body-sm text-body">
            Tu suscripción venció. Puedes renovar desde la landing Premium.
          </p>
          <a
            href="/premium"
            className="touch-target inline-flex items-center justify-center rounded-md bg-brand-gold px-5 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
          >
            Renovar Premium
          </a>
        </div>
      ) : null}
    </div>
  );
}
