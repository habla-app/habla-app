// EmptyState — placeholder cuando el usuario no tiene predicciones del
// filtro activo (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/mis-predicciones.spec.md.

import Link from "next/link";
import type { MisPrediccionesTab } from "./FiltrosTabs";

interface EmptyStateProps {
  tab: MisPrediccionesTab;
  nombreMes: string;
  /** href al partido próximo top — fallback a /cuotas si no se conoce. */
  proximoHref?: string;
}

export function EmptyState({ tab, nombreMes, proximoHref }: EmptyStateProps) {
  const copy = COPY[tab];

  return (
    <div className="rounded-md border border-light bg-card px-5 py-10 text-center shadow-sm">
      <div aria-hidden className="mb-3 text-[40px] leading-none">
        {copy.icon}
      </div>
      <p className="font-display text-display-xs font-bold text-dark">
        {typeof copy.title === "function" ? copy.title(nombreMes) : copy.title}
      </p>
      <p className="mt-1 text-body-sm text-muted-d">{copy.body}</p>
      <Link
        href={proximoHref ?? "/cuotas"}
        className="mt-4 inline-flex touch-target items-center justify-center rounded-sm bg-brand-gold px-5 py-2.5 text-label-md font-bold text-brand-blue-dark shadow-gold-btn transition-all hover:bg-brand-gold-light"
      >
        Hacer mi primera predicción →
      </Link>
    </div>
  );
}

const COPY: Record<
  MisPrediccionesTab,
  { icon: string; title: string | ((mes: string) => string); body: string }
> = {
  todas: {
    icon: "🎯",
    title: "Aún no tienes predicciones",
    body: "Tu historial vive acá: cada predicción que envíes queda registrada con sus puntos.",
  },
  "mes-actual": {
    icon: "📅",
    title: (mes) => `Aún sin predicciones en ${mes}`,
    body: "Apenas se cierre el primer torneo del mes con tus predicciones, lo verás acá.",
  },
  ganadas: {
    icon: "🏆",
    title: "Ningún acierto todavía",
    body: "Las predicciones acertadas (Top 10 del torneo final) aparecen acá.",
  },
  pendientes: {
    icon: "⏳",
    title: "Sin predicciones pendientes",
    body: "Predicciones de torneos que aún no finalizaron quedan acá.",
  },
  falladas: {
    icon: "📜",
    title: "Sin predicciones falladas",
    body: "Las que quedaron fuera del Top 10 al cierre del torneo aparecen acá.",
  },
};
