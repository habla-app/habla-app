"use client";
// FeaturedPrize — hero card "premio destacado" del mockup:
// superficie dark estadio + shimmer dorado superior + grid 2 cols
// (imagen dorada con emoji gigante + body con badge, nombre, precio,
// stock pill, CTA dorado).
//
// Click CTA abre CanjearModal (portal). Edge cases: agotado → CTA
// deshabilitado; no afordable → mensaje de "te faltan X".

import { useState } from "react";
import type { PremioDTO } from "@/lib/services/premios.service";
import { CanjearModal } from "./CanjearModal";
import { ModalSinGanadas } from "./ModalSinGanadas";

interface FeaturedPrizeProps {
  premio: PremioDTO;
  balanceActual: number;
  balanceGanadas: number;
  onCanjeado?: (costeLukas: number) => void;
}

export function FeaturedPrize({ premio, balanceActual, balanceGanadas, onCanjeado }: FeaturedPrizeProps) {
  const [open, setOpen] = useState(false);
  const [sinGanadasOpen, setSinGanadasOpen] = useState(false);
  const afordable = balanceGanadas >= premio.costeLukas;
  const agotado = premio.stock <= 0;
  const faltan = Math.max(0, premio.costeLukas - balanceGanadas);

  return (
    <>
      <section className="relative mb-7 grid overflow-hidden rounded-lg bg-gradient-to-br from-dark-surface to-[#000530] text-white shadow-lg md:grid-cols-2">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-gold-shimmer bg-[length:200%_100%] animate-shimmer"
        />
        <div className="flex min-h-[250px] items-center justify-center bg-gradient-to-br from-[#FFF8E5] to-[#FFD060] text-[110px] leading-none">
          <span aria-hidden>{premio.imagen ?? "🎁"}</span>
        </div>

        <div className="flex flex-col justify-center p-7 md:p-8">
          <span className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-gold px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.06em] text-black">
            🔥 Premio destacado
          </span>
          <h3 className="font-display text-[30px] font-black uppercase leading-[1.1] text-white">
            {premio.nombre}
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/75">
            {premio.descripcion}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="font-display text-[34px] font-black leading-none text-brand-gold">
              {premio.costeLukas.toLocaleString("es-PE")}{" "}
              <span aria-hidden className="text-[0.65em]">
                🪙
              </span>
            </div>
            {premio.stock > 0 && premio.stock <= 12 ? (
              <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-white/60">
                ⚠ Solo {premio.stock} disponibles
              </span>
            ) : null}
          </div>

          <div className="mt-4">
            {agotado ? (
              <button
                type="button"
                disabled
                className="w-full max-w-[260px] cursor-not-allowed rounded-sm bg-white/10 px-5 py-3 text-sm font-bold text-white/50 md:w-auto"
              >
                Agotado
              </button>
            ) : afordable ? (
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 self-start rounded-sm bg-brand-gold px-5 py-3 font-display text-sm font-extrabold uppercase tracking-[0.04em] text-black shadow-gold transition hover:-translate-y-0.5 hover:bg-brand-gold-light"
                data-testid={`canjear-btn-${premio.id}`}
              >
                Canjear ahora →
              </button>
            ) : (
              <div className="inline-flex items-center rounded-sm border border-white/20 px-5 py-3 text-[13px] text-white/80">
                Te faltan {faltan.toLocaleString("es-PE")} 🪙
              </div>
            )}
          </div>
        </div>
      </section>

      {open ? (
        <CanjearModal
          premio={premio}
          balanceActual={balanceActual}
          onClose={() => setOpen(false)}
          onSuccess={() => {
            setOpen(false);
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
