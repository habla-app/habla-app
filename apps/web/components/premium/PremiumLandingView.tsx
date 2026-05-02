"use client";

// PremiumLandingView — vista cliente de /premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Componente que orquesta la landing: hereda data del server component
// padre y maneja el estado del plan seleccionado para que el sticky CTA se
// actualice cuando user clica en una card de plan.
//
// El componente es client porque el `<PlanesPremium>` es interactivo y
// necesita compartir state con `<StickyPremiumCTA>`. El resto de las
// secciones (Hero, mockup, social proof, inclusiones, garantía, testimonios,
// FAQ) son puro markup.

import { useEffect, useState } from "react";
import { track } from "@/lib/analytics";
import { PLANES, type PlanKey } from "@/lib/premium-planes";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";
import {
  PlanesPremium,
  WhatsAppChannelMockup,
} from "@/components/ui/premium";
import { PremiumHero } from "./PremiumHero";
import { SocialProofPremium } from "./SocialProofPremium";
import { InclusionesPremium } from "./InclusionesPremium";
import { GarantiaCard } from "./GarantiaCard";
import { TestimoniosPremium } from "./TestimoniosPremium";
import { FAQPremium } from "./FAQPremium";
import { StickyPremiumCTA } from "./StickyPremiumCTA";

interface Props {
  estadoUsuario: EstadoUsuario;
  nombre: string | null;
  suscriptoresCount: number;
  /** Plan default sugerido (anual). */
  planInicial?: PlanKey;
  /** Si OpenPay env vars no están seteadas, sticky CTA muestra fallback
   *  "Próximamente" linkeando al newsletter. Server lo pasa para evitar
   *  exponer las env vars al cliente. */
  pagosDisponibles: boolean;
}

export function PremiumLandingView({
  estadoUsuario,
  nombre,
  suscriptoresCount,
  planInicial = "anual",
  pagosDisponibles,
}: Props) {
  const [planSeleccionado, setPlanSeleccionado] =
    useState<PlanKey>(planInicial);

  // Track landing visto — 1 vez por mount.
  useEffect(() => {
    track("premium_landing_visto", {
      estadoUsuario,
      planInicial,
      suscriptoresCount,
      pagosDisponibles,
    });
  }, [estadoUsuario, planInicial, suscriptoresCount, pagosDisponibles]);

  const planActual = PLANES[planSeleccionado];

  const ctaHref = pagosDisponibles
    ? estadoUsuario === "anonimo"
      ? `/auth/signup?callbackUrl=${encodeURIComponent(
          `/premium/checkout?plan=${planSeleccionado}`,
        )}`
      : `/premium/checkout?plan=${planSeleccionado}`
    : "/suscribir?fuente=premium-waitlist";

  const ctaLabel = pagosDisponibles
    ? `⚡ Suscribirme · S/ ${planActual.precioSoles}`
    : "⚡ Próximamente · Avísame";

  return (
    <div className="bg-page pb-24">
      <PremiumHero estadoUsuario={estadoUsuario} nombre={nombre} />

      <WhatsAppChannelMockup suscriptoresCount={suscriptoresCount} />

      <SocialProofPremium suscriptoresCount={suscriptoresCount} />

      <InclusionesPremium />

      <PlanesPremium
        initialPlan={planInicial}
        onSelect={setPlanSeleccionado}
      />

      <GarantiaCard />

      <TestimoniosPremium />

      <FAQPremium />

      <div className="bg-card px-4 py-6 text-center">
        <p className="text-body-xs text-muted-d">
          ¿No estás listo? Te avisamos cuando lo estés.
        </p>
        <a
          href="/suscribir?fuente=premium-footer"
          className="mt-2 inline-block text-body-sm font-bold text-brand-blue-main hover:underline"
        >
          Suscribirme al newsletter →
        </a>
      </div>

      <StickyPremiumCTA
        href={ctaHref}
        label={ctaLabel}
        plan={planSeleccionado}
        pagosDisponibles={pagosDisponibles}
      />
    </div>
  );
}
