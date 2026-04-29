"use client";
// ComboModal — modal centrado donde el usuario arma sus 5 predicciones.
//
// Lote 2 (Abr 2026): se demolió el sistema de Lukas. El modal pierde la
// info económica del header (entrada / pozo / 1er premio), el footer de
// "Balance después" y el flujo de "comprar Lukas". El header de éxito
// ahora dice "Tu predicción está lista. ¡Sigue el ranking!".

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { authedFetch } from "@/lib/api-client";
import { PUNTOS } from "@habla/shared";
import { PredCard } from "./PredCard";
import { ScorePicker } from "./ScorePicker";
import {
  computeComboModalUIState,
  statusFromBackendError,
  type ComboModalStatus,
  type ComboSuccessInfo,
} from "./combo-modal-status";

export interface ComboTorneoInfo {
  torneoId: string;
  partidoNombre: string;
  equipoLocal: string;
  equipoVisita: string;
  cierreAt: Date | string;
  /** Si existe placeholder de la inscripción, no se crea ticket nuevo —
   *  se actualiza el placeholder con las predicciones del usuario. */
  tienePlaceholder: boolean;
}

interface ComboModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Info del torneo pre-cargada desde el caller. */
  torneo: ComboTorneoInfo | null;
  /** Callback tras crear el ticket exitosamente. */
  onCreated?: (result: { ticketId: string }) => void;
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
  const [status, setStatus] = useState<ComboModalStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<ComboSuccessInfo | null>(null);
  const [countdown, setCountdown] = useState<string>("--:--");

  const router = useRouter();

  useEffect(() => {
    if (isOpen) {
      setPreds(PREDICCIONES_INICIAL);
      setStatus("idle");
      setErrorMessage(null);
      setSuccessInfo(null);
    }
  }, [isOpen]);

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

  const handleSubmit = useCallback(async () => {
    if (!torneo) return;
    if (!listo) {
      setStatus("error");
      setErrorMessage("Completá las 5 predicciones antes de enviar.");
      return;
    }
    setStatus("submitting");
    setErrorMessage(null);
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
          reemplazoPlaceholder: boolean;
        };
        error?: { code: string; message: string };
      };
      if (!res.ok || !json.data) {
        const nextStatus = statusFromBackendError(json.error?.code);
        setStatus(nextStatus);
        setErrorMessage(json.error?.message ?? "No se pudo enviar la combinada.");
        return;
      }
      router.refresh();
      setSuccessInfo({
        ticketId: json.data.ticket.id,
        puntosMaximos: puntosMax,
        predResumen: {
          resultado: preds.predResultado!,
          btts: preds.predBtts!,
          mas25: preds.predMas25!,
          tarjetaRoja: preds.predTarjetaRoja!,
          marcadorLocal: preds.predMarcadorLocal,
          marcadorVisita: preds.predMarcadorVisita,
        },
        reemplazoPlaceholder: json.data.reemplazoPlaceholder,
      });
      setStatus("success");
      onCreated?.({ ticketId: json.data.ticket.id });
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message ?? "Error de red.");
    }
  }, [torneo, listo, preds, puntosMax, router, onCreated]);

  const handleReset = useCallback(() => {
    setPreds(PREDICCIONES_INICIAL);
    setStatus("idle");
    setErrorMessage(null);
    setSuccessInfo(null);
  }, []);

  if (!torneo) return null;

  const ui = computeComboModalUIState({
    status,
    tienePlaceholder: torneo.tienePlaceholder,
    errorMessage,
  });

  const isFeedback = status !== "idle";

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
        <div className="text-[12px] font-bold uppercase tracking-[0.06em] text-white/65">
          Cierra en <span className="text-white">{countdown}</span>
        </div>
      </div>

      {/* BODY */}
      {isFeedback ? (
        <FeedbackBody
          status={status}
          ui={ui}
          successInfo={successInfo}
          torneo={torneo}
        />
      ) : (
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
        </div>
      )}

      {/* FOOT */}
      <FooterSection
        status={status}
        ui={ui}
        puntosMax={puntosMax}
        listo={listo}
        tienePlaceholder={torneo.tienePlaceholder}
        onSubmit={handleSubmit}
        onReset={handleReset}
        onClose={onClose}
      />
    </Modal>
  );
}

function FeedbackBody({
  status,
  ui,
  successInfo,
  torneo,
}: {
  status: ComboModalStatus;
  ui: ReturnType<typeof computeComboModalUIState>;
  successInfo: ComboSuccessInfo | null;
  torneo: ComboTorneoInfo;
}) {
  const toneClasses: Record<string, string> = {
    success: "bg-brand-green/10 border-brand-green/35",
    error: "bg-urgent-critical/10 border-urgent-critical/35",
    warning: "bg-brand-gold/10 border-brand-gold/35",
    neutral: "bg-card border-light",
  };
  return (
    <div
      className="flex-1 overflow-y-auto bg-page px-7 py-8"
      data-testid={`combo-feedback-${status}`}
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex flex-col items-center rounded-lg border px-5 py-8 text-center shadow-sm ${toneClasses[ui.tone]}`}
      >
        <div aria-hidden className="mb-3 text-5xl">
          {ui.icon}
        </div>
        <h2 className="mb-2 font-display text-[24px] font-black uppercase leading-tight tracking-[0.01em] text-dark">
          {ui.bodyTitle}
        </h2>
        <p className="max-w-[420px] text-[14px] leading-relaxed text-body">
          {ui.bodyCopy}
        </p>

        {status === "success" && successInfo && (
          <SuccessDetails info={successInfo} torneo={torneo} />
        )}
      </div>
    </div>
  );
}

function SuccessDetails({
  info,
  torneo,
}: {
  info: ComboSuccessInfo;
  torneo: ComboTorneoInfo;
}) {
  const chips: Array<{ label: string; key: string }> = [
    {
      key: "resultado",
      label:
        info.predResumen.resultado === "LOCAL"
          ? cortoNombre(torneo.equipoLocal)
          : info.predResumen.resultado === "VISITA"
            ? cortoNombre(torneo.equipoVisita)
            : "Empate",
    },
    { key: "btts", label: `Ambos ${info.predResumen.btts ? "Sí" : "No"}` },
    { key: "mas25", label: `+2.5 ${info.predResumen.mas25 ? "Sí" : "No"}` },
    { key: "roja", label: `Roja ${info.predResumen.tarjetaRoja ? "Sí" : "No"}` },
    {
      key: "marcador",
      label: `${info.predResumen.marcadorLocal}-${info.predResumen.marcadorVisita}`,
    },
  ];

  return (
    <div
      className="mt-5 w-full max-w-[460px] rounded-md border border-light bg-card px-4 py-4 text-left shadow-sm"
      data-testid="combo-success-details"
    >
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-d">
        Tu combinada
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.key}
            className="rounded-full bg-brand-gold-dim px-2.5 py-1 font-display text-[12px] font-bold text-brand-gold-dark"
          >
            {c.label}
          </span>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-[12px]">
        <Meta label="Puntos máx posibles">{info.puntosMaximos} pts</Meta>
        <Meta label="ID ticket">
          <span className="font-mono text-[11px]">
            {info.ticketId.slice(0, 10)}…
          </span>
        </Meta>
      </dl>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        {label}
      </dt>
      <dd className="font-display text-[14px] font-extrabold text-dark">
        {children}
      </dd>
    </div>
  );
}

function FooterSection({
  status,
  ui,
  puntosMax,
  listo,
  tienePlaceholder,
  onSubmit,
  onReset,
  onClose,
}: {
  status: ComboModalStatus;
  ui: ReturnType<typeof computeComboModalUIState>;
  puntosMax: number;
  listo: boolean;
  tienePlaceholder: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  if (status !== "idle") {
    return (
      <div
        className="border-t border-light bg-card px-7 py-4 shadow-[0_-4px_12px_rgba(0,16,80,.06)]"
        data-testid="combo-footer-feedback"
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          {ui.primaryCta && (
            <CtaButton
              cta={ui.primaryCta}
              primary
              disabled={status === "submitting"}
              onSubmit={onSubmit}
              onReset={onReset}
              onClose={onClose}
            />
          )}
          {ui.secondaryCta && (
            <CtaButton
              cta={ui.secondaryCta}
              onSubmit={onSubmit}
              onReset={onReset}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    );
  }

  // idle: muestra puntos máx + CTA submit
  return (
    <div className="border-t border-light bg-card px-7 py-4 shadow-[0_-4px_12px_rgba(0,16,80,.06)]">
      <div className="mb-3 flex items-center justify-center gap-2 rounded-sm border border-brand-gold/40 bg-brand-gold/10 px-3 py-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          Puntos máx
        </span>
        <span className="font-display text-[20px] font-black leading-none text-brand-gold-dark">
          {puntosMax} pts
        </span>
      </div>
      <button
        type="button"
        onClick={onSubmit}
        disabled={!listo}
        data-testid="combo-submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all duration-150 hover:bg-brand-gold-light hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
      >
        <span aria-hidden>🎯</span>
        {tienePlaceholder ? "Confirmar mi combinada" : "Predecir gratis"}
      </button>
    </div>
  );
}

type AnyCta =
  | NonNullable<ReturnType<typeof computeComboModalUIState>["primaryCta"]>
  | NonNullable<ReturnType<typeof computeComboModalUIState>["secondaryCta"]>;

function CtaButton({
  cta,
  primary,
  disabled,
  onSubmit,
  onReset,
  onClose,
}: {
  cta: AnyCta;
  primary?: boolean;
  disabled?: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const cls = primary
    ? "inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all duration-150 hover:bg-brand-gold-light hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
    : "inline-flex flex-1 items-center justify-center gap-2 rounded-md border-[1.5px] border-strong bg-card px-4 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-body transition-colors hover:border-brand-blue-main hover:text-brand-blue-main";

  const dataAttr = primary ? "combo-primary-cta" : "combo-secondary-cta";

  if (cta.kind === "link" && cta.href) {
    return (
      <Link href={cta.href} className={cls} data-testid={dataAttr}>
        {cta.label}
      </Link>
    );
  }
  const onClick =
    cta.kind === "submit"
      ? onSubmit
      : cta.kind === "retry"
        ? onSubmit
        : cta.kind === "reset"
          ? onReset
          : onClose;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
      data-testid={dataAttr}
    >
      {cta.label}
    </button>
  );
}

function cortoNombre(nombre: string): string {
  const limpio = nombre.trim();
  if (limpio.length <= 10) return limpio;
  return limpio.split(/\s+/)[0] ?? limpio.slice(0, 8);
}
