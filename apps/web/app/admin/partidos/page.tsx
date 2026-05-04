// /admin/partidos — Lote O (May 2026): vista NUEVA · pipeline de filtros
// y gestión 3-flags. Port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-partidos (líneas 5283-5519).
//
// HTML idéntico al mockup, clases del mockup (admin-topbar / admin-filtros /
// admin-table / adm-pill-* / toggle-switch). Estilos inline donde el mockup
// los usa (cards del pipeline visual con gradientes específicos, celdas con
// background tinted por filtro).
//
// Mutaciones de Filtro 1 / Filtro 2 vía PATCH /api/v1/admin/partidos/[id]/filtros
// (existente desde Lote L). Auditoría 100% se hace en el endpoint.

import {
  listarPartidosAdmin,
  obtenerLigasPresentesAdmin,
} from "@/lib/services/admin-partidos.service";
import { PartidoFiltrosCells } from "@/components/admin/partidos/PartidoFiltrosCells";
import { ReimportarApiBtn } from "@/components/admin/partidos/ReimportarApiBtn";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partidos · Admin Habla!" };

interface PageProps {
  searchParams?: {
    liga?: string;
    rango?: string;
    f1?: string;
    f2?: string;
    q?: string;
  };
}

const LIMA_TZ = "America/Lima";

function diaLima(d: Date): string {
  // Formato YYYY-MM-DD en TZ Lima
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return partes; // ej. 2026-05-03
}

function horaLima(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function formatHoraLima(fecha: Date): { dia: string; hora: string } {
  const ahora = new Date();
  const dHoy = diaLima(ahora);
  const dPart = diaLima(fecha);
  const dManana = diaLima(new Date(ahora.getTime() + 86400000));

  const hora = horaLima(fecha);
  let dia = "";
  if (dPart === dHoy) dia = "Hoy";
  else if (dPart === dManana) dia = "Mañana";
  else {
    const diasSem = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const diaSem = diasSem[fecha.getDay()];
    dia = `${diaSem} ${fecha.getDate()} ${meses[fecha.getMonth()]}`;
  }
  return { dia: `${dia} ${hora}`, hora };
}

function emojiLiga(liga: string): string {
  const l = liga.toLowerCase();
  if (l.includes("liga 1") || l.includes("perú") || l.includes("peru")) return "🇵🇪";
  return "🏆";
}

export default async function AdminPartidosPage({ searchParams }: PageProps) {
  const ligaFiltro = searchParams?.liga ?? null;
  const rangoStr = searchParams?.rango ?? "7";
  const rangoDias = (rangoStr === "14" ? 14 : rangoStr === "2" ? 2 : 7) as 7 | 14 | 2;
  const f1 = (searchParams?.f1 as "todos" | "apagados" | "visibles" | undefined) ?? "todos";
  const f2 = (searchParams?.f2 as "todos" | "elegibles" | "no_elegibles" | undefined) ?? "todos";
  const q = searchParams?.q ?? null;

  const [{ resumen, filas }, ligas] = await Promise.all([
    listarPartidosAdmin({
      ligaSlug: ligaFiltro,
      rangoDias,
      estadoFiltro1: f1,
      estadoFiltro2: f2,
      searchEquipo: q,
    }),
    obtenerLigasPresentesAdmin(),
  ]);

  return (
    <>
      <div className="admin-topbar">
        <div className="admin-breadcrumbs">
          <span>Inicio</span>
          <span>Motor de Fijas</span>
          <span>Partidos</span>
        </div>
        <div className="admin-topbar-row">
          <div>
            <h1 className="admin-page-title">Gestión de Partidos</h1>
            <p className="admin-page-subtitle">Filtro 1: visibilidad pública · Filtro 2: elegibilidad para Liga Habla!</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <ReimportarApiBtn />
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 20, marginBottom: 18 }}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, fontWeight: 800, color: "#001050", textTransform: "uppercase", marginBottom: 14 }}>
          Pipeline de partidos
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto repeat(2, 1fr)", gap: 10, alignItems: "center" }}>
          <div style={{ background: "#F1F4FB", border: "1px dashed rgba(0,16,80,.16)", borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 700, marginBottom: 4 }}>Fuente</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 900, color: "#001050", lineHeight: 1 }}>{resumen.fuente}</div>
            <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)", marginTop: 4 }}>API-Football</div>
            <div style={{ fontSize: 10, color: "rgba(0,16,80,.42)", marginTop: 2 }}>próximos 7 días · todas ligas</div>
          </div>

          <div style={{ textAlign: "center", color: "rgba(0,16,80,.42)", fontSize: 20 }}>→</div>

          <div style={{ background: "linear-gradient(180deg, #EEF2FF, #fff)", border: "1.5px solid #0052CC", borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#0052CC", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 800, marginBottom: 4 }}>Filtro 1 · Mostrar al público</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 900, color: "#0052CC", lineHeight: 1 }}>{resumen.filtro1}</div>
            <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)", marginTop: 4 }}>Las Fijas (free + socios)</div>
            <div style={{ fontSize: 10, color: "rgba(0,16,80,.42)", marginTop: 2 }}>con 1X2 + análisis</div>
          </div>

          <div style={{ textAlign: "center", color: "rgba(0,16,80,.42)", fontSize: 20 }}>→</div>

          <div style={{ background: "linear-gradient(180deg, #FFFAEB, #fff)", border: "1.5px solid #FFB800", borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#7A4A00", textTransform: "uppercase", letterSpacing: ".04em", fontWeight: 800, marginBottom: 4 }}>Filtro 2 · Elegibles Liga</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 24, fontWeight: 900, color: "#7A4A00", lineHeight: 1 }}>{resumen.filtro2}</div>
            <div style={{ fontSize: 11, color: "rgba(0,16,80,.58)", marginTop: 4 }}>La Liga Habla!</div>
            <div style={{ fontSize: 10, color: "rgba(0,16,80,.42)", marginTop: 2 }}>suman puntos al ranking</div>
          </div>

          <div></div>
          <div></div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto repeat(2, 1fr)", gap: 10, marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)", textAlign: "center", lineHeight: 1.4 }}>Lo que importa el cron cada 6h</div>
          <div></div>
          <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)", textAlign: "center", lineHeight: 1.4 }}>&ldquo;Apagar&rdquo; partidos baja tráfico</div>
          <div></div>
          <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)", textAlign: "center", lineHeight: 1.4 }}>Solo activables si pasaron Filtro 1</div>
          <div></div>
          <div></div>
        </div>
      </div>

      <form action="/admin/partidos" method="get" className="admin-filtros">
        <input className="admin-filter-input" name="q" placeholder="🔎 Equipo o liga..." defaultValue={q ?? ""} />
        <select className="admin-filter-select" name="liga" defaultValue={ligaFiltro ?? ""}>
          <option value="">Liga: todas</option>
          {ligas.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <select className="admin-filter-select" name="rango" defaultValue={rangoStr}>
          <option value="7">Próximos 7 días</option>
          <option value="14">Próximos 14 días</option>
          <option value="2">Hoy + mañana</option>
        </select>
        <select className="admin-filter-select" name="f1" defaultValue={f1}>
          <option value="todos">Pasaron Filtro 1: todos</option>
          <option value="apagados">Apagados (no visible)</option>
          <option value="visibles">Visibles (con análisis)</option>
        </select>
        <select className="admin-filter-select" name="f2" defaultValue={f2}>
          <option value="todos">Filtro 2: todos</option>
          <option value="elegibles">Solo elegibles Liga</option>
          <option value="no_elegibles">No elegibles Liga</option>
        </select>
        <button type="submit" className="btn btn-ghost btn-xs">Aplicar</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Liga · Hora</th>
            <th>Partido</th>
            <th className="center" style={{ textAlign: "center", background: "#EEF2FF", color: "#0052CC" }}>
              Filtro 1<br />
              <span style={{ fontSize: 9, fontWeight: 600 }}>Mostrar público</span>
            </th>
            <th className="center" style={{ textAlign: "center" }}>Análisis Free</th>
            <th className="center" style={{ textAlign: "center" }}>Análisis Socios</th>
            <th className="center" style={{ textAlign: "center", background: "#FFFAEB", color: "#7A4A00" }}>
              Filtro 2<br />
              <span style={{ fontSize: 9, fontWeight: 600 }}>Liga elegible</span>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.length === 0 && (
            <tr>
              <td colSpan={7} style={{ textAlign: "center", padding: 24, color: "rgba(0,16,80,.42)" }}>
                No hay partidos en este rango.
              </td>
            </tr>
          )}
          {filas.map((p) => {
            const { dia } = formatHoraLima(p.fechaInicio);
            return (
              <tr key={p.id}>
                <td>
                  <div style={{ fontSize: 10, textTransform: "uppercase", color: "rgba(0,16,80,.58)", fontWeight: 700 }}>
                    {emojiLiga(p.liga)} {p.liga}
                  </div>
                  <div style={{ fontWeight: 700, color: "#001050" }}>{dia}</div>
                </td>
                <td>
                  <a
                    href={`/admin/partidos/${p.id}`}
                    style={{
                      fontWeight: 700,
                      color: "#001050",
                      textDecoration: "none",
                    }}
                  >
                    {p.equipoLocal} vs {p.equipoVisita}
                  </a>
                  <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)" }}>
                    {p.tipsters > 0
                      ? `${p.tipsters.toLocaleString("es-PE")} tipsters${p.vistas > 0 ? ` · ${p.vistas.toLocaleString("es-PE")} vistas` : ""}`
                      : p.mostrarAlPublico
                        ? "Activo · sin tipsters todavía"
                        : "Importado · sin análisis"}
                  </div>
                </td>
                <PartidoFiltrosCells
                  partidoId={p.id}
                  mostrarAlPublico={p.mostrarAlPublico}
                  elegibleLiga={p.elegibleLiga}
                  estadoAnalisis={p.estadoAnalisis}
                />
                <td>
                  {p.estadoAnalisis === "PENDIENTE" ? (
                    <a href="/admin/picks" className="btn btn-ghost btn-xs" style={{ display: "inline-block" }}>Validar</a>
                  ) : !p.mostrarAlPublico ? (
                    <span className="adm-pill adm-pill-gray" style={{ fontSize: 10 }}>—</span>
                  ) : (
                    <a href="/admin/picks" className="btn btn-ghost btn-xs" style={{ display: "inline-block" }}>Editar</a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ background: "#fff", border: "1px solid rgba(0,16,80,.06)", borderRadius: 8, padding: 16, marginTop: 14, fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.6 }}>
        <strong style={{ color: "#001050", display: "block", marginBottom: 6 }}>Reglas del pipeline:</strong>
        <span style={{ display: "block" }}>📥 <strong>Fuente</strong> es lectura: viene de API-Football, no editable.</span>
        <span style={{ display: "block" }}>🔵 <strong>Filtro 1</strong>: al activarlo, se generan automáticamente análisis Free (1X2) y análisis Socios (combinada + EV+). Ambos van a la cola de validación.</span>
        <span style={{ display: "block" }}>🟡 <strong>Filtro 2</strong>: solo activable si pasó Filtro 1. Habilita el partido para la Liga Habla! (suma puntos al ranking del mes). Para hacerlo visible al usuario, gestiona desde <a href="/admin/liga-admin" style={{ color: "#0052CC", fontWeight: 700 }}>Liga · Torneo</a>.</span>
      </div>
    </>
  );
}
