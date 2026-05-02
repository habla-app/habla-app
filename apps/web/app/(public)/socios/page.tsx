// /premium — landing crítica de conversión Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Server component público (accesible sin auth). Personalización por
// estado del usuario (anónimo / free / ftd / premium):
// - premium → redirect a /premium/mi-suscripcion (no debería ver landing).
// - resto   → render la landing con copy adaptativo.
//
// Lee:
//   - session (auth) para personalización
//   - count de suscriptores activos (decide social proof y mockup count)
//   - detección si OpenPay está configurado (decide si CTA va a checkout
//     o a waitlist)
//
// Si Lote E aún no creó los modelos, los counts caen a 0 (los componentes
// hacen fallback graceful).

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@habla/db";
import { auth } from "@/lib/auth";
import { detectarEstadoUsuario } from "@/lib/services/estado-usuario.service";
import { logger } from "@/lib/services/logger";
import { PremiumLandingView } from "@/components/premium/PremiumLandingView";

interface SearchParams {
  utm_source?: string;
  plan?: string;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Habla! Premium · Picks de valor en tu WhatsApp",
  description:
    "Recibe 2-4 picks/día con razonamiento estadístico directo en tu canal privado de WhatsApp. Garantía 7 días. Desde S/ 33.2/mes.",
  alternates: { canonical: "/socios" },
  openGraph: {
    type: "website",
    title: "Habla! Premium · Picks por WhatsApp",
    description:
      "Picks con razonamiento estadístico vía WhatsApp Channel privado. 65% acierto último mes.",
  },
};

const PLANES_VALIDOS = ["mensual", "trimestral", "anual"] as const;

export default async function PremiumLandingPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await auth();
  const userId = session?.user?.id ?? undefined;
  const estadoUsuario = await detectarEstadoUsuario(userId);

  // Lote K v3.2: Socio activo → redirect a /socios-hub (área miembro).
  // Esta misma decisión también vive en middleware.ts (auto-redirect
  // server-side antes de pintar la landing) — esto es belt + suspenders.
  if (estadoUsuario === "premium") {
    redirect("/socios-hub");
  }

  // Count de suscriptores activos (real). Fallback 0 si Lote E no está.
  const suscriptoresCount = await prisma.suscripcion
    .count({ where: { activa: true } })
    .catch((err) => {
      logger.warn(
        { err, source: "premium-landing" },
        "premium: count suscripciones falló — fallback 0",
      );
      return 0;
    });

  // ¿OpenPay está configurado? Si no, sticky CTA va a waitlist.
  const pagosDisponibles = !!(
    process.env.OPENPAY_MERCHANT_ID && process.env.OPENPAY_PRIVATE_KEY
  );

  // Plan inicial desde query string si válido, sino "anual".
  const planInicial =
    searchParams?.plan &&
    PLANES_VALIDOS.includes(searchParams.plan as (typeof PLANES_VALIDOS)[number])
      ? (searchParams.plan as (typeof PLANES_VALIDOS)[number])
      : "anual";

  return (
    <PremiumLandingView
      estadoUsuario={estadoUsuario}
      nombre={session?.user?.username ?? null}
      suscriptoresCount={suscriptoresCount}
      planInicial={planInicial}
      pagosDisponibles={pagosDisponibles}
    />
  );
}
