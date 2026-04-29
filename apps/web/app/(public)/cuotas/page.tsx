// /cuotas — Lote 8. Placeholder hasta Lote 9.

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Comparador de cuotas · Habla!",
  description:
    "Comparador de cuotas en vivo entre las casas de apuestas autorizadas por MINCETUR — próximamente.",
  alternates: { canonical: "/cuotas" },
  openGraph: {
    title: "Comparador de cuotas | Habla!",
    description:
      "Compará las mejores cuotas entre casas autorizadas MINCETUR.",
  },
};

export default function CuotasPage() {
  return (
    <div className="mx-auto max-w-[800px] px-4 py-20 text-center md:px-6 md:py-28">
      <span aria-hidden className="mb-4 block text-[56px] leading-none">
        📊
      </span>
      <h1 className="mb-3 font-display text-[40px] font-black leading-tight text-dark md:text-[48px]">
        Comparador de cuotas
      </h1>
      <p className="mx-auto max-w-[560px] text-[16px] leading-[1.7] text-body">
        Estamos cableando la integración con las casas autorizadas por
        MINCETUR para mostrarte las mejores cuotas de cada partido en
        tiempo real. Volvé pronto — falta poco.
      </p>
    </div>
  );
}
