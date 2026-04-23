"use client";
// ProfileHero — mockup `.profile-hero-v2` (línea 3860 del mockup). Gradient
// azul con shimmer dorado superior, avatar circular 100px (iniciales del
// @handle), badge verificado, meta row y level-card embebida con progreso.
//
// Registro formal (Abr 2026): `username` es NOT NULL. El handle se muestra
// siempre con prefijo @. Si aún es temporal (new_xxx — caso raro porque
// el middleware lo bloquea), degradamos el display.

import type { PerfilCompleto } from "@/lib/services/usuarios.service";

interface ProfileHeroProps {
  perfil: PerfilCompleto;
}

const MEMBER_SINCE_FMT = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});

function iniciales(username: string, email: string): string {
  const base = username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export function ProfileHero({ perfil }: ProfileHeroProps) {
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
  const estaVerificado = Boolean(
    perfil.emailVerified && (perfil.telefonoVerif || perfil.dniVerif),
  );
  const edadAnios = perfil.fechaNac
    ? Math.floor(
        (Date.now() - new Date(perfil.fechaNac).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;

  return (
    <section className="relative mb-5 overflow-hidden rounded-lg bg-gradient-to-br from-brand-blue-main to-brand-blue-dark p-7 text-white shadow-lg">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[5px] bg-gold-shimmer bg-[length:200%_100%] animate-shimmer"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 -right-5 rotate-[-15deg] text-[200px] leading-none opacity-[0.04]"
      >
        ⚽
      </span>

      <div className="relative z-[1] flex flex-wrap items-center gap-5">
        <div className="relative flex-shrink-0">
          <div
            aria-hidden
            className="flex h-[100px] w-[100px] items-center justify-center rounded-full bg-gold-diagonal font-display text-[40px] font-extrabold text-black shadow-gold"
          >
            {iniciales(perfil.username, perfil.email)}
          </div>
          <button
            type="button"
            aria-label="Cambiar foto"
            title="Cambiar foto"
            className="absolute -bottom-0.5 -right-0.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border-[3px] border-brand-blue-main bg-white text-[15px] text-dark shadow-md transition hover:scale-110"
          >
            📷
          </button>
        </div>
        <div className="min-w-[220px] flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2.5">
            <div className="font-display text-[34px] font-black leading-none">
              {perfil.nombre || perfil.username}
            </div>
            {estaVerificado ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-pred-correct/40 bg-pred-correct/20 px-2.5 py-1 text-[11px] font-bold text-[#6EE7B7]">
                ✓ Verificado
              </span>
            ) : null}
          </div>
          <div className="mb-2.5 text-sm text-white/70">
            @{perfil.username}
          </div>
          <div className="flex flex-wrap gap-3.5 text-xs text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden>📅</span> Miembro desde{" "}
              {MEMBER_SINCE_FMT.format(new Date(perfil.creadoEn))}
            </span>
            {perfil.ubicacion ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>📍</span> {perfil.ubicacion}
              </span>
            ) : null}
            {edadAnios !== null ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden>🎂</span> {edadAnios} años
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="relative z-[1] mt-5 rounded-md border border-white/[0.12] bg-white/[0.08] p-4 backdrop-blur-sm">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="text-[22px] leading-none">
              {nivel.actual.emoji}
            </span>
            <div>
              <div className="font-display text-xl font-black uppercase leading-none tracking-[0.03em] text-brand-gold">
                {nivel.actual.label}
              </div>
              <div className="mt-0.5 text-[11px] text-white/65">
                Llevas {nivel.torneosJugados} torneos jugados
              </div>
            </div>
          </div>
          {nivel.siguiente ? (
            <div className="text-right text-[11px] text-white/70">
              Próximo:{" "}
              <strong className="text-white">
                {nivel.siguiente.emoji} {nivel.siguiente.label}
              </strong>
              <br />
              en {nivel.faltanParaSiguiente} torneos
            </div>
          ) : (
            <div className="text-right text-[11px] text-white/70">
              <strong className="text-white">Nivel máximo 👑</strong>
            </div>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            aria-hidden
            className="h-full rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light transition-all"
            style={{ width: `${porcentaje}%` }}
          />
        </div>
      </div>
    </section>
  );
}
