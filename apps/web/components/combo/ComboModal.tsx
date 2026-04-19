"use client";
// ComboModal — modal centrado donde el usuario arma sus 5 predicciones.
// Sub-Sprint 4. Replica `.combo-panel` / `.combo-panel-head` / `.combo-body`
// / `.combo-foot` del mockup (docs/habla-mockup-completo.html §combo).
//
// Hotfix post-Sub-Sprint 5: la lógica de "Balance después" + decisión
// CTA submit/comprar vive en `computeComboFooterState` (mapper puro),
// para que el modal nunca renderice "-5" y bloquee el submit cuando el
// balance no alcanza la entrada (caso sin placeholder).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useLukasStore } from "@/stores/lukas.store";
import { authedFetch } from "@/lib/api-client";
import { PUNTOS } from "@habla/shared";
import { PredCard } from "./PredCard";
import { ScorePicker } from "./ScorePicker";
import { computeComboFooterState } from "./combo-info.mapper";

export interface ComboTorneoInfo {
  torneoId: string;
  partidoNombre: string;
  equipoLocal: string;
  equipoVisita: string;
  entradaLukas: number;
  pozoBruto: number;
  primerPremioEstimado: number;
  cierreAt: Date | string;
  /** Si existe placeholder del Sub-Sprint 3, no se descuenta entrada de nuevo. */
  tienePlaceholder: boolean;
}

interface ComboModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Info del torneo pre-cargada desde el caller. */
  torneo: ComboTorneoInfo | null;
  /** Callback tras crear el ticket exitosamente. */
  onCreated?: (result: { ticketId: string; nuevoBalance: number }) => void;
}

type Resultado = "LOCAL" | "EMPATE" | "VISITA";

interface Predicciones {
  predResultado?: Resultado;
  predBtts?: boolean;
  predMas25?: boolean;
  predTarjetaRoja?: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}

const PREDICCIONES_INICIAL: Predicciones = {
  predMarcadorLocal: 1,
  predMarcadorVisita: 1,
};

// Países de formato: Peruvian es-PE.
function formatoMiles(n: number): string {
  return n.toLocaleString("es-PE");
}

function formatoCountdown(cierre: Date | string): string {
  const diff = new Date(cierre).getTime() - Date.now();
  if (diff <= 0) return "Cerrado";
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) {
    return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }
  const horas = Math.floor(mins / 60);
  const rest = mins % 60;
  return `${String(horas).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

export function ComboModal({
  isOpen,
  onClose,
  torneo,
  onCreated,
}: ComboModalProps) {
  const [preds, setPreds] = useState<Predicciones>(PREDICCIONES_INICIAL);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<string>("--:--");

  const balance = useLukasStore((s) => s.balance);
  const decrementar = useLukasStore((s) => s.decrementar);
  const setBalance = useLukasStore((s) => s.setBalance);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setPreds(PREDICCIONES_INICIAL);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // Tick countdown cada segundo
  useEffect(() => {
    if (!isOpen || !torneo) return;
    setCountdown(formatoCountdown(torneo.cierreAt));
    const id = setInterval(() => {
      setCountdown(formatoCountdown(torneo.cierreAt));
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, torneo]);

  const puntosMax = useMemo(() => {
    let total = 0;
    if (preds.predResultado !== undefined) total += PUNTOS.RESULTADO;
    if (preds.predBtts !== undefined) total += PUNTOS.BTTS;
    if (preds.predMas25 !== undefined) total += PUNTOS.MAS_25_GOLES;
    if (preds.predTarjetaRoja !== undefined) total += PUNTOS.TARJETA_ROJA;
    // Marcador siempre cuenta — inicia en 1-1
    total += PUNTOS.MARCADOR_EXACTO;
    return total;
  }, [preds]);

  const listo = useMemo(() => {
    return (
      preds.predResultado !== undefined &&
      preds.predBtts !== undefined &&
      preds.predMas25 !== undefined &&
      preds.predTarjetaRoja !== undefined
    );
  }, [preds]);

  const footer = useMemo(() => {
    if (!torneo) return null;
    return computeComboFooterState({
      balance,
      entradaLukas: torneo.entradaLukas,
      tienePlaceholder: torneo.tienePlaceholder,
    });
  }, [balance, torneo]);
  const costoLukas = footer?.costoLukas ?? 0;
  const displayBalanceDespues = footer?.displayBalanceDespues ?? 0;
  const balanceInsuficiente = footer?.balanceInsuficiente ?? false;

  const handleSubmit = useCallback(async () => {
    if (!torneo) return;
    if (!listo) {
      setError("Completá las 5 predicciones antes de enviar.");
      return;
    }
    if (balanceInsuficiente) {
      // Defensa adicional: el botón ya queda oculto cuando no hay balance,
      // pero si por algún motivo se llama (ej. test, race), no avanzamos.
      setError(
        `Balance insuficiente. Necesitas ${torneo.entradaLukas} Lukas para inscribirte.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
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
      const res = await authedFetch("/api/v1/tickets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        data?: {
          ticket: { id: string };
          nuevoBalance: number;
          reemplazoPlaceholder: boolean;
        };
        error?: { code: string; message: string };
      };
      if (!res.ok || !json.data) {
        const msg = json.error?.message ?? "No se pudo enviar la combinada.";
        setError(msg);
        setSubmitting(false);
        return;
      }
      // Actualiza store y cierra
      setBalance(json.data.nuevoBalance);
      if (!json.data.reemplazoPlaceholder && costoLukas > 0) {
        decrementar(0); /* no-op — setBalance ya alineó */
      }
      onCreated?.({
        ticketId: json.data.ticket.id,
        nuevoBalance: json.data.nuevoBalance,
      });
      setSubmitting(false);
      onClose();
    } catch (err) {
      setError((err as Error).message ?? "Error de red.");
      setSubmitting(false);
    }
  }, [
    torneo,
    listo,
    balanceInsuficiente,
    preds,
    costoLukas,
    setBalance,
    decrementar,
    onCreated,
    onClose,
  ]);

  if (!torneo) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label="Crear combinada"
      maxWidth="640px"
    >
      {/* HEAD */}
      <div className="relative bg-hero-blue px-7 pb-5 pt-6 text-white">
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1 animate-shimmer bg-gold-shimmer bg-[length:200%_100%]"
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-[18px] text-white transition-colors hover:bg-white/30"
        >
          <span aria-hidden>✕</span>
        </button>
        <div className="mb-1.5 flex items-center gap-2 font-display text-[12px] font-extrabold uppercase tracking-[0.1em] text-white/70">
          <span aria-hidden>🎯</span> Crear combinada
        </div>
        <div className="mb-3.5 font-display text-[28px] font-black leading-tight text-white">
          {torneo.partidoNombre}
        </div>
        <div className="grid grid-cols-4 gap-4">
          <MetaBox
            label="Entrada"
            value={
              torneo.tienePlaceholder
                ? "Ya pagada"
                : `${formatoMiles(torneo.entradaLukas)} 🪙`
            }
          />
          <MetaBox label="Pozo" value={`${formatoMiles(torneo.pozoBruto)} 🪙`} />
          <MetaBox
            label="1er premio"
            value={`${formatoMiles(torneo.primerPremioEstimado)}`}
          />
          <MetaBox label="Cierre" value={countdown} />
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto bg-page px-7 py-5">
        <div className="mb-3.5 flex items-center gap-2.5 font-display text-[13px] font-extrabold uppercase tracking-[0.08em] text-muted-d">
          <span
            aria-hidden
            className="block h-[3px] w-5 flex-shrink-0 rounded-full bg-brand-gold"
          />
          Tus 5 predicciones
          <span aria-hidden className="block h-px flex-1 bg-border-light" />
        </div>

        <PredCard<Resultado>
          question="¿Quién gana?"
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
          question="¿Ambos equipos anotan?"
          points={PUNTOS.BTTS}
          selected={preds.predBtts}
          onSelect={(v) => setPreds((p) => ({ ...p, predBtts: v }))}
          options={[
            { label: "Sí", value: true },
            { label: "No", value: false, isNegative: true },
          ]}
        />

        <PredCard<boolean>
          question="¿Más de 2.5 goles?"
          points={PUNTOS.MAS_25_GOLES}
          selected={preds.predMas25}
          onSelect={(v) => setPreds((p) => ({ ...p, predMas25: v }))}
          options={[
            { label: "Sí", value: true },
            { label: "No", value: false, isNegative: true },
          ]}
        />

        <PredCard<boolean>
          question="¿Habrá tarjeta roja?"
          points={PUNTOS.TARJETA_ROJA}
          selected={preds.predTarjetaRoja}
          onSelect={(v) => setPreds((p) => ({ ...p, predTarjetaRoja: v }))}
          options={[
            { label: "Sí", value: true },
            { label: "No", value: false, isNegative: true },
          ]}
        />

        <PredCard<string>
          question="Marcador exacto"
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
        </PredCard>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-sm border border-urgent-critical/40 bg-urgent-critical/10 px-3 py-2 text-[13px] font-semibold text-danger"
          >
            {error}
          </div>
        )}
      </div>

      {/* FOOT */}
      <div className="border-t border-light bg-card px-7 py-4 shadow-[0_-4px_12px_rgba(0,16,80,.06)]">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <SummaryBox label="Puntos máx" value={`${puntosMax} pts`} gold />
          <SummaryBox
            label="Balance después"
            value={`${formatoMiles(displayBalanceDespues)} 🪙`}
          />
        </div>
        {balanceInsuficiente ? (
          <BuyLukasCTA
            entradaLukas={torneo.entradaLukas}
            balanceActual={balance}
          />
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!listo || submitting}
            data-testid="combo-submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all duration-150 hover:bg-brand-gold-light hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <span aria-hidden>🎯</span>
            {submitting
              ? "Enviando..."
              : torneo.tienePlaceholder
                ? "Confirmar mi combinada"
                : `Inscribir por ${formatoMiles(torneo.entradaLukas)} 🪙`}
          </button>
        )}
      </div>
    </Modal>
  );
}

function BuyLukasCTA({
  entradaLukas,
  balanceActual,
}: {
  entradaLukas: number;
  balanceActual: number;
}) {
  const faltan = Math.max(0, entradaLukas - balanceActual);
  return (
    <div className="flex flex-col gap-2">
      <p
        role="alert"
        className="rounded-sm border border-urgent-critical/30 bg-urgent-critical/10 px-3 py-2 text-center text-[13px] font-semibold text-danger"
      >
        Te faltan {formatoMiles(faltan)} 🪙 para inscribirte en este torneo.
      </p>
      <Link
        href="/wallet"
        data-testid="combo-buy-lukas"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all duration-150 hover:bg-brand-gold-light hover:-translate-y-px"
      >
        <span aria-hidden>🪙</span>
        Comprar Lukas
      </Link>
    </div>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <div className="font-display text-[20px] font-black leading-none text-brand-gold">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-white/65">
        {label}
      </div>
    </div>
  );
}

function SummaryBox({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-sm border ${
        gold
          ? "border-brand-gold/40 bg-brand-gold/10"
          : "border-light bg-subtle"
      } px-2 py-2.5`}
    >
      <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </div>
      <div
        className={`font-display text-[22px] font-black leading-none ${
          gold ? "text-brand-gold-dark" : "text-dark"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function cortoNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length <= 10) return limpio;
  return limpio.split(/\s+/)[0] ?? limpio.slice(0, 8);
}
