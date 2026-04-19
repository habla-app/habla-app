"use client";
// PredCard — una de las 5 cards de predicción en el ComboModal.
// Replica `.pred-card` del mockup (docs/habla-mockup-completo.html §combo).
//
// Genérica: recibe las options y un valor seleccionado. Las opciones
// binarias Sí/No aplican el estilo azul para el "No" (mockup usa
// `.sel-no` con `--blue-main`), las multi-option usan dorado para
// todas las opciones seleccionadas.

import type { ReactNode } from "react";

export interface PredOptionDef<T extends string | boolean> {
  label: string;
  value: T;
  /** Aplica estilo sel-no (azul) si seleccionado; sino dorado. */
  isNegative?: boolean;
}

interface PredCardProps<T extends string | boolean> {
  question: string;
  points: number;
  selected: T | undefined;
  onSelect: (value: T) => void;
  options: Array<PredOptionDef<T>>;
  /** Override del body (ej. ScorePicker). Si está presente, `options`
   *  y el handler de click se ignoran. */
  children?: ReactNode;
}

export function PredCard<T extends string | boolean>({
  question,
  points,
  selected,
  onSelect,
  options,
  children,
}: PredCardProps<T>) {
  const done = children ? true : selected !== undefined;

  return (
    <div
      className={`mb-2.5 rounded-md border-[1.5px] p-4 shadow-sm transition-all duration-150 ${
        done
          ? "border-brand-gold bg-gradient-to-br from-white to-[#FFFDF5]"
          : "border-light bg-card"
      }`}
    >
      <div className="mb-2.5 flex items-center justify-between gap-2.5">
        <div className="text-[14px] font-semibold text-dark">{question}</div>
        <span className="flex-shrink-0 rounded-full border border-brand-gold/30 bg-brand-gold-dim px-2.5 py-0.5 font-display text-[12px] font-extrabold text-brand-gold-dark">
          {points} pts
        </span>
      </div>
      {children ? (
        children
      ) : (
        <div className="flex gap-1.5">
          {options.map((opt) => {
            const isSelected = selected === opt.value;
            const base =
              "flex-1 rounded-sm border-[1.5px] px-1.5 py-2.5 text-[13px] font-semibold transition-all duration-150";
            const unselected =
              "border-light bg-card text-muted-d hover:border-brand-gold hover:text-brand-gold-dark";
            const selGold =
              "border-brand-gold bg-brand-gold font-bold text-black";
            const selBlue =
              "border-brand-blue-main bg-brand-blue-main text-white";
            return (
              <button
                type="button"
                key={String(opt.value)}
                onClick={() => onSelect(opt.value)}
                className={`${base} ${
                  isSelected
                    ? opt.isNegative
                      ? selBlue
                      : selGold
                    : unselected
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
