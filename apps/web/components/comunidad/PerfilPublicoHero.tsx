// PerfilPublicoHero — hero de /comunidad/[username] mobile-first (Lote C
// v3.1, refactor del Lote 11). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-username.spec.md.
//
// Layout vertical-first: avatar grande + username + badge Premium si
// aplica + nivel + "miembro desde". El botón "+ Seguir" es placeholder
// en Lote C — el modelo `Seguidor` se posterga (decisión documentada
// en el reporte del lote).

import type { Nivel } from "@/lib/utils/nivel";

const FMT_MES_ANIO = new Intl.DateTimeFormat("es-PE", {
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});

interface PerfilPublicoHeroProps {
  username: string;
  nombre: string;
  desde: Date;
  nivel: Nivel;
  esPremium: boolean;
  esElMismoViewer: boolean;
}

function iniciales(username: string): string {
  return username.trim().slice(0, 2).toUpperCase();
}

export function PerfilPublicoHero({
  username,
  nombre,
  desde,
  nivel,
  esPremium,
  esElMismoViewer,
}: PerfilPublicoHeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-blue-mid via-brand-blue-main to-brand-blue-dark px-4 py-6 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold-soft-glow"
      />
      <div className="relative flex flex-col items-center text-center">
        <div
          aria-hidden
          className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold-diagonal font-display text-[28px] font-extrabold text-brand-blue-dark shadow-gold"
        >
          {iniciales(username)}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h1 className="font-display text-display-md font-black leading-none">
            @{username}
          </h1>
          {esPremium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-gold to-brand-gold-light px-2 py-0.5 text-label-sm font-bold uppercase tracking-[0.05em] text-brand-blue-dark">
              💎 Premium
            </span>
          )}
        </div>

        {nombre && nombre !== username ? (
          <p className="mt-1 text-body-sm text-white/75">{nombre}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-label-md text-white/70">
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-bold">
            {nivel.emoji} {nivel.label}
          </span>
          <span>· Miembro desde {FMT_MES_ANIO.format(desde)}</span>
        </div>

        {!esElMismoViewer ? (
          <SeguirPlaceholder />
        ) : (
          <a
            href="/perfil"
            className="touch-target mt-4 inline-flex items-center justify-center gap-1 rounded-sm border border-white/30 px-4 py-2 text-label-md font-bold text-white hover:bg-white/10"
          >
            Editar perfil →
          </a>
        )}
      </div>
    </section>
  );
}

/**
 * Botón "+ Seguir" placeholder. El modelo `Seguidor` se posterga al
 * post-launch — el botón muestra "Próximamente" en lugar de hacer click.
 * Cuando el modelo exista, este componente se reemplaza por un
 * `<SeguirButton>` real con POST/DELETE a /api/v1/seguidores/[id].
 */
function SeguirPlaceholder() {
  return (
    <button
      type="button"
      aria-label="Próximamente: seguir tipster"
      title="Próximamente"
      disabled
      className="touch-target mt-4 inline-flex cursor-not-allowed items-center justify-center gap-1 rounded-sm bg-brand-gold/30 px-4 py-2 text-label-md font-bold text-white/80"
    >
      + Seguir · Pronto
    </button>
  );
}
