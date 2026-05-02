// UltimasPredicciones — lista de las últimas N predicciones finalizadas
// del tipster en su perfil público (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-username.spec.md.
//
// Cada item es card compacta con partido + fecha + chip ✓/✗ + puntos.
// No linkea — la información detallada queda en /comunidad/torneo/[id]
// del propio tipster (privacidad: no exponemos picks ajenos abiertos).

import type { PerfilPublicoTicket } from "@/lib/services/perfil-publico.service";
import { cn } from "@/lib/utils/cn";

const FMT_FECHA = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "America/Lima",
});

interface UltimasPrediccionesProps {
  tickets: PerfilPublicoTicket[];
}

export function UltimasPredicciones({ tickets }: UltimasPrediccionesProps) {
  if (tickets.length === 0) {
    return (
      <section className="bg-card px-4 py-5">
        <h2 className="mb-2 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
          <span aria-hidden>📊</span>
          Últimas predicciones
        </h2>
        <div className="rounded-md bg-subtle px-4 py-6 text-center">
          <p className="font-display text-display-xs font-bold text-dark">
            Aún sin predicciones finalizadas
          </p>
          <p className="mt-1 text-body-xs text-muted-d">
            Apenas finalice un torneo, las predicciones se reflejan aquí.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-card px-4 py-5">
      <h2 className="mb-3 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        <span aria-hidden>📊</span>
        Últimas predicciones
      </h2>

      <ul className="space-y-2">
        {tickets.map((t) => {
          const acerto =
            t.resultadoReal !== null && t.predResultado === t.resultadoReal;
          return (
            <li
              key={t.id}
              className="rounded-md border border-light bg-card p-3 shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-label-sm uppercase tracking-[0.06em] text-muted-d">
                <span className="truncate font-bold">
                  {t.partidoLiga} · {FMT_FECHA.format(t.partidoFechaInicio)}
                </span>
                <ResultChip acerto={acerto} pendiente={t.resultadoReal === null} />
              </div>
              <div className="flex items-center gap-2">
                <span className="truncate font-display text-body-md font-bold text-dark">
                  {t.partidoEquipoLocal}
                </span>
                <span className="text-label-sm text-muted-d">vs</span>
                <span className="truncate font-display text-body-md font-bold text-dark">
                  {t.partidoEquipoVisita}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-label-md">
                <span className="text-muted-d">
                  Predicción: {prediccionLabel(t.predResultado)}
                </span>
                <span
                  className={cn(
                    "font-display font-extrabold",
                    acerto
                      ? "text-alert-success-text"
                      : t.resultadoReal === null
                        ? "text-alert-warning-text"
                        : "text-muted-d",
                  )}
                >
                  {t.puntosFinales} pts
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ResultChip({
  acerto,
  pendiente,
}: {
  acerto: boolean;
  pendiente: boolean;
}) {
  if (pendiente) {
    return (
      <span className="rounded-full bg-alert-warning-bg px-2 py-0.5 text-label-sm font-bold text-alert-warning-text">
        Pendiente
      </span>
    );
  }
  if (acerto) {
    return (
      <span className="rounded-full bg-alert-success-bg px-2 py-0.5 text-label-sm font-bold text-alert-success-text">
        ✓ Acertó
      </span>
    );
  }
  return (
    <span className="rounded-full bg-alert-danger-bg px-2 py-0.5 text-label-sm font-bold text-alert-danger-text">
      ✗ Falló
    </span>
  );
}

function prediccionLabel(pred: string): string {
  if (pred === "LOCAL") return "Local";
  if (pred === "EMPATE") return "Empate";
  if (pred === "VISITA") return "Visita";
  return pred;
}
