"use client";
// Orquestador client de /wallet. Recibe transacciones iniciales (SSR) y
// gestiona los chips de filtro localmente (sin roundtrip). El balance en el
// hero se hidrata via store.

import { useMemo, useState } from "react";
import { WalletBalanceDesglose } from "./WalletBalanceDesglose";
import { WalletStats } from "./WalletStats";
import { BuyPacksPlaceholder } from "./BuyPacksPlaceholder";
import { MovesFilter, type MoveFiltro } from "./MovesFilter";
import { TxList } from "./TxList";
import { MESES_VENCIMIENTO_COMPRA } from "@/lib/config/economia";
import type {
  WalletDesglose,
  WalletTotales,
  WalletTransaccion,
  WalletProxVencimiento,
} from "@/lib/services/wallet-view.service";

interface Props {
  initialBalance: number;
  desglose: WalletDesglose;
  totales: WalletTotales;
  proxVencimiento: WalletProxVencimiento | null;
  transacciones: WalletTransaccion[];
  totalMovimientos: number;
}

export function WalletView({
  initialBalance: _initialBalance,
  desglose,
  totales,
  proxVencimiento,
  transacciones,
  totalMovimientos,
}: Props) {
  const [filtro, setFiltro] = useState<MoveFiltro>("TODOS");
  const filtradas = useMemo(
    () => filtrarTx(transacciones, filtro),
    [transacciones, filtro],
  );

  const proximoVencimiento = proxVencimiento
    ? {
        monto: proxVencimiento.lukas,
        venceEn: new Date(proxVencimiento.fecha),
        diasRestantes: Math.ceil(
          (new Date(proxVencimiento.fecha).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        ),
      }
    : null;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          💰 Billetera
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Compra Lukas, revisa tus movimientos y gestiona tus créditos
        </p>
      </header>

      <WalletBalanceDesglose
        totales={desglose}
        proximoVencimiento={proximoVencimiento}
      />

      <WalletStats
        comprado={totales.comprado}
        ganado={totales.ganado}
        canjeado={totales.canjeado}
      />

      <BuyPacksPlaceholder />

      <div className="mb-6 flex items-start gap-2.5 rounded-sm border border-light bg-subtle px-4 py-3 text-xs leading-relaxed text-muted-d">
        <span aria-hidden className="flex-shrink-0 text-base opacity-70">
          ℹ️
        </span>
        <p>
          <strong className="text-dark">Sobre los Lukas.</strong> Son créditos
          de entretenimiento canjeables por premios reales en la Tienda.{" "}
          <strong className="text-dark">
            No son convertibles a dinero en efectivo
          </strong>
          . Los Lukas comprados vencen {MESES_VENCIMIENTO_COMPRA} meses después
          de la compra. Los ganados en torneos no vencen.
        </p>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5 font-display text-[22px] font-black uppercase tracking-[0.02em] text-dark">
          <span aria-hidden>📊</span> Tu historial
        </h2>
      </div>

      <MovesFilter value={filtro} onChange={setFiltro} />

      <TxList
        transacciones={filtradas}
        totalMovimientos={totalMovimientos}
        filtroActivo={filtro}
      />
    </div>
  );
}

function filtrarTx(
  txs: WalletTransaccion[],
  filtro: MoveFiltro,
): WalletTransaccion[] {
  if (filtro === "TODOS") return txs;
  if (filtro === "COMPRAS") return txs.filter((t) => t.tipo === "COMPRA");
  if (filtro === "INSCRIPCIONES")
    return txs.filter((t) => t.tipo === "ENTRADA_TORNEO");
  if (filtro === "PREMIOS") return txs.filter((t) => t.tipo === "PREMIO_TORNEO");
  if (filtro === "CANJES") return txs.filter((t) => t.tipo === "CANJE");
  if (filtro === "BONOS") return txs.filter((t) => t.tipo === "BONUS");
  return txs;
}
