// LeaderboardMensualTable — leaderboard mensual mobile-first (Lote C v3.1,
// refactor del Lote 5).
//
// Cambios vs Lote 5:
//   - Mobile: cada fila es una "card row" stacked con avatar + nombre +
//     puntos (la tabla densa de 4 columnas era desktop-first).
//   - Línea de premio decorativa entre el corte (10°) y el resto.
//   - Fila del viewer destacada con borde lateral azul y badge "Tú".
//   - El podio (1, 2, 3) sigue resaltado con borde lateral en color medalla.
//
// La spec del Lote C lo lista como "refactor visual" — la lógica de datos
// y la API pública del componente quedan iguales para no romper callers.

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { Divider } from "@/components/ui/Divider";
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
  /** Si true muestra el premio del Top 10 + corte decorativo. */
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
      <div className="rounded-md border border-light bg-card px-5 py-10 text-center shadow-sm">
        <div aria-hidden className="mb-3 text-[36px] leading-none">
          🏁
        </div>
        <p className="font-display text-display-xs font-bold text-dark">
          Aún no hay actividad en este mes
        </p>
        <p className="mt-1 text-body-xs text-muted-d">
          Apenas finalice el primer torneo del mes, los puntos empiezan a
          contar para el ranking mensual.
        </p>
      </div>
    );
  }

  // Insertamos un divider después del top 10 si hay >10 filas.
  const filasConCorte: Array<Fila | "corte"> = [];
  filas.forEach((f, idx) => {
    if (mostrarPremios && idx === TOP_PREMIADOS && filas.length > TOP_PREMIADOS) {
      filasConCorte.push("corte");
    }
    filasConCorte.push(f);
  });

  return (
    <div className="overflow-hidden rounded-md border border-light bg-card shadow-sm">
      <ul className="divide-y divide-light">
        {filasConCorte.map((item, idx) => {
          if (item === "corte") {
            return (
              <li key={`corte-${idx}`} className="bg-alert-warning-bg px-3.5 py-2">
                <Divider variant="decorative" label="✂ Línea de premio" />
              </li>
            );
          }
          return (
            <FilaItem
              key={item.userId}
              fila={item}
              isMe={miUserId !== null && item.userId === miUserId}
              mostrarPremios={mostrarPremios}
            />
          );
        })}
      </ul>
    </div>
  );
}

function FilaItem({
  fila,
  isMe,
  mostrarPremios,
}: {
  fila: Fila;
  isMe: boolean;
  mostrarPremios: boolean;
}) {
  const monto = premioParaPosicion(fila.posicion);
  const enTopPremiados = fila.posicion <= TOP_PREMIADOS;
  const podio = fila.posicion <= 3;
  const borderTone = isMe
    ? "border-l-4 border-l-brand-blue-main bg-brand-blue-main/[0.06]"
    : fila.posicion === 1
      ? "border-l-4 border-l-medal-gold bg-medal-gold/[0.08]"
      : fila.posicion === 2
        ? "border-l-4 border-l-medal-silver bg-medal-silver/[0.06]"
        : fila.posicion === 3
          ? "border-l-4 border-l-medal-bronze bg-medal-bronze/[0.06]"
          : "";

  const posTone =
    fila.posicion === 1
      ? "text-medal-gold"
      : fila.posicion === 2
        ? "text-medal-silver"
        : fila.posicion === 3
          ? "text-medal-bronze"
          : "text-muted-d";

  return (
    <li
      data-testid={`leaderboard-row-${fila.posicion}`}
      className={cn(
        "grid grid-cols-[36px_36px_1fr_auto] items-center gap-2.5 px-3.5 py-3",
        borderTone,
        !borderTone && !podio && !isMe && "hover:bg-subtle",
      )}
    >
      <span
        className={cn(
          "font-display text-display-xs font-extrabold leading-none",
          posTone,
        )}
      >
        {fila.posicion}
      </span>

      <Avatar name={fila.username} size="sm" />

      <Link
        href={`/comunidad/${fila.username}`}
        className="min-w-0"
      >
        <p className="flex items-center gap-1.5 truncate text-body-sm font-bold text-dark">
          {isMe ? "Tú" : `@${fila.username}`}
          {isMe ? (
            <span className="rounded-full bg-brand-blue-main px-1.5 py-0.5 text-label-sm font-bold text-white">
              Tú
            </span>
          ) : null}
        </p>
        {mostrarPremios && enTopPremiados ? (
          <p className="text-label-sm font-bold text-brand-gold-dark">
            S/ {monto}
          </p>
        ) : null}
      </Link>

      <div className="text-right">
        <div className="font-display text-display-sm font-extrabold leading-none text-brand-gold-dark">
          {fila.puntos}
        </div>
        <div className="text-label-sm uppercase text-muted-d">pts</div>
      </div>
    </li>
  );
}
