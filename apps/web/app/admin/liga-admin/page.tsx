// /admin/liga-admin — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-liga-admin (líneas 5796-6003).
//
// Vista unificada de la Liga Habla! del mes en curso. Reemplaza al legacy
// /admin/torneos del Lote F (que sigue accesible para auto-import puntual).

import Link from "next/link";
import { obtenerVistaAdminLiga } from "@/lib/services/admin-liga.service";
import { PartidoLigaToggleCells } from "@/components/admin/liga/PartidoLigaToggleCells";

export const dynamic = "force-dynamic";
export const metadata = { title: "Torneo del mes · Admin Habla!" };

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function emojiLiga(liga: string): string {
  const l = liga.toLowerCase();
  if (l.includes("liga 1") || l.includes("perú") || l.includes("peru")) return "🇵🇪";
  return "🏆";
}

function formatHora(d: Date): string {
  const ahora = new Date();
  const dHoy = diaLima(ahora);
  const dPart = diaLima(d);
  const dManana = diaLima(new Date(ahora.getTime() + 86400000));
  const hora = horaLima(d);
  let dia = "";
  if (dPart === dHoy) dia = "Hoy";
  else if (dPart === dManana) dia = "Mañana";
  else {
    const diasSem = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    dia = `${diasSem[d.getDay()]} ${d.getDate()} ${MES_CORTO[d.getMonth()]}`;
  }
  return `${dia} ${hora}`;
}

function diaLima(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function horaLima(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

export default async function AdminLigaAdminPage() {
  const vista = await obtenerVistaAdminLiga();

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Liga</span>
          <span>Torneo del mes</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Torneo · {vista.mesEtiqueta}</h1>
            <p className="admin-page-subtitle">
              {vista.kpis.tipstersCompitiendo.toLocaleString("es-PE")} tipsters · cierre {vista.cierreFechaIso} · S/ 1,250 en premios · Una combinada por partido por jugador
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link href="/admin/liga-verificacion" className="btn btn-ghost btn-sm">
              ✅ Verificación Top 10
            </Link>
            <button type="button" className="btn btn-ghost btn-sm" disabled>📥 Exportar</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Tipsters compitiendo</span>
            <span className="admin-kpi-card-status admin-kpi-status-good" />
          </div>
          <div className="admin-kpi-card-value">{vista.kpis.tipstersCompitiendo.toLocaleString("es-PE")}</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Combinadas finales (1 por partido)</span>
          </div>
          <div className="admin-kpi-card-value">{vista.kpis.combinadasFinales.toLocaleString("es-PE")}</div>
          <div className="admin-kpi-card-target">en {vista.kpis.totalElegibles} partidos elegibles</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Visibles ahora (próx 7d)</span>
            <span className="admin-kpi-card-status admin-kpi-status-good" />
          </div>
          <div className="admin-kpi-card-value">{vista.kpis.visiblesAhora}</div>
          <div className="admin-kpi-card-target">de {vista.kpis.totalElegibles} elegibles</div>
        </div>
        <div className="admin-kpi-card">
          <div className="admin-kpi-card-head">
            <span className="admin-kpi-card-label">Días al cierre</span>
          </div>
          <div className="admin-kpi-card-value">{vista.kpis.diasAlCierre}</div>
          <div className="admin-kpi-card-target">{vista.cierreFechaIso}</div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: "16px 18px", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 13, color: "rgba(0,16,80,.85)" }}>
          <span style={{ color: "rgba(0,16,80,.42)" }}>Origen:</span>
          <Link href="/admin/partidos" style={{ color: "#0052CC", fontWeight: 700 }}>
            Partidos / Filtro 2 ✓
          </Link>
          <span style={{ color: "rgba(0,16,80,.42)" }}>→</span>
          <span>
            <strong>{vista.kpis.totalElegibles} partidos elegibles</strong> esta jornada
          </span>
          <span style={{ color: "rgba(0,16,80,.42)" }}>→</span>
          <span>
            <strong style={{ color: "#FFB800" }}>{vista.kpis.visiblesAhora} visibles ahora</strong> (regla 7 días)
          </span>
        </div>
      </div>

      {vista.avisos.length > 0 && (
        <div style={{ background: "linear-gradient(90deg, #FFFAEB, #fff)", border: "1px solid #FFB800", borderRadius: 8, padding: 18, marginBottom: 18 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "#7A4A00", textTransform: "uppercase", marginBottom: 10 }}>
            ⚡ Avisos del sistema
          </h3>
          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
            {vista.avisos.map((a) => (
              <li key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, padding: 10, background: "#fff", borderRadius: 6 }}>
                <div>
                  <strong style={{ color: "#001050" }}>{a.equipos}</strong> · {a.liga} · {formatHora(a.fechaInicio)}
                  <br />
                  <span style={{ color: "rgba(0,16,80,.58)", fontSize: 12 }}>{a.mensaje}</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {a.tipo === "analisis_pendiente" ? (
                    <Link href={`/admin/picks?id=${a.partidoId}`} className="btn btn-aprobar btn-xs">
                      Ir a validar
                    </Link>
                  ) : (
                    <Link href="/admin/partidos" className="btn btn-secondary btn-xs">
                      Forzar visible
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color: "#001050", textTransform: "uppercase" }}>
          Partidos elegibles · {vista.kpis.totalElegibles}
        </h3>
        <span style={{ fontSize: 11, color: "rgba(0,16,80,.42)" }}>
          Regla automática: visibles si kickoff ≤ 7 días · gestionable manualmente
        </span>
      </div>
      <table className="admin-table" style={{ marginBottom: 18 }}>
        <thead>
          <tr>
            <th>Liga · Hora</th>
            <th>Partido</th>
            <th className="center" style={{ textAlign: "center" }}>Visible al público</th>
            <th className="center" style={{ textAlign: "center" }}>Combinadas</th>
            <th className="center" style={{ textAlign: "center" }}>Estado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vista.partidosElegibles.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "rgba(0,16,80,.42)" }}>
                No hay partidos elegibles este mes. Activá Filtro 2 desde /admin/partidos.
              </td>
            </tr>
          )}
          {vista.partidosElegibles.map((p) => (
            <tr key={p.id} style={{ background: !p.visibleAlPublico ? "#F8FAFD" : undefined }}>
              <td>
                <div style={{ fontSize: 10, color: "rgba(0,16,80,.58)", textTransform: "uppercase", fontWeight: 700 }}>
                  {emojiLiga(p.liga)} {p.liga}
                </div>
                <div style={{ fontWeight: 700, color: "#001050" }}>{formatHora(p.fechaInicio)}</div>
              </td>
              <td>
                {p.equipoLocal} vs {p.equipoVisita}
              </td>
              <PartidoLigaToggleCells
                partidoId={p.id}
                visible={p.visibleAlPublico}
                visibilidadOverride={p.visibilidadOverride}
                combinadas={p.combinadas}
                estadoMatch={p.estadoMatch}
              />
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 18, marginBottom: 18 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "#001050", textTransform: "uppercase", marginBottom: 14 }}>
          📊 Cómo usan los jugadores la Liga · referidos a otras páginas
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
          {vista.referidos.map((r) => (
            <div key={r.label} className="admin-kpi-card">
              <div className="admin-kpi-card-head">
                <span className="admin-kpi-card-label">{r.label}</span>
                <span className={`admin-kpi-card-status admin-kpi-status-${r.estado}`} />
              </div>
              <div className="admin-kpi-card-value">{r.valor}</div>
              <div className="admin-kpi-card-target">{r.meta}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.5 }}>
          📌 La Liga es el motor de tráfico hacia el resto de la app. La medición exacta del funnel se cablea en el Lote P.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 18 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "#001050", textTransform: "uppercase", marginBottom: 14 }}>
            Reparto de premios · S/ 1,250
          </h3>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              <tr style={{ borderBottom: "1px solid rgba(0,16,80,.06)" }}>
                <td style={{ padding: "8px 0" }}>1° lugar</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "#FFB800" }}>S/ 500 + 12m Socios</td>
              </tr>
              <tr style={{ borderBottom: "1px solid rgba(0,16,80,.06)" }}>
                <td style={{ padding: "8px 0" }}>2° - 3°</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>S/ 200 c/u + 6m Socios</td>
              </tr>
              <tr>
                <td style={{ padding: "8px 0" }}>4° - 10°</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>S/ 50 c/u + 1m Socios</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "#001050", textTransform: "uppercase" }}>
              Top 10 actual
            </h3>
            <Link href="/admin/liga-verificacion" style={{ fontSize: 11, fontWeight: 700, color: "#0052CC" }}>
              Ver verificación →
            </Link>
          </div>
          <table style={{ width: "100%", fontSize: 12 }}>
            <tbody>
              {vista.top10.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: "center", color: "rgba(0,16,80,.42)", fontSize: 11, padding: "8px 0" }}>
                    Sin Top 10 todavía. Aparecerá cuando haya tickets finalizados del mes.
                  </td>
                </tr>
              )}
              {vista.top10.map((r) => {
                const medalla = r.posicion === 1 ? "🥇 1°" : r.posicion === 2 ? "🥈 2°" : r.posicion === 3 ? "🥉 3°" : `${r.posicion}°`;
                const colorPuntos = r.posicion <= 3 ? "#0052CC" : "#001050";
                return (
                  <tr key={r.posicion} style={{ borderBottom: "1px solid rgba(0,16,80,.06)" }}>
                    <td style={{ padding: "6px 0" }}>{medalla}</td>
                    <td>@{r.username}</td>
                    <td style={{ textAlign: "right", fontWeight: 700, color: colorPuntos }}>{r.puntos}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
