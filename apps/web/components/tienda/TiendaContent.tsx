"use client";
// TiendaContent — orquesta /tienda (Sub-Sprint 6).
// Lote 6B: stats muestra balance Ganados (canjeables) en lugar del total.
// Lote 6C: elimina los 3 cuadros de stats (Canjeables/Disp. ahora/Ya canjeados).
// Muestra solo el balance de Lukas Premios con label "Disponibles para canjear".
// Nuevo mensaje descriptivo enfatiza que son Lukas Premios las que funcionan acá.

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import type { PremioDTO } from "@/lib/services/premios.service";
import { useLukasStore } from "@/stores/lukas.store";
import { CatFilters } from "./CatFilters";
import { PrizeCardV2 } from "./PrizeCardV2";
import { FeaturedPrize } from "./FeaturedPrize";

interface TiendaContentProps {
  premios: PremioDTO[];
  featured: PremioDTO | null;
  categoriaActiva:
    | "ENTRADA"
    | "CAMISETA"
    | "GIFT"
    | "TECH"
    | "EXPERIENCIA"
    | null;
  initialBalance: number | null;
  initialBalanceGanadas: number;
  totalCanjeados: number;
  isLoggedIn: boolean;
}

export function TiendaContent({
  premios,
  featured,
  categoriaActiva,
  initialBalance,
  initialBalanceGanadas,
  totalCanjeados,
  isLoggedIn,
}: TiendaContentProps) {
  const balanceStore = useLukasStore((s) => s.balance);
  const balance = balanceStore || initialBalance || 0;

  // ganadas: solo los Lukas que pueden canjearse en /tienda.
  // Se actualiza optimistamente tras cada canje exitoso.
  const [ganadas, setGanadas] = useState(initialBalanceGanadas);

  const handleCanjeado = useCallback((costeLukas: number) => {
    setGanadas((prev) => Math.max(0, prev - costeLukas));
  }, []);

  const grid = useMemo(
    () => premios.filter((p) => !p.featured || p.id !== featured?.id),
    [premios, featured],
  );

  return (
    <div className="mx-auto max-w-[960px] px-4 py-6 md:py-10">
      <header className="mb-5">
        <h1 className="font-display text-[40px] font-black uppercase leading-none tracking-[0.01em] text-dark">
          🎁 Tienda de premios
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-d">
          Canjea tus Lukas por experiencias y productos reales
        </p>
      </header>

      {/* Card combinado — balance de Lukas Premios + explicación.
          Lote 6C-fix8: junta los 2 mensajes anteriores en un solo recuadro
          con divider sutil interno (mismo patrón visual que wallet hero).
          Layout: izq (balance gigante con ícono circular verde) → divider
          → der (mini-explainer "ganadas vs otras"). Mobile: stack vertical
          con divider horizontal. Sin agrandar respecto a la suma de los 2
          cards anteriores. */}
      <section
        className="mb-6 overflow-hidden rounded-md border border-brand-gold/30 bg-gradient-to-br from-alert-success-bg via-card to-card shadow-sm"
        data-testid="tienda-premios-card"
      >
        <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
          {isLoggedIn ? (
            <>
              {/* Lado izq — balance */}
              <div className="flex items-center gap-3 sm:flex-shrink-0">
                <div
                  aria-hidden
                  className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand-green/40 bg-card text-[24px] shadow-sm"
                >
                  🏆
                </div>
                <div className="min-w-0">
                  <div className="font-display text-[28px] font-black leading-none text-alert-success-text">
                    {ganadas.toLocaleString("es-PE")} 🪙
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
                    Lukas Premios · Para canjear
                  </div>
                </div>
              </div>

              {/* Divider sutil — vertical en desktop, horizontal en mobile */}
              <div
                aria-hidden
                className="h-px w-full flex-shrink-0 bg-light sm:h-12 sm:w-px"
              />
            </>
          ) : null}

          {/* Lado der (o fila completa si anónimo) — explicación */}
          <div className="flex items-start gap-2 text-[12px] leading-relaxed text-body sm:flex-1">
            <span aria-hidden className="flex-shrink-0 text-base">
              💡
            </span>
            <p>
              Solo las{" "}
              <strong className="text-alert-success-text">Lukas Premios</strong>
              {" "}(ganadas en torneos) sirven para canjear acá. Las{" "}
              <strong className="text-brand-gold-dark">otras Lukas</strong> son
              para inscribirte en torneos.
            </p>
          </div>
        </div>
      </section>

      {featured ? (
        <FeaturedPrize
          premio={featured}
          balanceActual={balance}
          balanceGanadas={ganadas}
          onCanjeado={handleCanjeado}
        />
      ) : null}

      <h2 className="mb-3.5 flex items-center gap-2.5 font-display text-[22px] font-black uppercase tracking-[0.02em] text-dark">
        <span aria-hidden>🛍️</span> Todos los premios
      </h2>

      <CatFilters activa={categoriaActiva} />

      {grid.length === 0 ? (
        <div className="mb-8 rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
          <div aria-hidden className="text-5xl">
            🎁
          </div>
          <h3 className="mt-4 font-display text-xl font-extrabold uppercase tracking-wide text-dark">
            No hay premios en esta categoría
          </h3>
          <p className="mt-2 text-sm text-muted-d">
            Probá con otra categoría — estamos sumando premios nuevos cada
            semana.
          </p>
        </div>
      ) : (
        <div className="mb-8 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {grid.map((premio) => (
            <PrizeCardV2
              key={premio.id}
              premio={premio}
              balanceActual={balance}
              balanceGanadas={ganadas}
              onCanjeado={handleCanjeado}
            />
          ))}
        </div>
      )}

      <ShopEarnCta isLoggedIn={isLoggedIn} />
    </div>
  );
}

function ShopEarnCta({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-lg bg-hero-blue px-6 py-7 text-center text-white shadow-md md:px-10 md:py-8">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-5 -top-8 text-[140px] leading-none opacity-[0.08]"
      >
        🎯
      </span>
      <h2 className="relative font-display text-[28px] font-black uppercase text-white">
        {isLoggedIn ? "¿Necesitas más Lukas?" : "¿Todavía no tienes Lukas?"}
      </h2>
      <p className="relative mx-auto mt-2 max-w-xl text-sm text-white/85">
        {isLoggedIn
          ? "Sigue jugando torneos para ganar premios. El pozo se reparte entre los 10 mejores: primer lugar se lleva el 45%."
          : "Entra y juega torneos gratis con el bonus de bienvenida de 500 🪙."}
      </p>
      <div className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href={isLoggedIn ? "/matches" : "/auth/signin?callbackUrl=/tienda"}
          className="inline-flex items-center gap-2 rounded-sm bg-brand-gold px-6 py-3 text-sm font-bold text-black shadow-gold-btn transition hover:bg-brand-gold-light hover:-translate-y-0.5"
        >
          {isLoggedIn ? "⚽ Ver partidos" : "Iniciar sesión"}
        </Link>
        <Link
          href={isLoggedIn ? "/wallet" : "/matches"}
          className="inline-flex items-center gap-2 rounded-sm border border-white/30 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
        >
          {isLoggedIn ? "💳 Comprar Lukas" : "Ver torneos"}
        </Link>
      </div>
    </section>
  );
}
