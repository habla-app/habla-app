// MarketRow — fila de mercado del PrediccionForm (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// Reusable por mercado: label + chip de puntos + opciones grandes. Variantes:
// - triple: 1 / X / 2 (resultado 1X2)
// - binary: Sí / No (BTTS, +2.5 goles, tarjeta roja)
// - input:  marcador exacto (dos inputs numéricos)
//
// El estado de selección lo controla el caller; este componente es puro.

"use client";

import { cn } from "@/lib/utils/cn";

interface OptionDef<T extends string | boolean | number> {
  value: T;
  label: string;
}

type MarketRowProps =
  | {
      label: string;
      pts: number;
      variant: "triple";
      value: "LOCAL" | "EMPATE" | "VISITA";
      onChange: (value: "LOCAL" | "EMPATE" | "VISITA") => void;
      options: ReadonlyArray<OptionDef<"LOCAL" | "EMPATE" | "VISITA">>;
      disabled?: boolean;
      resultadoChip?: ResultadoChip;
    }
  | {
      label: string;
      pts: number;
      variant: "binary";
      value: boolean;
      onChange: (value: boolean) => void;
      options: ReadonlyArray<OptionDef<boolean>>;
      disabled?: boolean;
      resultadoChip?: ResultadoChip;
    }
  | {
      label: string;
      pts: number;
      variant: "input";
      local: number;
      visita: number;
      onChange: (local: number, visita: number) => void;
      disabled?: boolean;
      resultadoChip?: ResultadoChip;
    };

export type ResultadoChip = "correct" | "wrong" | "pending" | null;

export function MarketRow(props: MarketRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
          {props.label}
        </span>
        <span className="flex items-center gap-1.5">
          {props.resultadoChip && <ResultChip estado={props.resultadoChip} />}
          <span className="rounded-sm bg-brand-gold-dim px-1.5 py-0.5 text-label-sm font-bold text-brand-gold-dark">
            {props.pts} pts
          </span>
        </span>
      </div>

      {props.variant === "triple" && (
        <div className="grid grid-cols-3 gap-1.5">
          {props.options.map((opt) => (
            <OptionButton
              key={String(opt.value)}
              label={opt.label}
              selected={props.value === opt.value}
              disabled={props.disabled}
              onClick={() => props.onChange(opt.value)}
            />
          ))}
        </div>
      )}

      {props.variant === "binary" && (
        <div className="grid grid-cols-2 gap-1.5">
          {props.options.map((opt) => (
            <OptionButton
              key={String(opt.value)}
              label={opt.label}
              selected={props.value === opt.value}
              disabled={props.disabled}
              onClick={() => props.onChange(opt.value)}
            />
          ))}
        </div>
      )}

      {props.variant === "input" && (
        <div className="flex items-center justify-center gap-2">
          <ScoreInput
            value={props.local}
            disabled={props.disabled}
            onChange={(v) => props.onChange(v, props.visita)}
            ariaLabel="Goles del local"
          />
          <span aria-hidden className="text-display-xs font-bold text-muted-d">
            -
          </span>
          <ScoreInput
            value={props.visita}
            disabled={props.disabled}
            onChange={(v) => props.onChange(props.local, v)}
            ariaLabel="Goles del visitante"
          />
        </div>
      )}
    </div>
  );
}

function OptionButton({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "touch-target flex h-12 items-center justify-center rounded-md border px-2 font-display text-display-xs font-bold transition-all",
        selected
          ? "border-brand-blue-dark bg-brand-blue-main text-white shadow-sm"
          : "border-transparent bg-subtle text-dark hover:bg-hover",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {label}
    </button>
  );
}

function ScoreInput({
  value,
  disabled,
  onChange,
  ariaLabel,
}: {
  value: number;
  disabled?: boolean;
  onChange: (n: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      step={1}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(Math.max(0, Math.min(20, Math.floor(n))));
      }}
      className={cn(
        "h-14 w-16 rounded-md border-[1.5px] border-light bg-subtle text-center font-display text-display-md font-extrabold text-dark outline-none",
        "focus:border-brand-blue-main focus:bg-card",
        disabled && "cursor-not-allowed opacity-50",
      )}
    />
  );
}

function ResultChip({ estado }: { estado: Exclude<ResultadoChip, null> }) {
  if (estado === "correct") {
    return (
      <span className="inline-flex h-5 items-center gap-0.5 rounded-full bg-alert-success-bg px-1.5 text-label-sm font-bold text-alert-success-text">
        ✓
      </span>
    );
  }
  if (estado === "wrong") {
    return (
      <span className="inline-flex h-5 items-center gap-0.5 rounded-full bg-alert-danger-bg px-1.5 text-label-sm font-bold text-alert-danger-text">
        ✗
      </span>
    );
  }
  return (
    <span className="inline-flex h-5 items-center gap-0.5 rounded-full bg-alert-warning-bg px-1.5 text-label-sm font-bold text-alert-warning-text">
      ⏳
    </span>
  );
}
