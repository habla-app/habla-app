// LigaSeccion — Lote Q v3.2 (May 2026): port 1:1 desde
// docs/habla-mockup-v3.2.html § page-liga-list (.liga-section).
//
// Mockup line 3296-3515: 3 secciones con misma estructura:
//   .section-bar (icon + título + subtítulo)
//   table.liga-table (desktop) + .liga-cards-mobile (mobile)
//
// Variantes:
//   - "proximo": columnas "Liga·Hora", "Partido", "Tipsters", "Mi predicción", CTA
//   - "vivo":    columnas "Min", "Partido", "Tipsters", "Mi posición", "Mis puntos", CTA
//   - "terminado": columnas "Liga", "Resultado", "Tipsters", "Top tipster", "Mis puntos", CTA

import Link from "next/link";
import type { PartidoLigaItem } from "@/lib/services/liga.service";

interface Props {
  /** Título antes de cualquier emoji. El icono va en .section-bar-icon. */
  titulo: string;
  subtitulo?: string;
  /** Emoji/símbolo para .section-bar-icon. */
  icono: string;
  partidos: PartidoLigaItem[];
  variante: "proximo" | "vivo" | "terminado";
  /** Mensaje cuando no hay partidos en la sección. */
  vacio?: string;
}

export function LigaSeccion({
  titulo,
  subtitulo,
  icono,
  partidos,
  variante,
  vacio,
}: Props) {
  if (partidos.length === 0 && !vacio) return null;

  return (
    <section className="liga-section" aria-label={titulo}>
      <div className="section-bar">
        <div className="section-bar-left">
          <div className="section-bar-icon">{icono}</div>
          <div>
            <div className="section-bar-title">{titulo}</div>
            {subtitulo ? (
              <div className="section-bar-subtitle">{subtitulo}</div>
            ) : null}
          </div>
        </div>
      </div>

      {partidos.length === 0 ? (
        <p
          style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "16px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--text-muted-d)",
          }}
        >
          {vacio}
        </p>
      ) : (
        <>
          <TablaDesktop partidos={partidos} variante={variante} />
          <CardsMobile partidos={partidos} variante={variante} />
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Desktop table
// ---------------------------------------------------------------------------

function TablaDesktop({
  partidos,
  variante,
}: {
  partidos: PartidoLigaItem[];
  variante: "proximo" | "vivo" | "terminado";
}) {
  return (
    <table className="liga-table">
      <thead>
        {variante === "proximo" ? (
          <tr>
            <th>Liga · Hora</th>
            <th>Partido</th>
            <th className="center">Tipsters</th>
            <th className="center">Mi predicción</th>
            <th></th>
          </tr>
        ) : variante === "vivo" ? (
          <tr>
            <th>Min</th>
            <th>Partido</th>
            <th className="center">Tipsters</th>
            <th className="center">Mi posición</th>
            <th className="center">Mis puntos</th>
            <th></th>
          </tr>
        ) : (
          <tr>
            <th>Liga</th>
            <th>Resultado</th>
            <th className="center">Tipsters</th>
            <th>Top tipster</th>
            <th className="center">Mis puntos</th>
            <th></th>
          </tr>
        )}
      </thead>
      <tbody>
        {partidos.map((p) => (
          <FilaPartido key={p.id} partido={p} variante={variante} />
        ))}
      </tbody>
    </table>
  );
}

function FilaPartido({
  partido,
  variante,
}: {
  partido: PartidoLigaItem;
  variante: "proximo" | "vivo" | "terminado";
}) {
  const ligaShort = formatLigaCorta(partido.liga);

  if (variante === "proximo") {
    const cta = partido.miEstadoCombinada === "predicha" ? "Modificar ✏️" : "Ingresar combinada";
    const ctaClass = partido.miEstadoCombinada === "predicha" ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm";
    return (
      <tr>
        <td>
          <div className="cell-liga">{ligaShort}</div>
          <div className="cell-hora">{formatHoraRelativa(partido.fechaInicio)}</div>
        </td>
        <td>
          <div className="cell-equipos">
            {partido.equipoLocal} <span className="vs">vs</span> {partido.equipoVisita}
          </div>
        </td>
        <td className="center">{partido.totalInscritos}</td>
        <td className="center">
          {partido.miEstadoCombinada === "predicha" ? (
            <span className="badge badge-green">Predecida ✓</span>
          ) : (
            <span className="badge badge-gray">Sin predecir</span>
          )}
        </td>
        <td>
          <Link href={`/liga/${partido.slug}?modal=1`} className={ctaClass}>
            {cta}
          </Link>
        </td>
      </tr>
    );
  }

  if (variante === "vivo") {
    return (
      <tr>
        <td>
          <span className="estado-badge estado-vivo">
            <span className="live-dot" style={{ background: "#fff" }} /> {partido.liveElapsed ?? "—"}&apos;
          </span>
          <div className="cell-liga" style={{ marginTop: 4 }}>
            {ligaShort}
          </div>
        </td>
        <td>
          <div className="cell-equipos">
            {partido.equipoLocal} {partido.golesLocal !== null ? partido.golesLocal : ""} -{" "}
            {partido.golesVisita !== null ? partido.golesVisita : ""} {partido.equipoVisita}
          </div>
        </td>
        <td className="center">{partido.totalInscritos}</td>
        <td className="center">
          <strong>{partido.miPosicion !== null ? `#${partido.miPosicion}` : "—"}</strong>
        </td>
        <td className="center">
          <span className="rank-pts">
            {partido.miPuntos !== null ? `${partido.miPuntos} pts` : "—"}
          </span>
        </td>
        <td>
          <Link href={`/liga/${partido.slug}`} className="btn btn-secondary btn-sm">
            Ver ranking →
          </Link>
        </td>
      </tr>
    );
  }

  // terminado
  return (
    <tr>
      <td>
        <span className="estado-badge estado-fin">FIN</span>
        <div className="cell-liga" style={{ marginTop: 4 }}>
          {ligaShort}
        </div>
      </td>
      <td>
        <div className="cell-equipos">
          {partido.equipoLocal} {partido.golesLocal !== null ? partido.golesLocal : ""} -{" "}
          {partido.golesVisita !== null ? partido.golesVisita : ""} {partido.equipoVisita}
        </div>
      </td>
      <td className="center">{partido.totalInscritos}</td>
      <td>
        <strong>—</strong>
      </td>
      <td className="center">
        {partido.miPuntos !== null ? (
          <span className="rank-pts">{partido.miPuntos} pts</span>
        ) : (
          <span style={{ color: "var(--text-muted-d)" }}>—</span>
        )}
      </td>
      <td>
        <Link href={`/liga/${partido.slug}`} className="btn btn-ghost btn-sm">
          Ver →
        </Link>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Mobile cards
// ---------------------------------------------------------------------------

function CardsMobile({
  partidos,
  variante,
}: {
  partidos: PartidoLigaItem[];
  variante: "proximo" | "vivo" | "terminado";
}) {
  return (
    <div className="liga-cards-mobile">
      {partidos.map((p) => (
        <CardPartido key={p.id} partido={p} variante={variante} />
      ))}
    </div>
  );
}

function CardPartido({
  partido,
  variante,
}: {
  partido: PartidoLigaItem;
  variante: "proximo" | "vivo" | "terminado";
}) {
  const ligaShort = formatLigaCorta(partido.liga);

  if (variante === "proximo") {
    const cta = partido.miEstadoCombinada === "predicha" ? "Modificar ✏️" : "Ingresar combinada";
    const ctaClass = partido.miEstadoCombinada === "predicha" ? "btn btn-ghost btn-sm" : "btn btn-primary btn-sm";
    return (
      <div className="liga-mobile-card">
        <div className="liga-mobile-card-row">
          <div className="cell-liga">
            {ligaShort} · {formatHoraRelativa(partido.fechaInicio)}
          </div>
          {partido.miEstadoCombinada === "predicha" ? (
            <span className="badge badge-green">Predecida ✓</span>
          ) : (
            <span className="badge badge-gray">Sin predecir</span>
          )}
        </div>
        <div className="cell-equipos liga-mobile-card-equipos">
          {partido.equipoLocal} vs {partido.equipoVisita}
        </div>
        <div className="liga-mobile-card-foot">
          <span style={{ fontSize: 12, color: "var(--text-muted-d)" }}>
            {partido.totalInscritos} tipsters
          </span>
          <Link href={`/liga/${partido.slug}?modal=1`} className={ctaClass}>
            {cta}
          </Link>
        </div>
      </div>
    );
  }

  if (variante === "vivo") {
    return (
      <div className="liga-mobile-card live">
        <div className="liga-mobile-card-row">
          <span className="estado-badge estado-vivo">
            <span className="live-dot" style={{ background: "#fff" }} /> {partido.liveElapsed ?? "—"}
            &apos; · {ligaShort.replace(/^[^\s]+\s/, "")}
          </span>
        </div>
        <div className="cell-equipos liga-mobile-card-equipos" style={{ marginBottom: 6 }}>
          {partido.equipoLocal}{" "}
          <span style={{ color: "var(--blue-main)", fontWeight: 900 }}>
            {partido.golesLocal !== null ? partido.golesLocal : ""}
          </span>{" "}
          -{" "}
          <span style={{ color: "var(--text-dark)", fontWeight: 900 }}>
            {partido.golesVisita !== null ? partido.golesVisita : ""}
          </span>{" "}
          {partido.equipoVisita}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 6,
            fontSize: 11,
            background: "var(--bg-subtle)",
            padding: 8,
            borderRadius: 6,
            margin: "8px 0",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-muted-d)" }}>Tipsters</div>
            <strong>{partido.totalInscritos}</strong>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-muted-d)" }}>Mi pos</div>
            <strong>{partido.miPosicion !== null ? `#${partido.miPosicion}` : "—"}</strong>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "var(--text-muted-d)" }}>Mis pts</div>
            <strong style={{ color: "var(--blue-main)" }}>{partido.miPuntos ?? 0}</strong>
          </div>
        </div>
        <Link
          href={`/liga/${partido.slug}`}
          className="btn btn-secondary btn-sm btn-block"
        >
          Ver ranking en vivo →
        </Link>
      </div>
    );
  }

  // terminado
  return (
    <div className="liga-mobile-card finalizado">
      <div className="liga-mobile-card-row">
        <span className="estado-badge estado-fin">FIN · {ligaShort.replace(/^[^\s]+\s/, "")}</span>
        {partido.miPuntos !== null ? (
          <span className="rank-pts">+{partido.miPuntos} pts</span>
        ) : null}
      </div>
      <div className="cell-equipos liga-mobile-card-equipos">
        {partido.equipoLocal} {partido.golesLocal !== null ? partido.golesLocal : ""} -{" "}
        {partido.golesVisita !== null ? partido.golesVisita : ""} {partido.equipoVisita}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted-d)", marginBottom: 8 }}>
        {partido.totalInscritos} tipsters
      </div>
      <Link href={`/liga/${partido.slug}`} className="btn btn-ghost btn-sm btn-block">
        Ver resultados →
      </Link>
    </div>
  );
}

function formatLigaCorta(liga: string): string {
  const lower = liga.toLowerCase();
  if (lower.includes("liga 1") || lower.includes("perú")) return `🇵🇪 ${liga}`;
  return `🏆 ${liga}`;
}

function formatHoraRelativa(d: Date): string {
  const ahoraLima = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Lima" }),
  );
  const fechaLima = new Date(d.toLocaleString("en-US", { timeZone: "America/Lima" }));
  const hoy = ahoraLima.toDateString();
  const manana = new Date(ahoraLima.getTime() + 24 * 60 * 60 * 1000).toDateString();
  const hora = d.toLocaleTimeString("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (fechaLima.toDateString() === hoy) return `Hoy ${hora}`;
  if (fechaLima.toDateString() === manana) return `Mañana ${hora}`;
  return d.toLocaleString("es-PE", {
    timeZone: "America/Lima",
    weekday: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
