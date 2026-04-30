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
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 md:px-6 md:py-20">
      <div className="w-full max-w-xl rounded-md border border-light bg-card p-6 shadow-sm md:p-10">
        <header className="mb-6 text-center">
          <span className="mb-2 inline-block font-display text-[12px] font-bold uppercase tracking-[0.08em] text-brand-gold">
            Newsletter Habla!
          </span>
          <h1 className="mb-3 font-display text-[34px] font-black leading-tight text-dark md:text-[40px]">
            Tu resumen semanal de Habla!
          </h1>
          <p className="text-[15px] leading-[1.65] text-body">
            Cada sábado, recibís: top 3 tipsters del mes, los 5 partidos más
            jugados con mejores cuotas, los últimos artículos del blog y un
            destacado de la semana. Gratis, sin spam, podés darte de baja en
            un click.
          </p>
        </header>

        <SuscribirForm />

        <div className="mt-6 border-t border-light pt-5 text-center text-[12px] text-muted-d">
          <p>
            Al suscribirte aceptás nuestros{" "}
            <a
              href="/legal/terminos"
              className="font-bold text-brand-blue-main hover:underline"
            >
              Términos y Condiciones
            </a>{" "}
            y la{" "}
            <a
              href="/legal/privacidad"
              className="font-bold text-brand-blue-main hover:underline"
            >
              Política de Privacidad
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
