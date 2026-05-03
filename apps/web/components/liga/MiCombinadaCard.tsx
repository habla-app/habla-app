"use client";
// MiCombinadaCard — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-detail (.mi-combinada-card,
// líneas 3549-3597).
//
// Estructura del mockup:
//   .mi-combinada-card
//     .mi-combinada-header — título "🎯 Mi combinada" + badge estado
//     .mi-combinada-mercados — grid 2 columnas con 5 mercados (.mercado-item)
//     .mi-combinada-foot — puntos totales + control "Edición libre cerrada"
//
// El último mercado (.mercado-item.span2) ocupa 2 columnas en desktop.

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
  editable: boolean;
  finalizado: boolean;
  requiereLogin: boolean;
  onAbrirModal?: () => void;
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

  if (!tieneCombinada) {
    return (
      <SinCombinada
        editable={editable}
        finalizado={finalizado}
        onAbrirModal={onAbrirModal}
      />
    );
  }

  const c = combinada!;
  const totalMaximo = totalPuntosMaximo();

  return (
    <div className="mi-combinada-card">
      <div className="mi-combinada-header">
        <div className="mi-combinada-title">🎯 Mi combinada</div>
        {!editable ? (
          <span className="badge badge-gray">Cerrada al kickoff</span>
        ) : (
          <span className="badge badge-gold">Editable hasta kickoff</span>
        )}
      </div>

      <div className="mi-combinada-mercados">
        <Mercado
          label="Resultado"
          puntos={PUNTOS.RESULTADO}
          valor={
            c.predResultado === "LOCAL"
              ? equipoLocal
              : c.predResultado === "VISITA"
                ? equipoVisita
                : "Empate"
          }
          estado={estadoFinal(finalizado, c.puntosResultado)}
        />
        <Mercado
          label="Ambos anotan"
          puntos={PUNTOS.BTTS}
          valor={c.predBtts ? "Sí" : "No"}
          estado={estadoFinal(finalizado, c.puntosBtts)}
        />
        <Mercado
          label="Más de 2.5 goles"
          puntos={PUNTOS.MAS_25_GOLES}
          valor={c.predMas25 ? "Más" : "Menos"}
          estado={estadoFinal(finalizado, c.puntosMas25)}
        />
        <Mercado
          label="Tarjeta roja"
          puntos={PUNTOS.TARJETA_ROJA}
          valor={c.predTarjetaRoja ? "Sí" : "No"}
          estado={estadoFinal(finalizado, c.puntosTarjeta)}
        />
        <Mercado
          label="Marcador exacto"
          puntos={PUNTOS.MARCADOR_EXACTO}
          valor={`${c.predMarcadorLocal} - ${c.predMarcadorVisita}`}
          estado={estadoFinal(finalizado, c.puntosMarcador)}
          span2
        />
      </div>

      <div className="mi-combinada-foot">
        <div className="mi-combinada-puntos">
          <span style={{ color: "var(--text-muted-d)" }}>
            Mis puntos en este partido:
          </span>{" "}
          <strong>
            {c.puntosTotal} / {totalMaximo}
          </strong>
        </div>
        {editable ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onAbrirModal}
            >
              Editar combinada ✏️
            </button>
            {onEliminar ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onEliminar}
              >
                Eliminar
              </button>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: "var(--text-muted-d)" }}>
            Edición libre cerrada
          </div>
        )}
      </div>
    </div>
  );
}

function Mercado({
  label,
  puntos,
  valor,
  estado,
  span2,
}: {
  label: string;
  puntos: number;
  valor: string;
  estado: "ok" | "fail" | "pendiente" | null;
  span2?: boolean;
}) {
  return (
    <div className={`mercado-item${span2 ? " span2" : ""}`}>
      <div className="mercado-label">
        <span>{label}</span>
        <span className="mercado-pts">{puntos} pts</span>
      </div>
      <div className="mercado-value">
        {valor}{" "}
        {estado === "ok" ? (
          <span className="mercado-value-meta ok">✓</span>
        ) : estado === "fail" ? (
          <span className="mercado-value-meta">✗</span>
        ) : estado === "pendiente" ? (
          <span className="mercado-value-meta">pendiente</span>
        ) : null}
      </div>
    </div>
  );
}

function SinCombinada({
  editable,
  finalizado,
  onAbrirModal,
}: {
  editable: boolean;
  finalizado: boolean;
  onAbrirModal?: () => void;
}) {
  if (!editable) {
    return (
      <div className="mi-combinada-card" style={{ borderStyle: "dashed" }}>
        <div className="mi-combinada-header">
          <div className="mi-combinada-title">🎯 Mi combinada</div>
        </div>
        <p style={{ fontSize: 13, color: "var(--text-muted-d)", lineHeight: 1.5 }}>
          {finalizado
            ? "Este partido ya terminó. No participaste con una combinada."
            : "El kickoff ya pasó. Las combinadas están bloqueadas."}
        </p>
      </div>
    );
  }
  return (
    <div className="mi-combinada-card" style={{ borderStyle: "dashed" }}>
      <div className="mi-combinada-header">
        <div className="mi-combinada-title">🎯 Hacer mi combinada</div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-body)", marginBottom: 14, lineHeight: 1.5 }}>
        Armá tu combinada de 5 predicciones. Sumá puntos y peleá el Top 10 del
        mes.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={onAbrirModal}
      >
        🎯 Hacer mi combinada
      </button>
    </div>
  );
}

function RequiereLogin() {
  return (
    <div className="mi-combinada-card" style={{ borderStyle: "dashed" }}>
      <div className="mi-combinada-header">
        <div className="mi-combinada-title">🎯 Hacer mi combinada</div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-body)", marginBottom: 14, lineHeight: 1.5 }}>
        Sumate gratis a la Liga Habla! para predecir este partido y pelear el
        Top 10 del mes.
      </p>
      <a href="/auth/signin" className="btn btn-primary btn-block">
        Iniciar sesión gratis
      </a>
    </div>
  );
}

function estadoFinal(
  finalizado: boolean,
  puntos: number,
): "ok" | "fail" | "pendiente" | null {
  if (!finalizado) return "pendiente";
  return puntos > 0 ? "ok" : "fail";
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
