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
      <div className="grid grid-cols-3 gap-3">
        {/* Comprados */}
        <BolsaCard
          emoji="💳"
          iconBgClass="bg-alert-info-bg"
          iconBorderClass="border border-alert-info-border"
          label="Comprados"
          borderColorClass="border-l-brand-blue-light"
          valueColorClass="text-brand-blue-light"
          monto={totales.compradas}
          subtexto={subtextoCompradas(proximoVencimiento)}
          tooltip="Los Lukas que compraste. Sirven para inscribirte en torneos. Vencen a los 36 meses de la compra."
        />
        {/* Bonus */}
        <BolsaCard
          emoji="⭐"
          iconBgClass="bg-brand-gold-dim"
          iconBorderClass="border border-brand-gold/30"
          label="Bonus"
          borderColorClass="border-l-brand-gold"
          valueColorClass="text-brand-gold-dark"
          monto={totales.bonus}
          subtexto="No vencen"
          tooltip="Lukas de bienvenida o bonus de pack. Sirven para inscribirte en torneos. No vencen nunca."
        />
        {/* Ganados */}
        <BolsaCard
          emoji="🏆"
          iconBgClass="bg-alert-success-bg"
          iconBorderClass="border border-pred-correct/30"
          label="Ganados"
          borderColorClass="border-l-brand-green"
          valueColorClass="text-alert-success-text"
          monto={totales.ganadas}
          subtexto="Canjeables en tienda"
          tooltip="Los Lukas que ganaste compitiendo. Sirven para inscribirte Y para canjear premios en la tienda. No vencen."
        />
      </div>

      {/* Total bajo los bloques */}
      <div className="mt-3 text-right text-[13px] text-muted-d">
        Total disponible:{" "}
        <span className="font-semibold text-dark">
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
  iconBgClass: string;
  iconBorderClass: string;
  label: string;
  borderColorClass: string;
  valueColorClass: string;
  monto: number;
  subtexto: string;
  tooltip: string;
}

function BolsaCard({
  emoji,
  iconBgClass,
  iconBorderClass,
  label,
  borderColorClass,
  valueColorClass,
  monto,
  subtexto,
  tooltip,
}: BolsaCardProps) {
  return (
    <div
      title={tooltip}
      className={`flex items-center gap-3 rounded-md border border-light bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md border-l-[3px] ${borderColorClass}`}
    >
      <div
        aria-hidden
        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-sm text-[22px] ${iconBgClass} ${iconBorderClass}`}
      >
        {emoji}
      </div>
      <div className="min-w-0">
        <div className={`font-display text-[22px] font-black leading-none ${valueColorClass}`}>
          {monto.toLocaleString("es-PE")}
        </div>
        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
          {label}
        </div>
        <div className="mt-0.5 text-[10px] text-muted-d">{subtexto}</div>
      </div>
    </div>
  );
}
