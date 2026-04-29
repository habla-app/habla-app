// Tabla del leaderboard mensual — Lote 5.
//
// Reutiliza el patrón visual de live/RankingTable.tsx (gradient pastel +
// borde lateral 4px para top 1/2/3, gradient azul claro para "me"), pero
// es un Server Component puro: el leaderboard mensual no necesita updates
// en vivo (los puntos están congelados al FT del torneo).
//
// Cosmético: muestra avatar inicializado, @username, puntos (gold) y la
// chip de premio sólo para top 10.

import { premioParaPosicion } from "@/lib/services/leaderboard.service";

interface Fila {
  posicion: number;
  userId: string;
  username: string;
  puntos: number;
}

interface LeaderboardMensualTableProps {
  filas: Fila[];
  miUserId: string | null;
  /** Si true, se muestran las posiciones del top 10 con la chip de premio
   *  visible. En meses cerrados se sigue mostrando el premio (referencia
   *  histórica); en mes en curso es proyección al cierre. */
  mostrarPremios: boolean;
}

const TOP_PREMIADOS = 10;

export function LeaderboardMensualTable({
  filas,
  miUserId,
  mostrarPremios,
}: LeaderboardMensualTableProps) {
  if (filas.length === 0) {
    return (
      <div className="rounded-md border border-light bg-card px-6 py-12 text-center shadow-sm">
        <div aria-hidden className="mb-3 text-4xl">🏁</div>
        <p className="text-base font-semibold text-dark">
          Aún no hay actividad en este mes
        </p>
        <p className="mt-1 text-[13px] text-muted-d">
          Apenas finalice el primer torneo del mes, los puntos empiezan a
          contar para el ranking mensual.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <div className="grid grid-cols-[44px_1fr_80px_110px] items-center gap-3.5 border-b border-light bg-subtle px-4 py-3.5 font-display text-[11px] font-extrabold uppercase tracking-[0.08em] text-muted-d md:grid-cols-[60px_1fr_100px_140px]">
        <div>Pos</div>
        <div>Tipster</div>
        <div className="text-center">Puntos</div>
        <div className="text-right">{mostrarPremios ? "Premio" : "—"}</div>
      </div>

      <ul>
        {filas.map((fila) => {
          const isMe = miUserId !== null && fila.userId === miUserId;
          const monto = premioParaPosicion(fila.posicion);
          const enTopPremiados = fila.posicion <= TOP_PREMIADOS;
          const rowTint = isMe
            ? "bg-brand-blue-main/[0.06] border-l-4 border-l-brand-blue-main pl-[14px]"
            : fila.posicion === 1
              ? "bg-gradient-to-r from-brand-gold/[0.1] to-transparent border-l-4 border-l-brand-gold pl-[14px]"
              : fila.posicion === 2
                ? "bg-gradient-to-r from-medal-silver/[0.08] to-transparent border-l-4 border-l-medal-silver pl-[14px]"
                : fila.posicion === 3
                  ? "bg-gradient-to-r from-medal-bronze/[0.1] to-transparent border-l-4 border-l-medal-bronze pl-[14px]"
                  : "hover:bg-subtle";

          return (
            <li
              key={fila.userId}
              data-testid={`leaderboard-row-${fila.posicion}`}
              className={`grid grid-cols-[44px_1fr_80px_110px] items-center gap-3.5 border-b border-light px-4 py-3.5 transition md:grid-cols-[60px_1fr_100px_140px] ${rowTint}`}
            >
              <div className="text-center">
                <PosNumber posicion={fila.posicion} />
              </div>

              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  aria-hidden
                  className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-full text-sm md:h-[40px] md:w-[40px]"
                  style={{
                    background: isMe
                      ? "linear-gradient(135deg,#FFB800,#FF8C00)"
                      : avatarBgFor(fila.userId),
                    color: isMe ? "#000" : "#fff",
                    fontWeight: 700,
                  }}
                >
                  {initialsFrom(fila.username)}
                </div>
                <div className="min-w-0 truncate text-sm font-bold text-dark">
                  @{fila.username}
                  {isMe ? (
                    <span className="ml-2 rounded-full bg-brand-blue-main px-2 py-0.5 align-middle text-[10px] font-bold text-white">
                      Tú
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-center font-display text-2xl font-black leading-none text-brand-gold-dark">
                {fila.puntos}
              </div>

              <div className="text-right">
                {mostrarPremios && enTopPremiados ? (
                  <div className="font-display text-[13px] font-black uppercase tracking-[0.04em] text-brand-gold-dark md:text-[15px]">
                    S/ {monto}
                  </div>
                ) : (
                  <div className="font-display text-[12px] font-black text-muted-d">
                    —
                  </div>
                )}
              </div>
            </li>
          );
        })}

        {mostrarPremios &&
        filas.some((f) => f.posicion === TOP_PREMIADOS) ? (
          <li className="flex items-center gap-2.5 border-y border-dashed border-urgent-high bg-gradient-to-r from-urgent-high/[0.08] to-transparent px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-urgent-high-dark">
            <span aria-hidden>✂️</span>
            Corte · Del 11° en adelante no reciben premio
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function PosNumber({ posicion }: { posicion: number }) {
  const tone =
    posicion === 1
      ? "text-medal-gold"
      : posicion === 2
        ? "text-medal-silver"
        : posicion === 3
          ? "text-medal-bronze"
          : "text-muted-d";
  return (
    <span
      className={`block font-display text-[22px] font-black leading-none md:text-[26px] ${tone}`}
    >
      {posicion}
    </span>
  );
}

function initialsFrom(handle: string): string {
  const base = (handle ?? "").trim();
  if (!base) return "?";
  return base.slice(0, 2).toUpperCase();
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
  "#F97316",
  "#A855F7",
  "#14B8A6",
  "#6366F1",
];

function avatarBgFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  }
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length] ?? "#3B82F6";
}
