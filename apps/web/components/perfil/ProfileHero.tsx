// ProfileHero — hero del /perfil mobile-first (Lote C v3.1, refactor del
// Lote 11). Spec: docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md.
//
// Cambios vs Lote 11:
//   - Layout vertical-first (avatar grande centrado, 80px) en lugar del
//     row 100px desktop-only del mockup legacy.
//   - Badge Premium (💎) junto al username si el usuario tiene suscripción
//     activa. La prop `esPremium` la pasa el page server-side desde
//     `obtenerEstadoPremium`.
//   - <NivelProgressBar> reusable extraído del Lote A.
//   - Cero `verificado` chip — el email-verified se muestra ahora en la
//     <VerificacionSection>, esto despeja el hero.
//
// El componente no es interactivo más allá del botón "📷 Cambiar foto"
// (placeholder a Lote post-launch — al click no hace nada por ahora).

import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import { NivelProgressBar } from "./NivelProgressBar";

const MEMBER_SINCE_FMT = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});

interface ProfileHeroProps {
  perfil: PerfilCompleto;
  esPremium?: boolean;
}

function iniciales(username: string, email: string): string {
  const base = username && !username.startsWith("new_") ? username : email;
  return base.trim().slice(0, 2).toUpperCase();
}

export function ProfileHero({ perfil, esPremium = false }: ProfileHeroProps) {
  const { nivel } = perfil;
  const ubicacion = perfil.ubicacion?.trim();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-blue-mid via-brand-blue-main to-brand-blue-dark px-4 py-6 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-soft-glow"
      />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative">
          <div
            aria-hidden
            className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold-diagonal font-display text-[28px] font-extrabold text-brand-blue-dark shadow-gold"
          >
            {iniciales(perfil.username, perfil.email)}
          </div>
          <button
            type="button"
            aria-label="Cambiar foto"
            className="touch-target absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-brand-blue-main bg-card text-[14px] text-dark shadow-md transition hover:scale-105"
          >
            📷
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h1 className="font-display text-display-md font-black uppercase leading-none">
            {perfil.nombre || perfil.username}
          </h1>
          {esPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light px-2 py-0.5 text-label-sm font-bold uppercase tracking-[0.05em] text-brand-blue-dark">
              💎 Premium
            </span>
          )}
        </div>

        <p className="mt-1 text-body-sm text-white/75">
          @{perfil.username}
          {ubicacion ? ` · ${ubicacion}` : ""}
        </p>

        <p className="mt-1 text-body-xs text-white/60">
          Miembro desde {MEMBER_SINCE_FMT.format(new Date(perfil.creadoEn))}
        </p>
      </div>

      <div className="relative mt-5 rounded-md border border-white/[0.12] bg-white/[0.06] p-3.5 backdrop-blur-sm">
        <NivelProgressBar
          nivelActual={nivel.actual}
          nivelSiguiente={nivel.siguiente}
          torneosJugados={nivel.torneosJugados}
          faltanParaSiguiente={nivel.faltanParaSiguiente}
          tone="gold"
        />
      </div>
    </section>
  );
}
