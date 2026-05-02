// LigaHablaCardHome — card grande dorada que aparece a mitad de home.
// Lote B (nuevo). Spec:
// docs/ux-spec/02-pista-usuario-publica/home.spec.md §"Estructura completa".
//
// CTA Liga Habla! prominente con datos en vivo:
// - count de tipsters compitiendo este mes
// - premio total S/ 1,250
// - fecha de próximo cierre
// - posición del usuario si está autenticado y tiene predicciones
//
// Mobile-first: card grande con CTA de altura ≥44px, texto legible a 375px.

import Link from "next/link";
import { Card } from "@/components/ui";
import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

interface Props {
  estado: EstadoUsuario;
  totalTipsters: number;
  /** Posición del usuario en el ranking del mes en curso, 1-based. */
  miPosicion?: number | null;
  /** Mes en curso para el copy ("noviembre 2026"). */
  nombreMes: string;
}

export function LigaHablaCardHome({
  estado,
  totalTipsters,
  miPosicion,
  nombreMes,
}: Props) {
  const ctaCopy =
    estado === "anonimo"
      ? "Empezar gratis"
      : miPosicion
        ? `Tu posición #${miPosicion} →`
        : "Hacer mi predicción";
  const ctaHref =
    estado === "anonimo" ? "/auth/signup?callbackUrl=/liga" : "/liga";

  return (
    <Card
      variant="default"
      padding="none"
      className="mb-12 overflow-hidden border-[1.5px] border-brand-gold bg-gradient-to-br from-brand-gold/[0.08] to-card"
    >
      <div className="flex flex-col gap-5 px-5 py-6 md:flex-row md:items-center md:justify-between md:px-7 md:py-8">
        <div className="flex-1">
          <p className="mb-2 font-display text-label-md text-brand-gold-dark">
            🏆 Liga Habla!
          </p>
          <h2 className="mb-2 font-display text-display-lg uppercase leading-tight text-dark md:text-[32px]">
            Predicí gratis. Ganá premios reales.
          </h2>
          <p className="text-body-md leading-[1.55] text-body">
            <strong className="text-dark">
              {totalTipsters.toLocaleString("es-PE")} tipsters
            </strong>{" "}
            compitiendo este {nombreMes}.{" "}
            <strong className="text-dark">S/ 1,250</strong> en premios para el
            Top 10.
          </p>
        </div>

        <div className="flex flex-col gap-2 md:min-w-[200px]">
          <Link
            href={ctaHref}
            className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold"
          >
            {ctaCopy}
          </Link>
          {estado === "anonimo" ? (
            <Link
              href="/comunidad"
              className="text-center text-body-xs font-bold text-brand-blue-main hover:underline"
            >
              Ver leaderboard del mes →
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
