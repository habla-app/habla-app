// PartidoLigaRow — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-liga-list (filas/cards de partido).
//
// Helper de presentación para una fila/card de partido en cualquiera de
// las 3 secciones de /liga (próximos / en vivo / terminados). Mobile usa
// card vertical, desktop usa fila de tabla compartida.

import Link from "next/link";
import { Badge } from "@/components/ui";
import type { PartidoLigaItem } from "@/lib/services/liga.service";

interface CardProps {
  partido: PartidoLigaItem;
  /** Tipo de sección controla qué CTA y qué chips se muestran. */
  variante: "proximo" | "vivo" | "terminado";
}

export function PartidoLigaCardMobile({ partido, variante }: CardProps) {
  return (
    <Link
      href={`/liga/${partido.slug}`}
      className={`block rounded-md border bg-card shadow-sm transition-all hover:-translate-y-px hover:shadow-md ${
        variante === "vivo"
          ? "border-light border-l-[4px] border-l-urgent-critical"
          : "border-light"
      }`}
    >
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-label-sm uppercase tracking-[0.04em] text-muted-d">
              {variante === "vivo" ? (
                <>
                  <span aria-hidden className="mr-1 text-urgent-critical">
                    ●
                  </span>{" "}
                  {partido.liveElapsed ?? "—"}&apos;· {partido.liga}
                </>
              ) : variante === "terminado" ? (
                <>FIN · {partido.liga}</>
              ) : (
                <>🏆 {partido.liga} · {formatFechaCorta(partido.fechaInicio)}</>
              )}
            </p>
            <p className="line-clamp-1 font-display text-display-xs font-bold text-dark">
              {partido.equipoLocal}
              {variante !== "proximo" && partido.golesLocal !== null
                ? ` ${partido.golesLocal}`
                : ""}{" "}
              vs {partido.equipoVisita}
              {variante !== "proximo" && partido.golesVisita !== null
                ? ` ${partido.golesVisita}`
                : ""}
            </p>
          </div>
          {variante === "vivo" ? (
            <Badge variant="live" size="sm">
              EN VIVO
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-light pt-2 text-body-xs">
          <span className="text-muted-d">
            {partido.totalInscritos.toLocaleString("es-PE")} tipster
            {partido.totalInscritos === 1 ? "" : "s"}
          </span>
          {variante === "proximo" ? (
            <CombinadaBadge estado={partido.miEstadoCombinada} />
          ) : variante === "vivo" && partido.miPuntos !== null ? (
            <span className="font-display font-extrabold text-urgent-critical">
              {partido.miPuntos} pts
            </span>
          ) : variante === "terminado" && partido.miPuntos !== null ? (
            <span className="font-display font-extrabold text-brand-blue-main">
              Mis pts: {partido.miPuntos}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function PartidoLigaRowDesktop({ partido, variante }: CardProps) {
  return (
    <tr className="border-b border-light/60 transition-colors hover:bg-subtle/50">
      <td className="px-4 py-3 align-middle">
        <p className="text-label-sm font-bold uppercase tracking-[0.04em] text-dark">
          {variante === "vivo" ? (
            <>
              <span aria-hidden className="mr-1 text-urgent-critical">
                ●
              </span>{" "}
              {partido.liveElapsed ?? "—"}&apos;
            </>
          ) : variante === "terminado" ? (
            "FIN"
          ) : (
            partido.liga
          )}
        </p>
        <p className="text-body-xs text-muted-d">
          {variante === "proximo"
            ? formatFechaCorta(partido.fechaInicio)
            : variante === "vivo"
              ? partido.liga
              : partido.liga}
        </p>
      </td>
      <td className="px-4 py-3 align-middle">
        <p className="font-display text-label-md font-bold text-dark">
          {partido.equipoLocal}
          {variante !== "proximo" && partido.golesLocal !== null
            ? ` ${partido.golesLocal}`
            : ""}{" "}
          vs {partido.equipoVisita}
          {variante !== "proximo" && partido.golesVisita !== null
            ? ` ${partido.golesVisita}`
            : ""}
        </p>
      </td>
      <td className="px-4 py-3 align-middle text-body-xs text-muted-d">
        {partido.totalInscritos.toLocaleString("es-PE")}
      </td>
      <td className="px-4 py-3 align-middle">
        {variante === "proximo" ? (
          <CombinadaBadge estado={partido.miEstadoCombinada} />
        ) : variante === "vivo" && partido.miPuntos !== null ? (
          <span className="font-display text-label-md font-extrabold text-urgent-critical">
            {partido.miPuntos} pts
          </span>
        ) : variante === "terminado" && partido.miPuntos !== null ? (
          <span className="font-display text-label-md font-extrabold text-brand-blue-main">
            {partido.miPuntos}
          </span>
        ) : (
          <span className="text-body-xs text-muted-d">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right align-middle">
        <Link
          href={`/liga/${partido.slug}`}
          className={`inline-flex items-center gap-1 rounded-sm px-3 py-1.5 font-display text-label-sm font-bold transition-colors ${
            variante === "proximo" && partido.miEstadoCombinada !== "predicha"
              ? "bg-brand-gold text-black shadow-gold-btn hover:bg-brand-gold-light"
              : "border border-strong bg-card text-body hover:border-brand-blue-main hover:text-brand-blue-main"
          }`}
        >
          {ctaText(variante, partido.miEstadoCombinada)}
        </Link>
      </td>
    </tr>
  );
}

function CombinadaBadge({
  estado,
}: {
  estado: "predicha" | "sin_predecir" | null;
}) {
  if (estado === "predicha") {
    return (
      <Badge variant="success" size="sm">
        Predecida ✓
      </Badge>
    );
  }
  if (estado === "sin_predecir") {
    return (
      <Badge variant="neutral" size="sm">
        Sin predecir
      </Badge>
    );
  }
  return null;
}

function ctaText(
  variante: "proximo" | "vivo" | "terminado",
  estado: "predicha" | "sin_predecir" | null,
): string {
  if (variante === "vivo") return "Ver ranking →";
  if (variante === "terminado") return "Ver →";
  if (estado === "predicha") return "Modificar ✏️";
  return "Ingresar combinada";
}

function formatFechaCorta(d: Date): string {
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
