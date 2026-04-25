"use client";
// PrizeCardV2 — card de premio (mockup `.prize-card-v2`).
//
// Estados visuales:
//   - Afordable + con stock → borde verde, strip top verde, CTA dorado.
//   - No afordable → progress bar "Te faltan X 🪙".
//   - Agotado → badge rojo "Agotado", CTA deshabilitado.
//
// Badges: POPULAR (🔥 orange), NUEVO (⭐ green), LIMITADO (💎 red pulsante).
// Imagen: fondo pastel por categoría (tech=azul, clothing=verde,
// entertainment=rosa, giftcard=púrpura, default=dorado claro).

import { useState } from "react";
import type { PremioDTO } from "@/lib/services/premios.service";
import { CanjearModal } from "./CanjearModal";
import { ModalSinGanadas } from "./ModalSinGanadas";

interface PrizeCardV2Props {
  premio: PremioDTO;
  balanceActual: number;
  balanceGanadas: number;
  onCanjeSuccess?: () => void;
  onCanjeado?: (costeLukas: number) => void;
}

const BADGE_STYLES: Record<
  NonNullable<PremioDTO["badge"]>,
  { cls: string; label: string }
> = {
  POPULAR: { cls: "bg-urgent-high text-white", label: "🔥 Popular" },
  NUEVO: { cls: "bg-brand-green text-black", label: "⭐ Nuevo" },
  LIMITADO: {
    cls: "bg-urgent-critical text-white animate-pulse",
    label: "💎 Limitada",
  },
};

function imagenBg(categoria: PremioDTO["categoria"]): string {
  switch (categoria) {
    case "TECH":
      return "bg-gradient-to-br from-[#E0E7FF] to-[#C7D2FE]";
    case "CAMISETA":
      return "bg-gradient-to-br from-[#D1FAE5] to-[#6EE7B7]";
    case "ENTRADA":
    case "EXPERIENCIA":
      return "bg-gradient-to-br from-[#FCE7F3] to-[#F9A8D4]";
    case "GIFT":
      return "bg-gradient-to-br from-[#DDD6FE] to-[#A78BFA]";
    default:
      return "bg-gradient-to-br from-[#FFF8E5] to-[#FFE9A3]";
  }
}

export function PrizeCardV2({
  premio,
  balanceActual,
  balanceGanadas,
  onCanjeSuccess,
  onCanjeado,
}: PrizeCardV2Props) {
  const [open, setOpen] = useState(false);
  const [sinGanadasOpen, setSinGanadasOpen] = useState(false);

  // Affordability usa balanceGanadas: solo los Lukas ganados son canjeables.
  const afordable = balanceGanadas >= premio.costeLukas;
  const agotado = premio.stock <= 0;
  const faltan = Math.max(0, premio.costeLukas - balanceGanadas);
  const progreso = Math.min(
    100,
    Math.round((balanceGanadas / premio.costeLukas) * 100),
  );

  const cardCls = afordable
    ? "relative flex flex-col overflow-hidden rounded-md border border-pred-correct/30 bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-lg"
    : "relative flex flex-col overflow-hidden rounded-md border border-light bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-brand-gold hover:shadow-lg";

  return (
    <>
      <article className={cardCls} data-testid={`prize-card-${premio.id}`}>
        {afordable ? (
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 z-[1] h-[3px] bg-brand-green"
          />
        ) : null}

        {premio.badge ? (
          <span
            className={`absolute right-2.5 top-2.5 z-[2] rounded-full px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] ${BADGE_STYLES[premio.badge].cls}`}
          >
            {BADGE_STYLES[premio.badge].label}
          </span>
        ) : null}

        {agotado ? (
          <span className="absolute left-2.5 top-2.5 z-[2] rounded-full bg-urgent-critical px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.04em] text-white">
            Agotado
          </span>
        ) : null}

        <div
          className={`flex h-[130px] items-center justify-center text-[56px] leading-none ${imagenBg(premio.categoria)}`}
        >
          <span aria-hidden>{premio.imagen ?? "🎁"}</span>
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
          <h3 className="text-[13px] font-bold leading-snug text-dark">
            {premio.nombre}
          </h3>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.4] text-muted-d">
            {premio.descripcion}
          </p>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <div className="font-display text-[22px] font-black leading-none text-brand-gold-dark">
              {premio.costeLukas.toLocaleString("es-PE")}{" "}
              <span aria-hidden className="text-[0.65em]">
                🪙
              </span>
            </div>
            <div
              className={`text-[10px] font-semibold uppercase tracking-[0.05em] ${
                premio.stock > 0 && premio.stock <= 10
                  ? "font-bold text-urgent-critical"
                  : "text-muted-d"
              }`}
            >
              {premio.stock > 0 && premio.stock <= 10
                ? `⚠ Stock: ${premio.stock}`
                : `Stock: ${premio.stock}`}
            </div>
          </div>

          <div className="mt-auto pt-2.5">
            {agotado ? (
              <button
                type="button"
                disabled
                className="w-full rounded-sm bg-subtle px-3 py-2.5 text-xs font-bold text-soft"
              >
                Agotado
              </button>
            ) : afordable ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex w-full items-center justify-center gap-1 rounded-sm bg-brand-gold px-3 py-2.5 text-xs font-bold text-black shadow-gold-btn transition hover:bg-brand-gold-light"
                data-testid={`canjear-btn-${premio.id}`}
              >
                ✓ Canjear ahora
              </button>
            ) : (
              <div>
                <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full bg-gold-shimmer bg-[length:200%_100%] transition-all"
                    style={{ width: `${progreso}%` }}
                  />
                </div>
                <div className="text-center text-[11px] font-semibold text-muted-d">
                  Te faltan{" "}
                  <strong className="text-dark">
                    {faltan.toLocaleString("es-PE")} 🪙
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>

      {open ? (
        <CanjearModal
          premio={premio}
          balanceActual={balanceActual}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
            onCanjeSuccess?.();
            onCanjeado?.(premio.costeLukas);
          }}
          onBalanceInsuficiente={() => {
            setOpen(false);
            setSinGanadasOpen(true);
          }}
        />
      ) : null}

      {sinGanadasOpen ? (
        <ModalSinGanadas
          open={sinGanadasOpen}
          onClose={() => setSinGanadasOpen(false)}
          ganadas={balanceGanadas}
          coste={premio.costeLukas}
        />
      ) : null}
    </>
  );
}
