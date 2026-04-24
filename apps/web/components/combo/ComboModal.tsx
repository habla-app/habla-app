"use client";
// ComboModal — modal centrado donde el usuario arma sus 5 predicciones.
// Sub-Sprint 4. Replica `.combo-panel` / `.combo-panel-head` / `.combo-body`
// / `.combo-foot` del mockup (docs/habla-mockup-completo.html §combo).
//
// Hotfix #2 post-Sub-Sprint 5: la lógica de "Balance después" + decisión
// CTA submit/comprar vive en `computeComboFooterState` (mapper puro),
// para que el modal nunca renderice "-5".
//
// Hotfix #4 post-Sub-Sprint 5 (Bug #6): el modal ahora tiene 6 estados
// discriminados (`ComboModalStatus`) — idle, submitting, success,
// insufficient-balance, tournament-closed, error. Los estados
// distinto de `idle` reemplazan el body con un panel de feedback (icono
// + título + copy + CTAs). El estado `success` muestra los detalles del
// ticket creado (id, predicciones, entrada pagada, puntos máximos).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useLukasStore } from "@/stores/lukas.store";
import { authedFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { PUNTOS } from "@habla/shared";
import { PredCard } from "./PredCard";
import { ScorePicker } from "./ScorePicker";
import { computeComboFooterState } from "./combo-info.mapper";
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
  const [status, setStatus] = useState<ComboModalStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<ComboSuccessInfo | null>(null);
  const [countdown, setCountdown] = useState<string>("--:--");

  const balance = useLukasStore((s) => s.balance);
  const setBalance = useLukasStore((s) => s.setBalance);

  // Reset al abrir
  useEffect(() => {
    if (isOpen) {
      setPreds(PREDICCIONES_INICIAL);
      setStatus("idle");
      setErrorMessage(null);
      setSuccessInfo(null);
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
  const displayBalanceDespues = footer?.displayBalanceDespues ?? 0;
  const balanceInsuficiente = footer?.balanceInsuficiente ?? false;

  const handleSubmit = useCallback(async () => {
    if (!torneo) return;
    if (!listo) {
      setStatus("error");
      setErrorMessage("Completá las 5 predicciones antes de enviar.");
      return;
    }
    // Defensa redundante: el render ya muestra el status `insufficient-balance`
    // cuando faltan Lukas. Si por race se llama igual, no avanzamos.
    if (balanceInsuficiente) {
      setStatus("insufficient-balance");
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
          nuevoBalance: number;
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
      // Éxito: sincroniza balance global y pinta el panel de confirmación.
      setBalance(json.data.nuevoBalance);
      // Analytics. Todas las 5 preds se envían siempre (el UI las fuerza),
      // pero las 4 booleanas pueden estar undefined en el form hasta que el
      // usuario las toque. Contamos las que el form ya había marcado.
      const completadas =
        (preds.predResultado !== undefined ? 1 : 0) +
        (preds.predBtts !== undefined ? 1 : 0) +
        (preds.predMas25 !== undefined ? 1 : 0) +
        (preds.predTarjetaRoja !== undefined ? 1 : 0) +
        1; // marcador exacto siempre tiene valor
      track("ticket_submitted", {
        torneo_id: torneo.torneoId,
        ticket_id: json.data.ticket.id,
        predicciones_completadas: completadas,
      });
      // Si el ticket NO reemplazó un placeholder (placeholder-first-flow),
      // significa que la inscripción ocurrió fresh acá — disparamos el
      // evento de inscripción también, alineado con el que InscribirButton
      // dispara en la otra ruta.
      if (!json.data.reemplazoPlaceholder && !torneo.tienePlaceholder) {
        let esPrimerTicketUsuario = false;
        try {
          const flag = window.localStorage.getItem(
            "habla:first_inscripcion_done",
          );
          if (!flag) {
            esPrimerTicketUsuario = true;
            window.localStorage.setItem(
              "habla:first_inscripcion_done",
              "1",
            );
          }
        } catch {
          /* storage bloqueado */
        }
        track("torneo_inscripto", {
          torneo_id: torneo.torneoId,
          ticket_id: json.data.ticket.id,
          costo_lukas: torneo.entradaLukas,
          es_primer_ticket_usuario: esPrimerTicketUsuario,
        });
      }
      setSuccessInfo({
        ticketId: json.data.ticket.id,
        entradaPagada: json.data.reemplazoPlaceholder ? 0 : torneo.entradaLukas,
        puntosMaximos: puntosMax,
        predResumen: {
          resultado: preds.predResultado!,
          btts: preds.predBtts!,
          mas25: preds.predMas25!,
          tarjetaRoja: preds.predTarjetaRoja!,
          marcadorLocal: preds.predMarcadorLocal,
          marcadorVisita: preds.predMarcadorVisita,
        },
        nuevoBalance: json.data.nuevoBalance,
        reemplazoPlaceholder: json.data.reemplazoPlaceholder,
      });
      setStatus("success");
      onCreated?.({
        ticketId: json.data.ticket.id,
        nuevoBalance: json.data.nuevoBalance,
      });
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message ?? "Error de red.");
    }
  }, [
    torneo,
    listo,
    balanceInsuficiente,
    preds,
    puntosMax,
    setBalance,
    onCreated,
  ]);

  const handleReset = useCallback(() => {
    setPreds(PREDICCIONES_INICIAL);
    setStatus("idle");
    setErrorMessage(null);
    setSuccessInfo(null);
  }, []);

  // Si el balance baja en medio de la sesión a insuficiente, reflejarlo.
  useEffect(() => {
    if (!torneo) return;
    if (status !== "idle") return;
    if (balanceInsuficiente) {
      // No reseteamos el status a insufficient-balance automáticamente
      // para no atrapar al usuario: el CTA del footer ya cambia a
      // "Comprar Lukas". Pero dejamos el gate para que handleSubmit no
      // avance si el balance cambió entre idle y submit.
    }
  }, [balanceInsuficiente, status, torneo]);

  if (!torneo) return null;

  const faltanLukas = Math.max(0, torneo.entradaLukas - balance);
  const ui = computeComboModalUIState({
    status,
    tienePlaceholder: torneo.tienePlaceholder,
    entradaLukas: torneo.entradaLukas,
    errorMessage,
    faltanLukas,
  });

  const isFeedback =
    status === "success" ||
    status === "error" ||
    status === "tournament-closed" ||
    status === "submitting" ||
    (status === "insufficient-balance");

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
        torneo={torneo}
        puntosMax={puntosMax}
        displayBalanceDespues={displayBalanceDespues}
        balanceInsuficiente={balanceInsuficiente}
        balance={balance}
        listo={listo}
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
    {
      key: "roja",
      label: `Roja ${info.predResumen.tarjetaRoja ? "Sí" : "No"}`,
    },
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
        Detalles de tu ticket
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
        <Meta label="Entrada pagada">
          {info.entradaPagada > 0
            ? `${info.entradaPagada.toLocaleString("es-PE")} 🪙`
            : "Ya cobrada antes"}
        </Meta>
        <Meta label="Puntos máx posibles">{info.puntosMaximos} pts</Meta>
        <Meta label="Balance después">
          {info.nuevoBalance.toLocaleString("es-PE")} 🪙
        </Meta>
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
  torneo,
  puntosMax,
  displayBalanceDespues,
  balanceInsuficiente,
  balance,
  listo,
  onSubmit,
  onReset,
  onClose,
}: {
  status: ComboModalStatus;
  ui: ReturnType<typeof computeComboModalUIState>;
  torneo: ComboTorneoInfo;
  puntosMax: number;
  displayBalanceDespues: number;
  balanceInsuficiente: boolean;
  balance: number;
  listo: boolean;
  onSubmit: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  // En estados de feedback (success/error/etc.) mostramos solo los CTAs
  // del ui state, sin el resumen de puntos/balance. El modo `idle`
  // mantiene el layout original del mockup (2 cajas + botón).
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

  // idle: layout normal con resumen + submit/comprar
  return (
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
          onClick={onSubmit}
          disabled={!listo}
          data-testid="combo-submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-4 font-display text-[16px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-cta transition-all duration-150 hover:bg-brand-gold-light hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        >
          <span aria-hidden>🎯</span>
          {torneo.tienePlaceholder
            ? "Confirmar mi combinada"
            : `Inscribir por ${formatoMiles(torneo.entradaLukas)} 🪙`}
        </button>
      )}
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
