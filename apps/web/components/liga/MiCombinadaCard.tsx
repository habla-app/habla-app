"use client";
// MiCombinadaCard — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-liga-detail .mi-combinada-card.
//
// Card que muestra la combinada del usuario sobre el partido. Tiene 3
// estados:
//   1) Sin combinada + antes del kickoff → CTA "Hacer mi combinada"
//   2) Con combinada + antes del kickoff → resumen + CTA "Editar mi combinada"
//   3) Con combinada + después del kickoff → resumen inmutable + badge "Cerrada al kickoff"
//
// El CTA dispara onAbrirModal (callback al wrapper que monta el modal).

import { Badge } from "@/components/ui";
import { PUNTOS } from "@habla/shared";

export interface MiCombinadaState {
  predResultado: "LOCAL" | "EMPATE" | "VISITA";
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
  puntosTotal: number;
  puntosResultado: number;
  puntosBtts: number;
  puntosMas25: number;
  puntosTarjeta: number;
  puntosMarcador: number;
  numEdiciones: number;
  esPlaceholder: boolean;
}

interface Props {
  combinada: MiCombinadaState | null;
  equipoLocal: string;
  equipoVisita: string;
  /** True si el partido todavía no empezó. */
  editable: boolean;
  /** True si el partido ya finalizó (resultado real disponible). */
  finalizado: boolean;
  /** True para usuarios no autenticados. Muestra CTA registro. */
  requiereLogin: boolean;
  /** Callback para abrir el modal de combinada (crear/editar). */
  onAbrirModal?: () => void;
  /** Callback para eliminar la combinada (solo antes del kickoff). */
  onEliminar?: () => void;
}

export function MiCombinadaCard({
  combinada,
  equipoLocal,
  equipoVisita,
  editable,
  finalizado,
  requiereLogin,
  onAbrirModal,
  onEliminar,
}: Props) {
  if (requiereLogin) {
    return <RequiereLogin />;
  }

  const tieneCombinada = combinada !== null && !combinada.esPlaceholder;

  return (
    <section
      aria-label="Mi combinada"
      className="bg-card px-4 py-5 md:rounded-md md:border md:border-light md:px-6 md:py-6 md:shadow-sm"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark md:text-display-sm">
          <span aria-hidden>🎯</span>
          Mi combinada
        </h2>
        {tieneCombinada && !editable ? (
          <Badge variant="neutral" size="sm">
            Cerrada al kickoff
          </Badge>
        ) : null}
      </header>

      {tieneCombinada && combinada ? (
        <>
          <ul className="grid gap-2 md:grid-cols-2">
            <Mercado
              label="1 · Resultado"
              puntos={PUNTOS.RESULTADO}
              valor={
                combinada.predResultado === "LOCAL"
                  ? equipoLocal
                  : combinada.predResultado === "VISITA"
                    ? equipoVisita
                    : "Empate"
              }
              acertado={finalizado ? combinada.puntosResultado > 0 : null}
            />
            <Mercado
              label="2 · Ambos anotan"
              puntos={PUNTOS.BTTS}
              valor={combinada.predBtts ? "Sí" : "No"}
              acertado={finalizado ? combinada.puntosBtts > 0 : null}
            />
            <Mercado
              label="3 · Más de 2.5 goles"
              puntos={PUNTOS.MAS_25_GOLES}
              valor={combinada.predMas25 ? "Más" : "Menos"}
              acertado={finalizado ? combinada.puntosMas25 > 0 : null}
            />
            <Mercado
              label="4 · Tarjeta roja"
              puntos={PUNTOS.TARJETA_ROJA}
              valor={combinada.predTarjetaRoja ? "Sí" : "No"}
              acertado={finalizado ? combinada.puntosTarjeta > 0 : null}
            />
            <Mercado
              label="5 · Marcador exacto"
              puntos={PUNTOS.MARCADOR_EXACTO}
              valor={`${combinada.predMarcadorLocal}-${combinada.predMarcadorVisita}`}
              acertado={finalizado ? combinada.puntosMarcador > 0 : null}
              ancho
            />
          </ul>

          <div className="mt-4 flex flex-col gap-3 border-t border-light pt-4 md:flex-row md:items-center md:justify-between">
            <p className="font-display text-label-md font-bold text-dark">
              {finalizado ? (
                <>
                  Mis puntos en este partido:{" "}
                  <span className="text-brand-blue-main">
                    {combinada.puntosTotal} / {totalPuntosMaximo()}
                  </span>
                </>
              ) : (
                <>
                  Total posible:{" "}
                  <span className="text-brand-gold-dark">
                    {totalPuntosMaximo()} pts
                  </span>{" "}
                  · {combinada.numEdiciones === 0
                    ? "Sin ediciones"
                    : `${combinada.numEdiciones} edición${combinada.numEdiciones === 1 ? "" : "es"}`}
                </>
              )}
            </p>

            {editable ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onAbrirModal}
                  className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-2.5 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:-translate-y-px hover:bg-brand-gold-light"
                >
                  Editar mi combinada ✏️
                </button>
                <button
                  type="button"
                  onClick={onEliminar}
                  className="touch-target inline-flex items-center justify-center gap-2 rounded-md border-2 border-strong bg-card px-4 py-2.5 font-display text-label-sm font-bold text-body transition-colors hover:border-urgent-critical hover:text-urgent-critical"
                >
                  Eliminar
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <SinCombinada
          editable={editable}
          onAbrirModal={onAbrirModal}
          finalizado={finalizado}
        />
      )}
    </section>
  );
}

function Mercado({
  label,
  puntos,
  valor,
  acertado,
  ancho,
}: {
  label: string;
  puntos: number;
  valor: string;
  acertado: boolean | null;
  ancho?: boolean;
}) {
  return (
    <li
      className={`rounded-sm border bg-subtle/40 px-3 py-2.5 ${
        ancho ? "md:col-span-2" : ""
      } ${
        acertado === true
          ? "border-pred-correct/50 bg-pred-correct-bg/30"
          : acertado === false
            ? "border-pred-wrong/40 bg-pred-wrong-bg/30"
            : "border-light"
      }`}
    >
      <p className="text-label-sm uppercase tracking-[0.04em] text-muted-d">
        {label} · {puntos} pts
      </p>
      <p className="font-display text-label-md font-extrabold text-dark">
        {valor}
        {acertado === true ? (
          <span className="ml-1.5 text-pred-correct">✓</span>
        ) : acertado === false ? (
          <span className="ml-1.5 text-pred-wrong">✗</span>
        ) : (
          <span className="ml-1.5 text-body-xs text-muted-d">pendiente</span>
        )}
      </p>
    </li>
  );
}

function SinCombinada({
  editable,
  onAbrirModal,
  finalizado,
}: {
  editable: boolean;
  onAbrirModal?: () => void;
  finalizado: boolean;
}) {
  if (!editable) {
    return (
      <p className="rounded-sm bg-subtle/50 px-4 py-6 text-center text-body-sm text-muted-d">
        {finalizado
          ? "Este partido ya terminó. No participaste con una combinada."
          : "El kickoff ya pasó. Las combinadas están bloqueadas."}
      </p>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-brand-gold/40 bg-brand-gold/[0.05] px-4 py-6 text-center">
      <p className="font-display text-display-xs font-bold text-dark">
        Todavía no jugaste este partido
      </p>
      <p className="text-body-sm text-muted-d">
        Armá tu combinada de 5 predicciones. Sumá puntos y peleá el Top 10
        del mes.
      </p>
      <button
        type="button"
        onClick={onAbrirModal}
        className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        🎯 Hacer mi combinada
      </button>
    </div>
  );
}

function RequiereLogin() {
  return (
    <section
      aria-label="Mi combinada"
      className="bg-card px-4 py-5 md:rounded-md md:border md:border-light md:px-6 md:py-6 md:shadow-sm"
    >
      <header className="mb-3">
        <h2 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark md:text-display-sm">
          <span aria-hidden>🎯</span>
          Hacer mi combinada
        </h2>
      </header>
      <p className="mb-4 text-body-sm text-body">
        Sumate gratis a la Liga Habla! para predecir este partido y pelear el
        Top 10 del mes.
      </p>
      <a
        href="/auth/signin"
        className="touch-target inline-flex items-center justify-center gap-2 rounded-md bg-brand-gold px-5 py-3 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light"
      >
        Iniciar sesión gratis
      </a>
    </section>
  );
}

function totalPuntosMaximo(): number {
  return (
    PUNTOS.RESULTADO +
    PUNTOS.BTTS +
    PUNTOS.MAS_25_GOLES +
    PUNTOS.TARJETA_ROJA +
    PUNTOS.MARCADOR_EXACTO
  );
}
