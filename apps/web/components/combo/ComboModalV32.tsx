"use client";
// ComboModalV32 — Lote M v3.2 (May 2026).
// Spec: docs/habla-mockup-v3.2.html § modal-combinada.
//
// Modal de combinada con las 9 sub-decisiones §4.9 cableadas:
//   - 4.9.1 Unique BD: si BD rechaza con 409, mostramos error claro.
//   - 4.9.2 Validación servidor antes del kickoff: el botón se deshabilita
//     en cliente al kickoff (countdown llega a 0); si igual el usuario
//     guarda, el endpoint rechaza con TORNEO_CERRADO.
//   - 4.9.5 Eliminación voluntaria: prop `puedeEliminar` muestra botón en
//     el footer (solo cuando ya hay combinada). Confirmación inline.
//   - 4.9.6 Las 5 predicciones obligatorias (validado en cliente +
//     re-validado por el endpoint via Zod).
//   - 4.9.7 numEdiciones se incrementa en el endpoint PUT.
//   - 4.9.8 Privacidad: las combinadas ajenas NUNCA se muestran (este
//     componente solo edita la del usuario actual).
//
// Decisión de UX: bottom sheet en mobile, centrado en desktop. El componente
// `<Modal>` ya provee el portal — solo cuidamos el padding y el max-width.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { authedFetch } from "@/lib/api-client";
import { PUNTOS } from "@habla/shared";
import { PredCard } from "./PredCard";
import { ScorePicker } from "./ScorePicker";

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
  /** Si existe, el modal opera en modo edición sobre este ticket. */
  ticketId?: string | null;
  /** Predicciones precargadas (para modo edición). */
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
  const [countdown, setCountdown] = useState<string>("--:--");

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

  // El countdown ya re-renderiza cada segundo, así que la comparación contra
  // Date.now() en el render es suficiente para detectar el corte. Excluimos
  // countdown del array de deps a propósito: solo lo usamos como trigger.
  const cerrado = torneo
    ? new Date(torneo.cierreAt).getTime() <= Date.now()
    : false;
  // countdown se referencia para que el linter entienda que es un trigger
  // intencional del re-render. Sin esta línea, los lints podrían marcar
  // countdown como variable no usada.
  void countdown;

  const completo =
    preds.predResultado !== undefined &&
    preds.predBtts !== undefined &&
    preds.predMas25 !== undefined &&
    preds.predTarjetaRoja !== undefined;

  const puntosMax = useMemo(() => {
    let total = 0;
    if (preds.predResultado !== undefined) total += PUNTOS.RESULTADO;
    if (preds.predBtts !== undefined) total += PUNTOS.BTTS;
    if (preds.predMas25 !== undefined) total += PUNTOS.MAS_25_GOLES;
    if (preds.predTarjetaRoja !== undefined) total += PUNTOS.TARJETA_ROJA;
    total += PUNTOS.MARCADOR_EXACTO;
    return total;
  }, [preds]);

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

  if (!torneo) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label={modoEdicion ? "Editar mi combinada" : "Crear combinada"}
      maxWidth="520px"
    >
      <div className="bg-card">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-brand-blue-mid via-brand-blue-main to-brand-blue-dark px-6 pb-4 pt-5 text-white md:px-7 md:pb-5 md:pt-6">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-[18px] text-white transition-colors hover:bg-white/30"
          >
            <span aria-hidden>×</span>
          </button>
          <p className="mb-1 text-label-sm font-bold uppercase tracking-[0.08em] text-white/70">
            🎯 {modoEdicion ? "Editar mi combinada" : "Tu combinada"}
          </p>
          <h2 className="mb-2 font-display text-display-sm font-extrabold leading-tight md:text-display-md">
            {torneo.partidoNombre}
          </h2>
          <p className="text-body-xs uppercase tracking-[0.05em] text-white/70">
            Cierre en{" "}
            <span
              className={
                cerrado ? "text-urgent-critical-bg" : "text-brand-gold-light"
              }
            >
              {cerrado ? "00:00" : countdown}
            </span>
          </p>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-6 py-5 md:px-7 md:py-6">
          <p className="mb-4 rounded-sm bg-alert-info-bg px-3 py-2 text-body-xs text-alert-info-text">
            ℹ️ Armá tu combinada con las 5 predicciones. Podés modificarla
            cuantas veces quieras hasta el kickoff. Después queda fija.
          </p>

          <PredCard<Resultado>
            question="1 · ¿Quién gana?"
            points={PUNTOS.RESULTADO}
            selected={preds.predResultado}
            onSelect={(v) => setPreds((p) => ({ ...p, predResultado: v }))}
            options={[
              { label: cortoNombre(torneo.equipoLocal), value: "LOCAL" },
              { label: "Empate", value: "EMPATE" },
              { label: cortoNombre(torneo.equipoVisita), value: "VISITA" },
            ]}
          />
          <PredCard<boolean>
            question="2 · ¿Ambos equipos anotan?"
            points={PUNTOS.BTTS}
            selected={preds.predBtts}
            onSelect={(v) => setPreds((p) => ({ ...p, predBtts: v }))}
            options={[
              { label: "Sí", value: true },
              { label: "No", value: false, isNegative: true },
            ]}
          />
          <PredCard<boolean>
            question="3 · ¿Más de 2.5 goles?"
            points={PUNTOS.MAS_25_GOLES}
            selected={preds.predMas25}
            onSelect={(v) => setPreds((p) => ({ ...p, predMas25: v }))}
            options={[
              { label: "Más", value: true },
              { label: "Menos", value: false, isNegative: true },
            ]}
          />
          <PredCard<boolean>
            question="4 · ¿Habrá tarjeta roja?"
            points={PUNTOS.TARJETA_ROJA}
            selected={preds.predTarjetaRoja}
            onSelect={(v) => setPreds((p) => ({ ...p, predTarjetaRoja: v }))}
            options={[
              { label: "Sí", value: true },
              { label: "No", value: false, isNegative: true },
            ]}
          />
          <PredCard<string>
            question="5 · Marcador exacto"
            points={PUNTOS.MARCADOR_EXACTO}
            selected={`${preds.predMarcadorLocal}-${preds.predMarcadorVisita}`}
            onSelect={() => {
              /* never */
            }}
            options={[]}
          >
            <ScorePicker
              nombreLocal={cortoNombre(torneo.equipoLocal)}
              nombreVisita={cortoNombre(torneo.equipoVisita)}
              golesLocal={preds.predMarcadorLocal}
              golesVisita={preds.predMarcadorVisita}
              onChange={(local, visita) =>
                setPreds((p) => ({
                  ...p,
                  predMarcadorLocal: local,
                  predMarcadorVisita: visita,
                }))
              }
            />
            <p className="mt-2 text-body-xs text-muted-d">
              El más difícil pero el que más puntos da.
            </p>
          </PredCard>

          {errorMsg ? (
            <p
              role="alert"
              className={`mt-3 rounded-sm border px-3 py-2 text-body-sm ${
                status === "closed"
                  ? "border-alert-warning-border bg-alert-warning-bg text-alert-warning-text"
                  : "border-alert-danger-border bg-alert-danger-bg text-alert-danger-text"
              }`}
            >
              {errorMsg}
            </p>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-light bg-card px-6 py-4 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-gold/15 px-2.5 py-1 font-display text-label-sm font-extrabold text-brand-gold-dark">
              {puntosMax} pts máx
            </span>
            {modoEdicion && !confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-body-xs text-muted-d underline-offset-2 transition-colors hover:text-urgent-critical hover:underline"
                disabled={status === "submitting" || status === "deleting"}
              >
                Eliminar combinada
              </button>
            ) : null}
          </div>

          {confirmDelete ? (
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <span className="text-body-xs text-muted-d md:mr-2">
                ¿Seguro que querés eliminar?
              </span>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="touch-target flex-1 rounded-md border border-strong bg-card px-4 py-2.5 font-display text-label-sm font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main md:flex-none"
                disabled={status === "deleting"}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="touch-target flex-1 rounded-md bg-urgent-critical px-4 py-2.5 font-display text-label-sm font-extrabold uppercase text-white transition-all hover:-translate-y-px md:flex-none"
                disabled={status === "deleting"}
              >
                {status === "deleting" ? "Eliminando…" : "Sí, eliminar"}
              </button>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <button
                type="button"
                onClick={onClose}
                className="touch-target flex-1 rounded-md border border-strong bg-card px-4 py-3 font-display text-label-md font-bold text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main md:flex-none"
                disabled={status === "submitting"}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={
                  cerrado ||
                  !completo ||
                  status === "submitting" ||
                  status === "success"
                }
                className="touch-target flex-1 rounded-md bg-brand-gold px-5 py-3 font-display text-label-md font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
              >
                {status === "submitting"
                  ? "Guardando…"
                  : status === "success"
                    ? "✓ Guardada"
                    : modoEdicion
                      ? "Actualizar combinada"
                      : "Guardar combinada"}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function formatoCountdown(cierre: Date | string): string {
  const diff = new Date(cierre).getTime() - Date.now();
  if (diff <= 0) return "00:00";
  const horas = Math.floor(diff / (60 * 60 * 1000));
  const mins = Math.floor((diff / 60_000) % 60);
  const secs = Math.floor((diff / 1000) % 60);
  if (horas > 0) {
    return `${String(horas).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function cortoNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length <= 10) return limpio;
  return limpio.split(/\s+/)[0] ?? limpio.slice(0, 8);
}
