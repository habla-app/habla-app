// AffiliateInline — CTA de afiliado embebido en /comunidad/torneo/[slug]
// (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// Sincroniza con la predicción del usuario: si predijo "Alianza gana",
// muestra la cuota local de la mejor casa para ese mercado. Si predijo
// "Empate", la cuota X. El link de salida pasa por /go/[casa] (Lote 7)
// con UTM para tracking de conversión.
//
// Si NO hay cuotas disponibles (api-football no responde), el caller no
// renderiza este banner — devuelve null en /comunidad/torneo/[slug]/page.tsx.

import Link from "next/link";

interface AffiliateInlineProps {
  /** Slug de la mejor casa para esa cuota (ej. "betano"). */
  casaSlug: string;
  /** Display name de la casa. */
  casaNombre: string;
  /** Valor decimal de la cuota (ej. 2.05). */
  cuotaValor: number;
  /** Texto descriptivo del outcome predicho ("Alianza gana", "Empate"). */
  outcomeLabel: string;
  /** Opcional: contexto adicional para UTM. */
  partidoId?: string;
  outcome?: "1" | "X" | "2";
}

export function AffiliateInline({
  casaSlug,
  casaNombre,
  cuotaValor,
  outcomeLabel,
  partidoId,
  outcome,
}: AffiliateInlineProps) {
  const params = new URLSearchParams({
    utm_source: "torneo",
  });
  if (partidoId) params.set("partidoId", partidoId);
  if (outcome) params.set("outcome", outcome);
  const href = `/go/${casaSlug}?${params.toString()}`;

  return (
    <div className="relative mx-4 mt-2 rounded-md border-2 border-brand-gold bg-card p-3 shadow-sm">
      <span className="absolute -top-2 left-3 rounded-sm bg-brand-gold px-2 py-0.5 font-display text-label-sm font-extrabold uppercase tracking-[0.05em] text-brand-blue-dark">
        ★ Mejor cuota
      </span>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-display-xs font-bold text-dark">
            ¿Apostarías por tu predicción?
          </p>
          <p className="text-body-xs text-muted-d">
            {casaNombre} paga{" "}
            <strong className="font-display text-body-md text-dark">
              {cuotaValor.toFixed(2)}
            </strong>{" "}
            por {outcomeLabel}
          </p>
        </div>
        <Link
          href={href}
          aria-label={`Apostar en ${casaNombre}`}
          className="touch-target inline-flex h-10 items-center rounded-sm bg-brand-blue-dark px-3.5 text-label-md font-bold text-brand-gold transition-all hover:bg-brand-blue-pale active:scale-[0.97]"
        >
          Apostar →
        </Link>
      </div>
    </div>
  );
}
