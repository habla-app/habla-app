// LeaderboardTorneoPreview — preview compacto del leaderboard del mes
// dentro de la vista del torneo (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad-torneo-slug.spec.md.
//
// Muestra Top 5 + línea decorativa de premio + posición del viewer (si
// está fuera del Top 5). Cada fila linkea al perfil público del tipster
// (/comunidad/[username]). El footer linkea a /comunidad para ver el
// leaderboard mensual completo.

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Divider } from "@/components/ui/Divider";

interface FilaLeaderboard {
  posicion: number;
  userId: string;
  username: string;
  puntos: number;
  /** Si true, marcar la fila como "Tú". */
  esViewer?: boolean;
  /** Si true, dibujar badge premium. */
  esPremium?: boolean;
  /** Premio asignado a esa posición (si Top 10) — viene de la tabla de
   *  premios mensuales. */
  premioSoles?: number;
}

interface LeaderboardTorneoPreviewProps {
  filas: FilaLeaderboard[];
  miFila?: FilaLeaderboard | null;
  showPremioLineAfter?: number;
}

export function LeaderboardTorneoPreview({
  filas,
  miFila,
  showPremioLineAfter,
}: LeaderboardTorneoPreviewProps) {
  if (filas.length === 0) {
    return (
      <div className="rounded-md border border-light bg-subtle px-4 py-6 text-center">
        <p className="text-body-sm text-muted-d">
          Aún no hay actividad en el mes. Sé el primero en sumar puntos.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-light">
        {filas.map((fila) => (
          <FilaItem key={fila.userId} fila={fila} />
        ))}
      </ul>

      {showPremioLineAfter !== undefined && filas.length > showPremioLineAfter ? (
        <Divider variant="decorative">✂ Línea de premio</Divider>
      ) : null}

      {miFila &&
      !filas.some((f) => f.userId === miFila.userId) ? (
        <div className="rounded-md bg-brand-blue-main/[0.06] px-1">
          <FilaItem fila={{ ...miFila, esViewer: true }} />
        </div>
      ) : null}

      <div className="pt-2 text-center">
        <Link
          href="/comunidad"
          className="inline-flex items-center gap-1 text-label-md font-bold text-brand-blue-main hover:underline"
        >
          Ver leaderboard del mes →
        </Link>
      </div>
    </div>
  );
}

function FilaItem({ fila }: { fila: FilaLeaderboard }) {
  const tone =
    fila.posicion === 1
      ? "text-medal-gold"
      : fila.posicion === 2
        ? "text-medal-silver"
        : fila.posicion === 3
          ? "text-medal-bronze"
          : "text-muted-d";
  return (
    <Link
      href={`/comunidad/${fila.username}`}
      className="grid grid-cols-[28px_36px_1fr_auto] items-center gap-2.5 py-2"
    >
      <span
        className={`font-display text-display-xs font-extrabold leading-none ${tone}`}
      >
        {fila.posicion}
      </span>
      <Avatar name={fila.username} size="sm" />
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={`truncate text-body-sm font-bold ${
              fila.esViewer ? "text-brand-blue-main" : "text-dark"
            }`}
          >
            {fila.esViewer ? "Tú" : `@${fila.username}`}
          </span>
          {fila.esPremium ? (
            <span className="rounded-sm bg-brand-gold-dim px-1 text-label-sm font-bold text-brand-gold-dark">
              💎
            </span>
          ) : null}
        </div>
        {fila.premioSoles ? (
          <span className="text-label-sm text-muted-d">
            S/ {fila.premioSoles}
          </span>
        ) : null}
      </div>
      <div className="text-right">
        <div className="font-display text-display-xs font-extrabold leading-none text-dark">
          {fila.puntos}
        </div>
        <div className="text-label-sm uppercase text-muted-d">pts</div>
      </div>
    </Link>
  );
}
