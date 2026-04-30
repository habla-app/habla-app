// /ayuda/faq — Centro de Ayuda público (Lote 3).
//
// Renderiza el FAQ con buscador y acordeón. El contenido vive en
// `apps/web/content/legal/faq.md` y se parsea en build-time a una
// estructura tipada (categorías + preguntas).

import type { Metadata } from "next";
import { loadFaq } from "@/lib/faq-content";
import { FaqClient } from "@/components/faq/FaqClient";

export const metadata: Metadata = {
  title: "Centro de Ayuda — Preguntas Frecuentes",
  description:
    "Respuestas a las preguntas más comunes sobre Habla!: cómo funciona la Liga Habla!, Premium, casas autorizadas MINCETUR y soporte.",
  robots: { index: true, follow: true },
  openGraph: {
    title: "Centro de Ayuda | Habla!",
    description:
      "Respuestas a las preguntas más comunes sobre Habla!: Liga, Premium, casas autorizadas MINCETUR y soporte.",
  },
};

export default function FaqPage() {
  const faq = loadFaq();

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-6 md:px-6 md:py-10">
      <header className="mb-6">
        <p className="mb-2 inline-block rounded-sm bg-brand-blue-main/10 px-2.5 py-1 text-label-sm text-brand-blue-main">
          ❓ Centro de ayuda
        </p>
        <h1 className="font-display text-display-lg leading-tight text-dark md:text-[40px]">
          Preguntas frecuentes
        </h1>
        <p className="mt-2 text-body-md leading-[1.55] text-body">
          ¿Una duda sobre Habla!? Acá están las respuestas. Si no la
          encuentras, escríbenos a{" "}
          <a
            href="mailto:soporte@hablaplay.com"
            className="font-bold text-brand-blue-main hover:underline"
          >
            soporte@hablaplay.com
          </a>
          .
        </p>
      </header>

      <FaqClient categories={faq.categories} />

      <section className="mt-12 rounded-md border border-light bg-hero-blue p-5 text-white md:p-7">
        <h2 className="mb-2 font-display text-display-md text-white">
          ¿No encontraste tu respuesta?
        </h2>
        <p className="mb-5 text-body-md leading-[1.55] text-white/85">
          Escríbenos por correo. Respondemos sin vueltas.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:soporte@hablaplay.com"
            className="touch-target inline-flex items-center gap-2 rounded-sm bg-brand-gold px-5 py-2.5 text-body-sm font-bold text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            soporte@hablaplay.com
          </a>
          <span className="touch-target inline-flex items-center gap-2 rounded-sm border border-white/30 px-5 py-2.5 text-body-sm font-bold text-white/70">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.52 3.48A11.86 11.86 0 0 0 12 0a11.86 11.86 0 0 0-10.18 17.95L0 24l6.27-1.65A11.86 11.86 0 0 0 12 24a11.86 11.86 0 0 0 8.52-20.52zM12 21.82a9.78 9.78 0 0 1-4.99-1.36l-.36-.21-3.72.97 1-3.62-.23-.37a9.79 9.79 0 1 1 8.3 4.6z" />
            </svg>
            WhatsApp — Próximamente
          </span>
        </div>
      </section>
    </div>
  );
}
