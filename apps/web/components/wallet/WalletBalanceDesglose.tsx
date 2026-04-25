"use client";
// WalletBalanceDesglose — Lote 6B. Reemplaza al WalletBalanceHero en /wallet.
// Muestra las 3 bolsas (Comprados, Bonus, Ganados) en bloques individuales con
// sus colores diferenciadores y un banner de vencimiento próximo si aplica.

import { useEffect } from "react";
import Link from "next/link";
import { Alert } from "@/components/ui/Alert";
import { track } from "@/lib/analytics";
import { DEFAULT_TZ } from "@/lib/utils/datetime";
import { MESES_VENCIMIENTO_COMPRA } from "@/lib/config/economia";

interface Totales {
  compradas: number;
  bonus: number;
  ganadas: number;
  total: number;
}

interface ProximoVencimiento {
  monto: number;
  venceEn: Date;
  diasRestantes: number;
}

interface Props {
  totales: Totales;
  proximoVencimiento: ProximoVencimiento | null;
}

const DATE_FMT = new Intl.DateTimeFormat("es-PE", {
  timeZone: DEFAULT_TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function WalletBalanceDesglose({ totales, proximoVencimiento }: Props) {
  useEffect(() => {
    track("wallet_desglose_viewed", {
      compradas: totales.compradas,
      bonus: totales.bonus,
      ganadas: totales.ganadas,
      total: totales.total,
      tiene_vencimiento_proximo: proximoVencimiento !== null,
      dias_para_vencimiento: proximoVencimiento?.diasRestantes ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mb-5">
      {/* 3 bloques de bolsa */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {/* Comprados */}
        <BolsaCard
          emoji="🛒"
          emojiColorClass="text-brand-blue-light"
          emojiBgClass="bg-brand-blue-light/15"
          label="Comprados"
          borderColorClass="border-l-brand-blue-light"
          monto={totales.compradas}
          subtexto={subtextoCompradas(proximoVencimiento)}
          tooltip="Los Lukas que compraste. Sirven para inscribirte en torneos. Vencen a los 36 meses de la compra."
        />
        {/* Bonus */}
        <BolsaCard
          emoji="🎁"
          emojiColorClass="text-brand-gold"
          emojiBgClass="bg-brand-gold/15"
          label="De regalo"
          borderColorClass="border-l-brand-gold"
          monto={totales.bonus}
          subtexto="No vencen"
          tooltip="Lukas de bienvenida o bonus de pack. Sirven para inscribirte en torneos. No vencen nunca."
        />
        {/* Ganados */}
        <BolsaCard
          emoji="🏆"
          emojiColorClass="text-brand-green"
          emojiBgClass="bg-brand-green/15"
          label="Ganados"
          borderColorClass="border-l-brand-green"
          monto={totales.ganadas}
          subtexto="Canjeables en la tienda"
          tooltip="Los Lukas que ganaste compitiendo. Sirven para inscribirte Y para canjear premios en la tienda. No vencen."
        />
      </div>

      {/* Total bajo los bloques */}
      <div className="mt-3 text-right text-[13px] text-white/50">
        Total disponible:{" "}
        <span className="font-semibold text-white/70">
          {totales.total.toLocaleString("es-PE")} Lukas
        </span>
      </div>

      {/* Banner de vencimiento próximo */}
      {proximoVencimiento !== null &&
      proximoVencimiento.diasRestantes <= 60 ? (
        <div className="mt-4">
          {proximoVencimiento.diasRestantes <= 7 ? (
            <Alert variant="error">
              <span>
                <strong>
                  ¡Vencen en {proximoVencimiento.diasRestantes} día
                  {proximoVencimiento.diasRestantes !== 1 ? "s" : ""}!
                </strong>{" "}
                Tienes {proximoVencimiento.monto.toLocaleString("es-PE")} Lukas
                Comprados por vencer.{" "}
                <Link href="/matches" className="underline font-semibold">
                  Ver partidos →
                </Link>
              </span>
            </Alert>
          ) : (
            <Alert variant="warning">
              <span>
                Tienes{" "}
                <strong>
                  {proximoVencimiento.monto.toLocaleString("es-PE")} Lukas
                </strong>{" "}
                que vencen el{" "}
                <strong>
                  {DATE_FMT.format(new Date(proximoVencimiento.venceEn))}
                </strong>
                . No los pierdas — úsalos en tu próximo torneo.{" "}
                <Link href="/matches" className="underline font-semibold">
                  Ver partidos →
                </Link>
              </span>
            </Alert>
          )}
        </div>
      ) : null}
    </div>
  );
}

function subtextoCompradas(pv: ProximoVencimiento | null): string {
  if (!pv) return `Vencen a los ${MESES_VENCIMIENTO_COMPRA} meses`;
  if (pv.diasRestantes <= 60) {
    const ddmm = new Intl.DateTimeFormat("es-PE", {
      timeZone: DEFAULT_TZ,
      day: "2-digit",
      month: "2-digit",
    }).format(new Date(pv.venceEn));
    return `Vencen el ${ddmm}`;
  }
  const meses = Math.ceil(pv.diasRestantes / 30);
  return `Vencen en ${meses} meses`;
}

interface BolsaCardProps {
  emoji: string;
  emojiColorClass: string;
  emojiBgClass: string;
  label: string;
  borderColorClass: string;
  monto: number;
  subtexto: string;
  tooltip: string;
}

function BolsaCard({
  emoji,
  emojiColorClass,
  emojiBgClass,
  label,
  borderColorClass,
  monto,
  subtexto,
  tooltip,
}: BolsaCardProps) {
  return (
    <div
      className={`rounded-xl bg-dark-card p-4 border-l-[3px] ${borderColorClass}`}
    >
      {/* Header: ícono + label + tooltip */}
      <div className="mb-2 flex items-center gap-2">
        <span
          aria-hidden
          className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[14px] ${emojiBgClass} ${emojiColorClass}`}
        >
          {emoji}
        </span>
        <span className="text-[12px] font-medium text-white/70">{label}</span>
        <button
          type="button"
          title={tooltip}
          aria-label={tooltip}
          className="ml-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/50 hover:bg-white/20 hover:text-white/70 transition-colors"
        >
          ?
        </button>
      </div>
      {/* Monto */}
      <div className="font-display text-[32px] font-black leading-none text-white">
        {monto.toLocaleString("es-PE")}
      </div>
      {/* Subtexto */}
      <div className="mt-1 text-[12px] text-white/70">{subtexto}</div>
    </div>
  );
}
