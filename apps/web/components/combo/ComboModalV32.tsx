"use client";
// ComboModalV32 — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § modal-combinada (líneas 7585-7679).
//
// Estructura del mockup:
//   .modal-combinada-backdrop
//     .modal-combinada-sheet
//       .modal-combinada-header (drag handle + título + meta countdown + close)
//       .modal-combinada-body
//         <p.modal-combinada-intro> "Armá tu combinada con las 5 predicciones..."
//         5x .market-row con .market-row-header + .market-options
//         .modal-help-box (i + Total posible)
//       .modal-combinada-footer (cancelar + guardar)
//
// Reglas §4.9 (validación servidor + numEdiciones + 5 obligatorias + eliminar
// hasta kickoff) cableadas tal cual el componente Lote M.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { authedFetch } from "@/lib/api-client";
import { PUNTOS } from "@habla/shared";

export interface ComboPredIniciales {
  predResultado: "LOCAL" | "EMPATE" | "VISITA";
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}

export interface ComboTorneoInfo {
  torneoId: string;
  partidoNombre: string;
  equipoLocal: string;
  equipoVisita: string;
  cierreAt: Date | string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  torneo: ComboTorneoInfo | null;
  ticketId?: string | null;
  predIniciales?: ComboPredIniciales | null;
  onSaved?: () => void;
}

type Resultado = "LOCAL" | "EMPATE" | "VISITA";

interface PredsState {
  predResultado?: Resultado;
  predBtts?: boolean;
  predMas25?: boolean;
  predTarjetaRoja?: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}

const PREDS_BASE: PredsState = {
  predMarcadorLocal: 1,
  predMarcadorVisita: 1,
};

type Status = "idle" | "submitting" | "deleting" | "success" | "error" | "closed";

export function ComboModalV32({
  isOpen,
  onClose,
  torneo,
  ticketId,
  predIniciales,
  onSaved,
}: Props) {
  const router = useRouter();
  const modoEdicion = !!ticketId && !!predIniciales;

  const [preds, setPreds] = useState<PredsState>(() =>
    predIniciales
      ? {
          predResultado: predIniciales.predResultado,
          predBtts: predIniciales.predBtts,
          predMas25: predIniciales.predMas25,
          predTarjetaRoja: predIniciales.predTarjetaRoja,
          predMarcadorLocal: predIniciales.predMarcadorLocal,
          predMarcadorVisita: predIniciales.predMarcadorVisita,
        }
      : PREDS_BASE,
  );
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [countdown, setCountdown] = useState<string>("--:--:--");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    setStatus("idle");
    setErrorMsg(null);
    setConfirmDelete(false);
    setPreds(
      predIniciales
        ? {
            predResultado: predIniciales.predResultado,
            predBtts: predIniciales.predBtts,
            predMas25: predIniciales.predMas25,
            predTarjetaRoja: predIniciales.predTarjetaRoja,
            predMarcadorLocal: predIniciales.predMarcadorLocal,
            predMarcadorVisita: predIniciales.predMarcadorVisita,
          }
        : PREDS_BASE,
    );
  }, [isOpen, predIniciales]);

  useEffect(() => {
    if (!isOpen || !torneo) return;
    function tick() {
      setCountdown(formatoCountdown(torneo!.cierreAt));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [isOpen, torneo]);

  // Body scroll lock + ESC para cerrar
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, onClose]);

  const cerrado = torneo
    ? new Date(torneo.cierreAt).getTime() <= Date.now()
    : false;
  void countdown;

  const completo =
    preds.predResultado !== undefined &&
    preds.predBtts !== undefined &&
    preds.predMas25 !== undefined &&
    preds.predTarjetaRoja !== undefined;

  const handleSubmit = useCallback(async () => {
    if (!torneo) return;
    if (cerrado) {
      setStatus("closed");
      setErrorMsg("El partido ya empezó. Las combinadas están bloqueadas.");
      return;
    }
    if (!completo) {
      setStatus("error");
      setErrorMsg("Completá las 5 predicciones antes de guardar.");
      return;
    }
    setStatus("submitting");
    setErrorMsg(null);
    try {
      const body = {
        torneoId: torneo.torneoId,
        predResultado: preds.predResultado!,
        predBtts: preds.predBtts!,
        predMas25: preds.predMas25!,
        predTarjetaRoja: preds.predTarjetaRoja!,
        predMarcadorLocal: preds.predMarcadorLocal,
        predMarcadorVisita: preds.predMarcadorVisita,
      };
      const url = modoEdicion ? `/api/v1/tickets/${ticketId}` : "/api/v1/tickets";
      const method = modoEdicion ? "PUT" : "POST";
      const res = await authedFetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: unknown;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !json.data) {
        if (
          json.error?.code === "TORNEO_CERRADO" ||
          json.error?.code === "TORNEO_NO_ENCONTRADO"
        ) {
          setStatus("closed");
          setErrorMsg(
            json.error.message ?? "El partido ya empezó. La combinada está bloqueada.",
          );
        } else {
          setStatus("error");
          setErrorMsg(json.error?.message ?? "No se pudo guardar la combinada.");
        }
        return;
      }
      setStatus("success");
      router.refresh();
      onSaved?.();
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message ?? "Error de red.");
    }
  }, [torneo, cerrado, completo, preds, modoEdicion, ticketId, router, onSaved]);

  const handleDelete = useCallback(async () => {
    if (!ticketId) return;
    setStatus("deleting");
    setErrorMsg(null);
    try {
      const res = await authedFetch(`/api/v1/tickets/${ticketId}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as {
        data?: unknown;
        error?: { code?: string; message?: string };
      };
      if (!res.ok || !json.data) {
        if (json.error?.code === "TORNEO_CERRADO") {
          setStatus("closed");
          setErrorMsg(
            json.error.message ?? "El partido ya empezó. La combinada está bloqueada.",
          );
        } else {
          setStatus("error");
          setErrorMsg(json.error?.message ?? "No se pudo eliminar.");
        }
        return;
      }
      setStatus("success");
      setConfirmDelete(false);
      router.refresh();
      onSaved?.();
      onClose();
    } catch (err) {
      setStatus("error");
      setErrorMsg((err as Error).message ?? "Error de red.");
    }
  }, [ticketId, router, onSaved, onClose]);

  if (!mounted || !isOpen || !torneo) return null;

  const sheet = (
    <div
      className="modal-combinada-backdrop open"
      style={{ display: "flex" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={modoEdicion ? "Editar mi combinada" : "Crear combinada"}
    >
      <div className="modal-combinada-sheet">
        <div className="modal-combinada-header">
          <div>
            <div className="modal-combinada-title">
              {modoEdicion ? "Editar mi combinada" : "Tu combinada"}
            </div>
            <div className="modal-combinada-meta">
              {torneo.partidoNombre} · cierre en{" "}
              <strong style={{ color: "var(--live)" }}>
                {cerrado ? "00:00:00" : countdown}
              </strong>
            </div>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="modal-combinada-body">
          <p className="modal-combinada-intro">
            Armá tu combinada con las 5 predicciones. Podés{" "}
            <strong>modificarla cuantas veces quieras</strong> hasta el kickoff.
            Después queda fija.
          </p>

          {/* Mercado 1: Resultado */}
          <div className="market-row">
            <div className="market-row-header">
              <div className="market-row-label">1 · Resultado</div>
              <span className="market-row-pts">{PUNTOS.RESULTADO} pts</span>
            </div>
            <div className="market-options triple">
              <OptBtn
                label="Local"
                selected={preds.predResultado === "LOCAL"}
                onClick={() => setPreds((p) => ({ ...p, predResultado: "LOCAL" }))}
              />
              <OptBtn
                label="Empate"
                selected={preds.predResultado === "EMPATE"}
                onClick={() => setPreds((p) => ({ ...p, predResultado: "EMPATE" }))}
              />
              <OptBtn
                label="Visita"
                selected={preds.predResultado === "VISITA"}
                onClick={() => setPreds((p) => ({ ...p, predResultado: "VISITA" }))}
              />
            </div>
          </div>

          {/* Mercado 2: Ambos anotan */}
          <div className="market-row">
            <div className="market-row-header">
              <div className="market-row-label">2 · Ambos anotan</div>
              <span className="market-row-pts">{PUNTOS.BTTS} pts</span>
            </div>
            <div className="market-options binary">
              <OptBtn
                label="Sí"
                selected={preds.predBtts === true}
                onClick={() => setPreds((p) => ({ ...p, predBtts: true }))}
              />
              <OptBtn
                label="No"
                selected={preds.predBtts === false}
                onClick={() => setPreds((p) => ({ ...p, predBtts: false }))}
              />
            </div>
          </div>

          {/* Mercado 3: Más / Menos 2.5 */}
          <div className="market-row">
            <div className="market-row-header">
              <div className="market-row-label">3 · Total goles</div>
              <span className="market-row-pts">{PUNTOS.MAS_25_GOLES} pts</span>
            </div>
            <div className="market-options binary">
              <OptBtn
                label="Más de 2.5"
                selected={preds.predMas25 === true}
                onClick={() => setPreds((p) => ({ ...p, predMas25: true }))}
              />
              <OptBtn
                label="Menos de 2.5"
                selected={preds.predMas25 === false}
                onClick={() => setPreds((p) => ({ ...p, predMas25: false }))}
              />
            </div>
          </div>

          {/* Mercado 4: Tarjeta roja */}
          <div className="market-row">
            <div className="market-row-header">
              <div className="market-row-label">4 · ¿Habrá tarjeta roja?</div>
              <span className="market-row-pts">{PUNTOS.TARJETA_ROJA} pts</span>
            </div>
            <div className="market-options binary">
              <OptBtn
                label="Sí"
                selected={preds.predTarjetaRoja === true}
                onClick={() =>
                  setPreds((p) => ({ ...p, predTarjetaRoja: true }))
                }
              />
              <OptBtn
                label="No"
                selected={preds.predTarjetaRoja === false}
                onClick={() =>
                  setPreds((p) => ({ ...p, predTarjetaRoja: false }))
                }
              />
            </div>
          </div>

          {/* Mercado 5: Marcador exacto */}
          <div className="market-row">
            <div className="market-row-header">
              <div className="market-row-label">5 · Marcador exacto</div>
              <span className="market-row-pts">{PUNTOS.MARCADOR_EXACTO} pts</span>
            </div>
            <div className="market-options score">
              <input
                className="score-input"
                type="number"
                min={0}
                max={9}
                value={preds.predMarcadorLocal}
                onChange={(e) =>
                  setPreds((p) => ({
                    ...p,
                    predMarcadorLocal: clamp(parseInt(e.target.value) || 0),
                  }))
                }
                aria-label={`Goles ${torneo.equipoLocal}`}
              />
              <span className="score-vs">-</span>
              <input
                className="score-input"
                type="number"
                min={0}
                max={9}
                value={preds.predMarcadorVisita}
                onChange={(e) =>
                  setPreds((p) => ({
                    ...p,
                    predMarcadorVisita: clamp(parseInt(e.target.value) || 0),
                  }))
                }
                aria-label={`Goles ${torneo.equipoVisita}`}
              />
            </div>
            <div className="modal-score-hint">
              El más difícil pero el que más puntos da
            </div>
          </div>

          <div className="modal-help-box">
            <span style={{ fontSize: 16, flexShrink: 0 }}>ℹ️</span>
            <span>
              Total posible: <strong>{totalPuntosMaximo()} puntos</strong>. Suma
              para subir en el ranking del mes y entrar al Top 10 que cobra
              S/1,250.
            </span>
          </div>

          {errorMsg ? (
            <p
              role="alert"
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 8,
                background:
                  status === "closed"
                    ? "var(--alert-warning-bg)"
                    : "var(--alert-danger-bg)",
                color:
                  status === "closed"
                    ? "var(--alert-warning-text)"
                    : "var(--alert-danger-text)",
                fontSize: 13,
                border: `1px solid ${
                  status === "closed"
                    ? "var(--alert-warning-border)"
                    : "var(--alert-danger-border)"
                }`,
              }}
            >
              {errorMsg}
            </p>
          ) : null}
        </div>

        <div className="modal-combinada-footer">
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={status === "deleting"}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                style={{ background: "var(--pred-wrong)", color: "#fff" }}
                onClick={handleDelete}
                disabled={status === "deleting"}
              >
                {status === "deleting" ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </>
          ) : (
            <>
              {modoEdicion ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setConfirmDelete(true)}
                  disabled={status === "submitting"}
                >
                  Eliminar combinada
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={status === "submitting"}
                >
                  Cancelar
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={
                  cerrado ||
                  !completo ||
                  status === "submitting" ||
                  status === "success"
                }
              >
                {status === "submitting"
                  ? "Guardando…"
                  : status === "success"
                    ? "✓ Guardada"
                    : modoEdicion
                      ? "Actualizar combinada"
                      : "Guardar combinada"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(sheet, document.body);
}

function OptBtn({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`market-opt${selected ? " selected" : ""}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 9) return 9;
  return Math.floor(n);
}

function formatoCountdown(cierre: Date | string): string {
  const diff = new Date(cierre).getTime() - Date.now();
  if (diff <= 0) return "00:00:00";
  const horas = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor((diff / 60_000) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
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

