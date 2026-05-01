// PrediccionListItem — item de la lista de predicciones (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/mis-predicciones.spec.md.
//
// Muestra: liga + fecha · status chip · equipos · tu predicción resumida ·
// puntos sumados · footer con resultado real + link "Ver →".
//
// El link va a `/comunidad/torneo/[partidoId]` (URL nueva del Lote C que
// reemplaza /torneo/[id]).

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { TicketConTorneo } from "@/lib/services/tickets.service";

interface PrediccionListItemProps {
  ticket: TicketConTorneo;
}

const FMT_FECHA = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "short",
  timeZone: "America/Lima",
});

export function PrediccionListItem({ ticket }: PrediccionListItemProps) {
  const t = ticket;
  const partido = t.torneo.partido;
  const finalizado = t.torneo.estado === "FINALIZADO";
  const enJuego = t.torneo.estado === "EN_JUEGO";
  const acerto =
    finalizado &&
    t.posicionFinal !== null &&
    t.posicionFinal > 0 &&
    t.posicionFinal <= 10;
  const fallo = finalizado && !acerto;

  const status = enJuego
    ? { label: "⏳ En vivo", tone: "pending" as const }
    : finalizado
      ? acerto
        ? { label: "✓ Acertaste", tone: "win" as const }
        : { label: "✗ Falló", tone: "lose" as const }
      : { label: "📅 Próximo", tone: "neutral" as const };

  return (
    <Link
      href={`/comunidad/torneo/${partido.id}`}
      className="block rounded-md border border-light bg-card p-3.5 shadow-sm transition-colors hover:border-brand-blue-main"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-label-sm uppercase tracking-[0.06em] text-muted-d">
        <span className="truncate font-bold">
          🏆 {partido.liga} · {FMT_FECHA.format(partido.fechaInicio)}
        </span>
        <StatusChip {...status} />
      </div>

      <div className="mb-2 flex items-center gap-2">
        <span className="truncate font-display text-display-xs font-bold text-dark">
          {partido.equipoLocal}
        </span>
        <span className="text-label-sm text-muted-d">vs</span>
        <span className="truncate font-display text-display-xs font-bold text-dark">
          {partido.equipoVisita}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md bg-subtle px-3 py-2">
        <div className="min-w-0">
          <div className="text-label-sm uppercase tracking-[0.06em] text-muted-d">
            Tu predicción
          </div>
          <div className="truncate font-display text-body-md font-bold text-dark">
            {prediccionResumen(t)}
          </div>
        </div>
        <div className="text-right">
          <div
            className={cn(
              "font-display text-display-xs font-extrabold leading-none",
              acerto && "text-alert-success-text",
              fallo && "text-muted-d",
              !finalizado && "text-alert-warning-text",
            )}
          >
            {finalizado ? `+${t.puntosTotal ?? 0}` : "—"}
          </div>
          <div className="text-label-sm uppercase text-muted-d">pts</div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-label-md text-muted-d">
        <span>
          {finalizado || enJuego
            ? `Marcador: ${partido.golesLocal ?? "–"}-${partido.golesVisita ?? "–"}`
            : `Kickoff ${FMT_FECHA.format(partido.fechaInicio)}`}
        </span>
        <span className="font-bold text-brand-blue-main">Ver →</span>
      </div>
    </Link>
  );
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "win" | "lose" | "pending" | "neutral";
}) {
  const cls =
    tone === "win"
      ? "bg-alert-success-bg text-alert-success-text"
      : tone === "lose"
        ? "bg-alert-danger-bg text-alert-danger-text"
        : tone === "pending"
          ? "bg-alert-warning-bg text-alert-warning-text"
          : "bg-subtle text-muted-d";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-label-sm font-bold",
        cls,
      )}
    >
      {label}
    </span>
  );
}

function prediccionResumen(t: {
  predResultado: "LOCAL" | "EMPATE" | "VISITA";
  predBtts: boolean;
  predMas25: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
  torneo: { partido: { equipoLocal: string; equipoVisita: string } };
}): string {
  const partes: string[] = [];
  if (t.predResultado === "LOCAL") partes.push(`${cortar(t.torneo.partido.equipoLocal)} gana`);
  else if (t.predResultado === "VISITA")
    partes.push(`${cortar(t.torneo.partido.equipoVisita)} gana`);
  else partes.push("Empate");
  partes.push(`${t.predMarcadorLocal}-${t.predMarcadorVisita}`);
  if (t.predBtts) partes.push("BTTS");
  if (t.predMas25) partes.push("+2.5");
  return partes.join(" · ");
}

function cortar(nombre: string): string {
  return nombre.length > 12 ? `${nombre.slice(0, 12)}.` : nombre;
}
