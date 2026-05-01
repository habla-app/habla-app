// /premium/exito — vista post-pago crítica (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.
//
// Server component PROTEGIDO. Si:
// - no hay session → redirect a /auth/signin
// - hay session pero NO suscripción activa NI reciente → redirect a /premium
// - hay suscripción reciente pero aún no `activa=true` → render
//   `<PostPagoVerificando>` (polling 3s, timeout 60s)
// - hay suscripción activa → render normal con CTA gigante al Channel
//
// BottomNav está suprimido en /premium/exito (ver `components/layout/BottomNav.tsx`).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/services/logger";
import { PLANES, planKeyDesdeEnum } from "@/lib/premium-planes";
import { PostPagoHero } from "@/components/premium/PostPagoHero";
import { UnirseChannelBigCTA } from "@/components/premium/UnirseChannelBigCTA";
import { InstruccionesPostPago } from "@/components/premium/InstruccionesPostPago";
import { EmailConfirmacionInfo } from "@/components/premium/EmailConfirmacionInfo";
import { SiguientesPasosPremium } from "@/components/premium/SiguientesPasosPremium";
import { PostPagoVerificando } from "@/components/premium/PostPagoVerificando";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";

interface SearchParams {
  suscripcionId?: string;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Habla! Premium · ¡Bienvenido!",
  description: "Tu suscripción Premium está activa. Únete al WhatsApp Channel.",
  robots: { index: false, follow: false },
};

const VENTANA_RECIENTE_MS = 30 * 60 * 1000; // 30 min

export default async function PremiumExitoPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/signin?callbackUrl=/premium");
  }

  const userId = session.user.id;

  // Suscripción más reciente del usuario.
  const suscripcion = await prisma.suscripcion
    .findFirst({
      where: { usuarioId: userId },
      orderBy: { iniciada: "desc" },
      include: {
        usuario: { select: { email: true, nombre: true } },
      },
    })
    .catch((err) => {
      logger.error(
        { err, userId, source: "premium-exito" },
        "post-pago: query suscripción falló",
      );
      return null;
    });

  // Sin suscripción reciente → al landing /premium.
  if (!suscripcion) {
    redirect("/premium");
  }

  const ahora = Date.now();
  const haceCuanto = ahora - suscripcion.iniciada.getTime();

  // Si NO está activa pero la suscripción es reciente → modo verificando.
  if (!suscripcion.activa) {
    if (haceCuanto > VENTANA_RECIENTE_MS) {
      // Caso edge: usuario llega aquí días después con suscripción
      // PENDIENTE/FALLIDA — mejor mandar al landing.
      redirect("/premium");
    }
    return <PostPagoVerificando />;
  }

  const planKey = planKeyDesdeEnum(suscripcion.plan);
  const planLabel = PLANES[planKey].label;

  const channelInviteLink =
    process.env.WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK ?? null;
  const botPhoneNumber = process.env.WHATSAPP_BUSINESS_PHONE_NUMBER ?? null;

  const email = suscripcion.usuario?.email ?? session.user.email ?? "";

  return (
    <div className="bg-page pb-8">
      <TrackOnMount
        event="premium_post_pago_visto"
        props={{
          plan: planKey,
          suscripcionId: suscripcion.id,
          channelLinkOk: !!channelInviteLink,
        }}
      />
      <PostPagoHero
        planLabel={planLabel}
        vencimiento={suscripcion.vencimiento}
      />
      <UnirseChannelBigCTA channelInviteLink={channelInviteLink} />
      <InstruccionesPostPago />
      {email ? <EmailConfirmacionInfo email={email} /> : null}
      <SiguientesPasosPremium botPhoneNumber={botPhoneNumber} />
    </div>
  );
}
