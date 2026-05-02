// /premium/checkout — vista de checkout Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/checkout.spec.md.
//
// Server component PROTEGIDO:
// - Si no hay session → redirect a /auth/signup con callback al checkout.
// - Si ya tiene suscripción activa → redirect a /premium/mi-suscripcion.
// - Si plan inválido → redirect a /premium.
//
// Pasa al cliente: plan resuelto, datos del usuario para prefill, las
// public keys de OpenPay (públicas, designadas para exponerse). NUNCA la
// private key.

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/services/logger";
import { PLANES, type PlanKey } from "@/lib/premium-planes";
import { CheckoutHero } from "@/components/premium/CheckoutHero";
import { PlanResumen } from "@/components/premium/PlanResumen";
import { OpenPayForm } from "@/components/premium/OpenPayForm";
import { SeguridadCheckout } from "@/components/premium/SeguridadCheckout";
import { TrackOnMount } from "@/components/analytics/TrackOnMount";

interface SearchParams {
  plan?: string;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Habla! Premium · Checkout",
  description:
    "Activa tu Premium con OpenPay BBVA. Pago seguro, 100% encriptado. Garantía 7 días.",
  robots: { index: false, follow: false },
};

const PLANES_VALIDOS: ReadonlyArray<PlanKey> = ["mensual", "trimestral", "anual"];

export default async function PremiumCheckoutPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  const planKeyRaw = searchParams?.plan ?? "anual";
  const planKey = PLANES_VALIDOS.includes(planKeyRaw as PlanKey)
    ? (planKeyRaw as PlanKey)
    : null;

  if (!planKey) {
    redirect("/socios");
  }

  if (!session?.user?.id) {
    redirect(
      `/auth/signup?callbackUrl=${encodeURIComponent(
        `/socios/checkout?plan=${planKey}`,
      )}`,
    );
  }

  // ¿Ya tiene suscripción activa?
  const suscripcionActiva = await prisma.suscripcion
    .findFirst({ where: { usuarioId: session.user.id, activa: true } })
    .catch((err) => {
      logger.warn(
        { err, source: "socios-checkout" },
        "checkout: query suscripción activa falló (continuando)",
      );
      return null;
    });
  if (suscripcionActiva) {
    redirect("/socios-hub");
  }

  const plan = PLANES[planKey];

  // Datos del usuario para prefill
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { nombre: true, email: true, telefono: true },
  });
  if (!usuario) {
    redirect("/auth/signin?callbackUrl=/socios/checkout");
  }

  const openpayMerchantId = process.env.OPENPAY_MERCHANT_ID ?? null;
  const openpayPublicKey = process.env.OPENPAY_PUBLIC_KEY ?? null;
  const openpayProduction = process.env.OPENPAY_PRODUCTION === "true";

  return (
    <div className="bg-page pb-4">
      <TrackOnMount
        event="premium_checkout_iniciado"
        props={{ plan: planKey, source: "checkout-page" }}
      />
      <CheckoutHero />
      <PlanResumen plan={plan} />
      <OpenPayForm
        plan={{
          key: plan.key,
          label: plan.label,
          precioSoles: plan.precioSoles,
        }}
        usuario={{ nombre: usuario.nombre, email: usuario.email }}
        openpayMerchantId={openpayMerchantId}
        openpayPublicKey={openpayPublicKey}
        openpayProduction={openpayProduction}
      />
      <SeguridadCheckout />
    </div>
  );
}
