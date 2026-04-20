// ProfileHero — avatar + nombre + nivel + balance. Sub-Sprint 7.
"use client";

import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import { useLukasStore } from "@/stores/lukas.store";
import { useEffect, useState } from "react";

function iniciales(nombre: string | null | undefined, email: string): string {
  const base = nombre && nombre.trim().length > 0 ? nombre : email;
  const partes = base.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0]![0] + partes[1]![0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

interface ProfileHeroProps {
  perfil: PerfilCompleto;
  initialBalance: number;
}

export function ProfileHero({ perfil, initialBalance }: ProfileHeroProps) {
  const balanceStore = useLukasStore((s) => s.balance);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const balance = mounted ? balanceStore : initialBalance;

  const { nivel } = perfil;
  const torneosHasta = nivel.siguiente?.min ?? nivel.actual.min;
  const porcentaje = nivel.siguiente
    ? Math.min(
        100,
        Math.round(
          ((nivel.torneosJugados - nivel.actual.min) /
            Math.max(1, torneosHasta - nivel.actual.min)) *
            100,
        ),
      )
    : 100;

  return (
    <section className="overflow-hidden rounded-lg border border-dark-border bg-hero-blue p-7 text-white shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex items-center gap-5">
          <div
            aria-hidden
            className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-gold-diagonal font-display text-[42px] font-extrabold text-black shadow-gold"
          >
            {iniciales(perfil.nombre, perfil.email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[26px] font-black uppercase leading-tight text-white md:text-[30px]">
              {perfil.nombre || perfil.email}
            </div>
            {perfil.username && (
              <div className="text-[13px] text-white/70">@{perfil.username}</div>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-white/70">
              {perfil.ubicacion && <span>{perfil.ubicacion}</span>}
              {perfil.ubicacion && <span aria-hidden>·</span>}
              <span>
                Miembro desde{" "}
                {new Date(perfil.creadoEn).toLocaleDateString("es-PE", {
                  month: "long",
                  year: "numeric",
                  timeZone: "America/Lima",
                })}
              </span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-gold-dim px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] text-brand-gold">
              {perfil.rol === "ADMIN" ? "Administrador" : "Jugador"}
            </div>
          </div>
        </div>
      </div>

      {/* Level card */}
      <div className="mt-5 rounded-md bg-white/10 p-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{nivel.actual.emoji}</span>
          <div className="flex-1">
            <div className="font-display text-[18px] font-extrabold">
              {nivel.actual.label}
            </div>
            <div className="text-[12px] text-white/70">
              {nivel.siguiente
                ? `Llevas ${nivel.torneosJugados} torneos, te faltan ${nivel.faltanParaSiguiente} para ${nivel.siguiente.emoji} ${nivel.siguiente.label}`
                : `${nivel.torneosJugados} torneos jugados — nivel máximo 👑`}
            </div>
          </div>
          <div className="font-display text-[24px] font-extrabold text-brand-gold">
            {balance} 🪙
          </div>
        </div>
        {nivel.siguiente && (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-brand-gold transition-all"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
