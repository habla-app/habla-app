// PrizeCardV2 — card de premio en /tienda.
//
// Estados visuales:
//  - Afordable + con stock → borde verde, CTA dorado "Canjear ahora".
//  - No afordable → progress bar dorada al X%, label "Te faltan Y 🪙".
//  - Agotado → badge rojo "Agotado", CTA deshabilitado.
//
// Badges: POPULAR (rosa), NUEVO (azul), LIMITADO (dorado).
"use client";

import { useState } from "react";
import type { PremioDTO } from "@/lib/services/premios.service";
import { CanjearModal } from "./CanjearModal";

interface PrizeCardV2Props {
  premio: PremioDTO;
  balanceActual: number;
  onCanjeSuccess?: () => void;
}

const BADGE_STYLES: Record<
  NonNullable<PremioDTO["badge"]>,
  { bg: string; text: string; label: string }
> = {
  POPULAR: { bg: "bg-brand-orange", text: "text-white", label: "🔥 Popular" },
  NUEVO: { bg: "bg-brand-blue-light", text: "text-white", label: "⭐ Nuevo" },
  LIMITADO: { bg: "bg-brand-gold", text: "text-dark", label: "💎 Limitado" },
};

export function PrizeCardV2({ premio, balanceActual, onCanjeSuccess }: PrizeCardV2Props) {
  const [open, setOpen] = useState(false);

  const afordable = balanceActual >= premio.costeLukas;
  const agotado = premio.stock <= 0;
  const faltan = Math.max(0, premio.costeLukas - balanceActual);
  const progreso = Math.min(100, Math.round((balanceActual / premio.costeLukas) * 100));

  const borderCls = agotado
    ? "border-2 border-border-light"
    : afordable
      ? "border-2 border-brand-green"
      : "border border-border-light";

  return (
    <>
      <article
        className={`group flex flex-col rounded-lg bg-card ${borderCls} overflow-hidden shadow-sm transition-all hover:shadow-md`}
        data-testid={`prize-card-${premio.id}`}
      >
        <div className="relative aspect-[4/3] flex items-center justify-center bg-subtle text-6xl">
          {premio.imagen ?? "🎁"}
          {premio.badge && (
            <span
              className={`absolute top-3 right-3 rounded-full px-3 py-1 text-[11px] font-bold ${BADGE_STYLES[premio.badge].bg} ${BADGE_STYLES[premio.badge].text}`}
            >
              {BADGE_STYLES[premio.badge].label}
            </span>
          )}
          {agotado && (
            <span className="absolute top-3 left-3 rounded-full bg-urgent-critical px-3 py-1 text-[11px] font-bold text-white">
              Agotado
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="font-display text-[17px] font-bold text-dark">
            {premio.nombre}
          </h3>
          <p className="mt-1 text-[13px] leading-snug text-body line-clamp-2">
            {premio.descripcion}
          </p>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-[24px] font-extrabold text-brand-gold-dark">
              {premio.costeLukas}
            </span>
            <span className="text-base">🪙</span>
          </div>

          {premio.stock > 0 && premio.stock <= 10 && (
            <div className="mt-1 text-[11px] text-urgent-critical">
              Quedan {premio.stock}
            </div>
          )}

          <div className="mt-auto pt-4">
            {agotado ? (
              <button
                type="button"
                disabled
                className="w-full rounded-md bg-subtle px-4 py-2.5 text-[14px] font-bold text-soft"
              >
                Agotado
              </button>
            ) : afordable ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full rounded-md bg-brand-gold px-4 py-2.5 text-[14px] font-bold text-dark shadow-gold-btn transition-colors hover:bg-brand-gold-light"
                data-testid={`canjear-btn-${premio.id}`}
              >
                ✓ Canjear ahora
              </button>
            ) : (
              <div>
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full bg-brand-gold transition-all"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <div className="text-[12px] text-muted-d">
                  Te faltan <strong className="text-brand-gold-dark">{faltan} 🪙</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>

      {open && (
        <CanjearModal
          premio={premio}
          balanceActual={balanceActual}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            onCanjeSuccess?.();
          }}
        />
      )}
    </>
  );
}
