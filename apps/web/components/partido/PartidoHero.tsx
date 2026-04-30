// PartidoHero — hero de la vista /partidos/[slug]. Lote B v3.1.
// Spec: docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Hero mobile-first con gradient stadium + radial dorado. Variantes según
// el estado del partido:
//
// - programado: countdown chip + escudos + nombres + fecha/hora.
// - en_vivo:    chip "EN VIVO" + marcador + minuto.
// - finalizado: chip "FIN" + marcador final.
//
// `<MobileHeader variant="transparent">` se monta encima — este hero no
// trae logo ni back button, se asume que el page wrapper los provee.

import { Badge } from "@/components/ui";
import { getTeamColor, getTeamInitials } from "@/lib/utils/team-colors";

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
}

export function PartidoHero({
  liga,
  equipoLocal,
  equipoVisita,
  fechaInicio,
  estadio,
  estado = "programado",
  marcadorLocal,
  marcadorVisita,
  minuto,
}: Props) {
  const localColor = getTeamColor(equipoLocal);
  const visitaColor = getTeamColor(equipoVisita);

  return (
    <section
      role="banner"
      className="relative overflow-hidden bg-gradient-to-b from-brand-blue-dark via-[#000530] to-[#000420] px-4 py-7 text-white md:px-8 md:py-10"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gold-soft-glow opacity-50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-[-30px] top-[-30px] -rotate-[15deg] select-none text-[180px] leading-none opacity-[0.05] md:text-[260px]"
      >
        ⚽
      </span>

      <div className="relative">
        {/* Chips: liga + estado */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <Badge variant="info" size="sm">
            🏆 {liga}
          </Badge>
          {estado === "en_vivo" ? (
            <Badge variant="live" size="sm">
              ● EN VIVO {minuto !== null && minuto !== undefined ? `· ${minuto}'` : ""}
            </Badge>
          ) : estado === "finalizado" ? (
            <Badge variant="neutral" size="sm">
              FIN
            </Badge>
          ) : (
            <Badge variant="urgent-high" size="sm">
              {formatChipFecha(fechaInicio)}
            </Badge>
          )}
        </div>

        {/* Equipos + marcador */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
          <Equipo
            nombre={equipoLocal}
            bg={localColor.bg}
            fg={localColor.fg}
          />

          <div className="flex flex-col items-center gap-1 text-center">
            {estado === "programado" ? (
              <span className="font-display text-display-lg font-black text-white/40">
                VS
              </span>
            ) : (
              <span className="font-display text-display-xl font-black tabular-nums text-white">
                {marcadorLocal ?? 0} - {marcadorVisita ?? 0}
              </span>
            )}
          </div>

          <Equipo
            nombre={equipoVisita}
            bg={visitaColor.bg}
            fg={visitaColor.fg}
          />
        </div>

        {/* Estadio + fecha */}
        <p className="mt-5 text-center text-body-sm text-white/70">
          {estadio ? `${estadio} · ` : ""}
          {formatFechaCompleta(fechaInicio)}
        </p>
      </div>
    </section>
  );
}

function Equipo({
  nombre,
  bg,
  fg,
}: {
  nombre: string;
  bg: string;
  fg: string;
}) {
  return (
    <div className="text-center">
      <div
        aria-hidden
        className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full font-display text-display-md font-black shadow-md md:h-20 md:w-20"
        style={{ background: bg, color: fg }}
      >
        {getTeamInitials(nombre)}
      </div>
      <p className="line-clamp-2 font-display text-display-sm uppercase leading-tight text-white">
        {nombre}
      </p>
    </div>
  );
}

function formatChipFecha(d: Date): string {
  const ms = d.getTime() - Date.now();
  if (ms < 0) return "Empezó";
  const min = Math.floor(ms / 60000);
  if (min < 60) return `Cierra en ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `En ${horas}h`;
  return d.toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatFechaCompleta(d: Date): string {
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
