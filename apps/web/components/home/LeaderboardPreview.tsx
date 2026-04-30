// LeaderboardPreview — Lote 11.
//
// Preview compacto del leaderboard mensual (Lote 5) para la home. Muestra
// el Top 5 del mes en curso con avatar + username + puntos. Si el usuario
// está logueado y aparece en el Top 5, su fila se highlight-ea.
//
// Server Component puro — el mes en curso ya viene calculado on-the-fly
// por `obtenerLeaderboardMesActual` y no requiere updates en vivo (los
// puntos están congelados al FT del torneo).

import Link from "next/link";

interface Fila {
  posicion: number;
  userId: string;
  username: string;
  puntos: number;
}

interface Props {
  filas: Fila[];
  miUserId: string | null;
  /** Total de usuarios del mes — para mostrar el contexto ("de M tipsters"). */
  totalUsuarios: number;
  nombreMes: string;
}

const AVATAR_PALETTE = [
  "#3B82F6",
  "#8B5CF6",
  "#10B981",
  "#EF4444",
  "#F59E0B",
  "#06B6D4",
  "#84CC16",
  "#EC4899",
];

function avatarBgFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] ?? "#3B82F6";
}

function initialsFrom(handle: string): string {
  const base = (handle ?? "").trim();
  if (!base) return "?";
  return base.slice(0, 2).toUpperCase();
}

export function LeaderboardPreview({
  filas,
  miUserId,
  totalUsuarios,
  nombreMes,
}: Props) {
  const top5 = filas.slice(0, 5);

  if (top5.length === 0) {
    return (
      <div className="rounded-md border border-light bg-card px-5 py-8 text-center shadow-sm">
        <div aria-hidden className="mb-2 text-3xl">
          🏁
        </div>
        <p className="text-sm font-semibold text-dark">
          Aún no hay actividad en {nombreMes}
        </p>
        <p className="mt-1 text-[12px] text-muted-d">
          Apenas finalice el primer torneo del mes, los puntos empiezan a
          contar.
        </p>
        <Link
          href="/cuotas"
          className="mt-4 inline-flex items-center justify-center rounded-md bg-brand-gold px-4 py-2 font-display text-[12px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
        >
          Hacer mi predicción
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <ul>
        {top5.map((fila) => {
          const isMe = miUserId !== null && fila.userId === miUserId;
          const isPodium = fila.posicion <= 3;
          const tint = isMe
            ? "bg-brand-blue-main/[0.06]"
            : fila.posicion === 1
              ? "bg-gradient-to-r from-brand-gold/[0.1] to-transparent"
              : "";

          return (
            <li
              key={fila.userId}
              className={`flex items-center gap-3 border-b border-light px-4 py-3 last:border-b-0 ${tint}`}
            >
              <span
                className={`w-7 flex-shrink-0 text-center font-display text-[20px] font-black leading-none ${
                  fila.posicion === 1
                    ? "text-medal-gold"
                    : fila.posicion === 2
                      ? "text-medal-silver"
                      : fila.posicion === 3
                        ? "text-medal-bronze"
                        : "text-muted-d"
                }`}
              >
                {fila.posicion}
              </span>
              <div
                aria-hidden
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                style={{
                  background: isMe
                    ? "linear-gradient(135deg,#FFB800,#FF8C00)"
                    : avatarBgFor(fila.userId),
                  color: isMe ? "#000" : "#fff",
                }}
              >
                {initialsFrom(fila.username)}
              </div>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/comunidad/${fila.username}`}
                  className="block truncate text-sm font-bold text-dark hover:text-brand-blue-main"
                >
                  @{fila.username}
                </Link>
                {isMe ? (
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-blue-main">
                    Tú
                  </span>
                ) : isPodium ? (
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-gold-dark">
                    En zona de premio
                  </span>
                ) : null}
              </div>
              <div className="font-display text-[18px] font-black leading-none text-brand-gold-dark">
                {fila.puntos}
                <span className="ml-1 text-[10px] font-bold text-muted-d">
                  pts
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="border-t border-light bg-subtle/60 px-4 py-2.5 text-[11px] text-muted-d">
        Top 5 de {totalUsuarios.toLocaleString("es-PE")} tipster
        {totalUsuarios === 1 ? "" : "s"} compitiendo en {nombreMes}.
      </div>
    </div>
  );
}
