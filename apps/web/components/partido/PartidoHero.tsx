// PartidoHero — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-fijas-detail (.partido-hero, lines 2778-2799).
//
// Estructura del mockup:
//   .partido-hero
//     .partido-hero-meta — liga · ronda + fecha
//     .partido-hero-teams — escudo + nombre por lado, "VS" en el medio
//     .partido-countdown — bloques con número grande + label "días/hrs/min"
//
// Hero variant programado: countdown.
// Hero variant en_vivo: marcadores + chip EN VIVO.
// Hero variant finalizado: marcadores + chip FIN.

import { getTeamInitials } from "@/lib/utils/team-colors";

type EstadoPartido = "programado" | "en_vivo" | "finalizado";

interface Props {
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: Date;
  estadio?: string | null;
  estado?: EstadoPartido;
  marcadorLocal?: number | null;
  marcadorVisita?: number | null;
  minuto?: number | null;
  /** Subtítulo opcional ("27ma fecha", "Cuartos final"). */
  ronda?: string | null;
}

export function PartidoHero({
  liga,
  equipoLocal,
  equipoVisita,
  fechaInicio,
  estado = "programado",
  marcadorLocal,
  marcadorVisita,
  minuto,
  ronda,
}: Props) {
  const enVivo = estado === "en_vivo";
  const finalizado = estado === "finalizado";
  const ligaTexto = ronda ? `🏆 ${liga} · ${ronda}` : `🏆 ${liga}`;
  const fechaTexto = formatFechaCorta(fechaInicio);

  return (
    <div className="partido-hero">
      <div className="partido-hero-meta">
        <span>
          {enVivo ? (
            <>
              <span className="live-dot" /> {ligaTexto} · {minuto ?? 0}&apos;
            </>
          ) : (
            ligaTexto
          )}
        </span>
        <span>
          {enVivo ? (
            <span
              className="estado-badge estado-vivo"
              style={{
                background: "rgba(255,61,61,.2)",
                color: "#FFB3B3",
                border: "1px solid rgba(255,61,61,.4)",
              }}
            >
              EN VIVO
            </span>
          ) : finalizado ? (
            <span className="estado-badge estado-fin">FIN</span>
          ) : (
            fechaTexto
          )}
        </span>
      </div>

      <div className="partido-hero-teams">
        <div className="team-block">
          <div className="team-shield">{getTeamInitials(equipoLocal)}</div>
          <div className="team-name">{equipoLocal}</div>
          {(enVivo || finalizado) && marcadorLocal !== null && marcadorLocal !== undefined ? (
            <div
              className={`partido-hero-marcador ${marcadorLocal > (marcadorVisita ?? 0) ? "gold" : "white"}`}
            >
              {marcadorLocal}
            </div>
          ) : null}
        </div>
        <div className="partido-vs">{enVivo || finalizado ? "-" : "VS"}</div>
        <div className="team-block">
          <div className="team-shield">{getTeamInitials(equipoVisita)}</div>
          <div className="team-name">{equipoVisita}</div>
          {(enVivo || finalizado) && marcadorVisita !== null && marcadorVisita !== undefined ? (
            <div
              className={`partido-hero-marcador ${marcadorVisita > (marcadorLocal ?? 0) ? "gold" : "white"}`}
            >
              {marcadorVisita}
            </div>
          ) : null}
        </div>
      </div>

      {!enVivo && !finalizado ? (
        <CountdownBlock fechaInicio={fechaInicio} />
      ) : null}
    </div>
  );
}

function CountdownBlock({ fechaInicio }: { fechaInicio: Date }) {
  const ms = Math.max(0, fechaInicio.getTime() - Date.now());
  const totalMin = Math.floor(ms / 60000);
  const dias = Math.floor(totalMin / (60 * 24));
  const hrs = Math.floor((totalMin % (60 * 24)) / 60);
  const min = totalMin % 60;
  return (
    <div className="partido-countdown">
      <div>
        <div className="countdown-num">{dias}</div>
        <div style={{ marginTop: 4 }}>días</div>
      </div>
      <div>
        <div className="countdown-num">{String(hrs).padStart(2, "0")}</div>
        <div style={{ marginTop: 4 }}>hrs</div>
      </div>
      <div>
        <div className="countdown-num">{String(min).padStart(2, "0")}</div>
        <div style={{ marginTop: 4 }}>min</div>
      </div>
    </div>
  );
}

function formatFechaCorta(d: Date): string {
  return d
    .toLocaleString("es-PE", {
      timeZone: "America/Lima",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", " ·")
    .concat(" hora Lima");
}
