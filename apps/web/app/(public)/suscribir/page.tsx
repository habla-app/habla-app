// /suscribir — Lote 10. Page pública de suscripción al newsletter.
//
// Form simple email + checkbox T&C. POST a /api/v1/newsletter/suscribir
// con `fuente: "page-suscribir"`. Toast de éxito: "Revisa tu email para
// confirmar la suscripción".
//
// Estilo según mockup: card centrada con CTA dorado.

import type { Metadata } from "next";
import { SuscribirForm } from "@/components/marketing/SuscribirForm";

export const metadata: Metadata = {
  title: "Suscribite al newsletter de Habla! · resumen semanal",
  description:
    "Recibí cada sábado el resumen Habla! de la semana: top tipsters, partidos top con mejores cuotas, artículos nuevos y más. Sin spam, podés cancelar en cualquier momento.",
  alternates: { canonical: "/suscribir" },
  openGraph: {
    type: "website",
    title: "Suscribite al newsletter de Habla!",
    description:
      "Resumen semanal con top tipsters, partidos top con mejores cuotas y artículos nuevos.",
  },
};

export default function SuscribirPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-8 md:px-6 md:py-14">
      <div className="w-full max-w-xl rounded-md border border-light bg-card p-5 shadow-sm md:p-8">
        <header className="mb-6 text-center">
          <div aria-hidden className="mb-3 text-[44px] leading-none">
            📧
          </div>
          <p className="mb-2 inline-block font-display text-label-md text-brand-gold-dark">
            Newsletter Habla!
          </p>
          <h1 className="mb-3 font-display text-display-lg leading-tight text-dark md:text-[36px]">
            Recibe lo mejor de Habla! cada lunes
          </h1>
          <p className="text-body-md leading-[1.55] text-body">
            Top 3 tipsters · Mejores cuotas de la semana · 2 análisis
            destacados. Sin spam, prometido.
          </p>
        </header>

        <SuscribirForm />

        <div className="mt-6 border-t border-light pt-5 text-center text-body-xs text-muted-d">
          <p>
            Al suscribirte aceptas nuestros{" "}
            <a
              href="/legal/terminos"
              className="font-bold text-brand-blue-main hover:underline"
            >
              Términos
            </a>{" "}
            y la{" "}
            <a
              href="/legal/privacidad"
              className="font-bold text-brand-blue-main hover:underline"
            >
              Privacidad
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
