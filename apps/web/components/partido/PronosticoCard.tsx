// PronosticoCard — card destacada con el pronóstico editorial del partido.
// Lote B v3.1. Spec:
// docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Reemplaza visualmente al `<PronosticoBox>` (Lote 8) en la nueva vista
// /partidos/[slug] aunque el Box sigue usado vía MDX provider para
// artículos del blog. Aquí mostramos el pronóstico con un layout más
// "fijo" (cuota + casa + nivel de confianza visible).

import { Badge } from "@/components/ui";

interface Props {
  prediccion: string;
  cuotaSugerida?: number;
  casaRecomendada?: { slug: string; nombre: string };
  /** 1-5 — nivel de confianza del editor. */
  confianza: number;
  /** Texto de razonamiento corto que va debajo. */
  razonamiento?: string;
}

export function PronosticoCard({
  prediccion,
  cuotaSugerida,
  casaRecomendada,
  confianza,
  razonamiento,
}: Props) {
  const c = Math.max(1, Math.min(5, Math.round(confianza)));

  return (
    <aside
      role="note"
      aria-label="Pronóstico Habla!"
      className="my-6 overflow-hidden rounded-md border border-brand-gold/40 bg-hero-blue text-white shadow-md"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 md:px-5">
        <span className="font-display text-label-md text-brand-gold">
          🎯 Pronóstico Habla!
        </span>
        <Badge variant="info" size="sm">
          Editor
        </Badge>
      </header>

      <div className="px-4 py-5 md:px-5">
        <p className="m-0 font-display text-display-md text-white">
          {prediccion}
        </p>

        {cuotaSugerida && casaRecomendada ? (
          <p className="mt-3 text-body-md text-white/85">
            Cuota sugerida{" "}
            <strong className="text-num-md text-brand-gold">
              {cuotaSugerida.toFixed(2)}
            </strong>{" "}
            en <strong>{casaRecomendada.nombre}</strong>
          </p>
        ) : null}

        {razonamiento ? (
          <p className="mt-3 text-body-sm leading-[1.55] text-white/75">
            {razonamiento}
          </p>
        ) : null}

        <div className="mt-4 flex items-center gap-3">
          <span className="text-label-sm text-white/60">Confianza</span>
          <div
            className="flex items-center gap-1"
            aria-label={`Confianza ${c} de 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                aria-hidden
                className={`h-2 w-6 rounded-sm ${
                  n <= c ? "bg-brand-gold" : "bg-white/15"
                }`}
              />
            ))}
          </div>
          <span className="text-num-sm tabular-nums text-white/85">
            {c}/5
          </span>
        </div>
      </div>
    </aside>
  );
}
