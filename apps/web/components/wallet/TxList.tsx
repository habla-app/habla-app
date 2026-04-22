"use client";
// Lista de movimientos (mockup `.tx-list .tx-item`). Icono por tipo de
// transacción y color del monto por signo. Fechas relativas si <7d, si no
// formato corto en America/Lima.

import type { TipoTransaccion } from "@habla/db";
import { DEFAULT_TZ } from "@/lib/utils/datetime";
import type { WalletTransaccion } from "@/lib/services/wallet-view.service";
import type { MoveFiltro } from "./MovesFilter";

interface Props {
  transacciones: WalletTransaccion[];
  totalMovimientos: number;
  filtroActivo: MoveFiltro;
}

export function TxList({
  transacciones,
  totalMovimientos,
  filtroActivo,
}: Props) {
  if (transacciones.length === 0) {
    return (
      <div className="rounded-md border border-light bg-card p-8 text-center shadow-sm">
        <div aria-hidden className="mb-2 text-3xl opacity-60">
          📭
        </div>
        <div className="text-sm text-muted-d">
          {filtroActivo === "TODOS"
            ? "Aún no tienes transacciones. Tu bono de bienvenida ya está acreditado."
            : "No hay movimientos para este filtro."}
        </div>
      </div>
    );
  }

  const headingLabel =
    filtroActivo === "TODOS"
      ? `Últimos movimientos · ${totalMovimientos} en total`
      : `${transacciones.length} ${transacciones.length === 1 ? "movimiento" : "movimientos"}`;

  return (
    <ol className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <li className="border-b border-light bg-subtle px-4 py-3.5 font-display text-sm font-extrabold uppercase tracking-[0.04em] text-dark">
        {headingLabel}
      </li>
      {transacciones.map((tx) => (
        <TxItem key={tx.id} tx={tx} />
      ))}
    </ol>
  );
}

function TxItem({ tx }: { tx: WalletTransaccion }) {
  const meta = metaPorTipo(tx.tipo);
  const amountColor =
    tx.tipo === "BONUS"
      ? "text-brand-gold-dark"
      : tx.monto > 0
        ? "text-alert-success-text"
        : "text-accent-clasico-dark/85";
  const sign = tx.monto > 0 ? "+" : "−";
  return (
    <li className="flex items-center gap-3 border-b border-light px-4 py-3.5 last:border-b-0">
      <div
        aria-hidden
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm text-lg ${meta.bg}`}
      >
        {meta.icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-dark">
          {tx.descripcion}
        </div>
        <div className="text-[11px] text-muted-d">
          {formatTxDate(tx.creadoEn)}
        </div>
      </div>
      <div
        className={`flex-shrink-0 font-display text-lg font-black ${amountColor}`}
      >
        {sign}
        {Math.abs(tx.monto).toLocaleString("es-PE")}
      </div>
    </li>
  );
}

function metaPorTipo(tipo: TipoTransaccion): {
  icon: string;
  bg: string;
} {
  switch (tipo) {
    case "COMPRA":
      return { icon: "💳", bg: "bg-alert-success-bg" };
    case "ENTRADA_TORNEO":
      return { icon: "⚽", bg: "bg-pred-wrong-bg" };
    case "PREMIO_TORNEO":
      return { icon: "🏆", bg: "bg-alert-success-bg" };
    case "CANJE":
      return { icon: "🎁", bg: "bg-pred-wrong-bg" };
    case "BONUS":
      return { icon: "⭐", bg: "bg-urgent-med-bg" };
    case "VENCIMIENTO":
      return { icon: "⌛", bg: "bg-subtle" };
    case "REEMBOLSO":
      return { icon: "↩️", bg: "bg-alert-info-bg" };
    default:
      return { icon: "•", bg: "bg-subtle" };
  }
}

const TIME_FMT = new Intl.DateTimeFormat("es-PE", {
  timeZone: DEFAULT_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const DATE_FMT = new Intl.DateTimeFormat("es-PE", {
  timeZone: DEFAULT_TZ,
  day: "numeric",
  month: "short",
});

function formatTxDate(d: Date): string {
  const now = Date.now();
  const ms = now - new Date(d).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  if (ms < oneDay) return `Hoy · ${TIME_FMT.format(new Date(d))}`;
  if (ms < 2 * oneDay) return `Ayer · ${TIME_FMT.format(new Date(d))}`;
  const days = Math.floor(ms / oneDay);
  if (days < 7) return `Hace ${days} días`;
  return DATE_FMT.format(new Date(d));
}
