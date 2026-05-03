"use client";

// PicksColaViewV32 — Lote O (May 2026): port literal del mockup
// `docs/habla-mockup-v3.2.html` § admin-page-picks (líneas 6898-7105).
// HTML idéntico al mockup, clases del mockup (picks-layout / picks-cola /
// picks-cola-tabs / picks-cola-tab / picks-cola-list / pick-cola-item /
// pick-detalle / pick-detalle-header / tab-btn / pick-content /
// pick-detalle-actions / btn-aprobar / btn-rechazar / kbd-hint).
//
// Tabs del análisis (Free / Socios) gestionados client-side. Atajos de
// teclado A/R/G/⇧A/⇧R/⇧G según el mockup. Los flujos:
//   - Aprobar Free  → POST /api/v1/admin/partidos/[id]/aprobar-analisis
//   - Rechazar Free → POST /api/v1/admin/partidos/[id]/rechazar-analisis
//   - Aprobar Socios + enviar al canal → POST /api/v1/admin/picks-premium/[id]/aprobar
//   - Rechazar Socios → POST /api/v1/admin/picks-premium/[id]/rechazar

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { authedFetch } from "@/lib/api-client";
import type {
  ColaDetallePartido,
  ColaPartidoFila,
  ContadoresColaV32,
  FiltroEstadoCola,
} from "@/lib/services/admin-cola-validacion.service";

type TabPick = "free" | "socios";

const TABS_COLA: ReadonlyArray<{ value: FiltroEstadoCola; label: string }> = [
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "APROBADO", label: "Aprobados" },
  { value: "RECHAZADO", label: "Rechazados" },
  { value: "TODOS", label: "Todos" },
];

interface Props {
  cola: ColaPartidoFila[];
  detalle: ColaDetallePartido | null;
  contadores: ContadoresColaV32;
  filtroEstado: FiltroEstadoCola;
}

export function PicksColaViewV32({ cola, detalle, contadores, filtroEstado }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabPick>("free");
  const [textoFree, setTextoFree] = useState(detalle?.free?.analisisBasico ?? "");
  const [textoSocios, setTextoSocios] = useState(detalle?.socios?.razonamiento ?? "");
  const [aprobandoFree, setAprobandoFree] = useState(false);
  const [aprobandoSocios, setAprobandoSocios] = useState(false);
  const [rechazandoFree, setRechazandoFree] = useState(false);
  const [rechazandoSocios, setRechazandoSocios] = useState(false);

  // Reset textos cuando cambia el partido activo. La dep es solo el id —
  // los textos los resincronizamos a propósito desde el server (no
  // queremos refrescar mientras el editor está escribiendo).
  useEffect(() => {
    setTextoFree(detalle?.free?.analisisBasico ?? "");
    setTextoSocios(detalle?.socios?.razonamiento ?? "");
    setTab("free");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detalle?.partidoId]);

  const aprobarFree = useCallback(async () => {
    if (!detalle?.free || aprobandoFree) return;
    setAprobandoFree(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/partidos/${detalle.partidoId}/aprobar-analisis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analisisBasico: textoFree }),
        },
      );
      if (!res.ok) throw new Error("Falló");
      router.refresh();
    } catch {
      // noop
    } finally {
      setAprobandoFree(false);
    }
  }, [detalle, textoFree, aprobandoFree, router]);

  const rechazarFree = useCallback(async () => {
    if (!detalle?.free || rechazandoFree) return;
    const motivo = window.prompt("Motivo del rechazo Free:");
    if (!motivo || motivo.trim().length === 0) return;
    setRechazandoFree(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/partidos/${detalle.partidoId}/rechazar-analisis`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivo.trim() }),
        },
      );
      if (!res.ok) throw new Error("Falló");
      router.refresh();
    } catch {
      // noop
    } finally {
      setRechazandoFree(false);
    }
  }, [detalle, rechazandoFree, router]);

  const aprobarSocios = useCallback(async () => {
    if (!detalle?.socios || aprobandoSocios) return;
    setAprobandoSocios(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/picks-premium/${detalle.socios.pickId}/aprobar`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) throw new Error("Falló");
      router.refresh();
    } catch {
      // noop
    } finally {
      setAprobandoSocios(false);
    }
  }, [detalle, aprobandoSocios, router]);

  const rechazarSocios = useCallback(async () => {
    if (!detalle?.socios || rechazandoSocios) return;
    const motivo = window.prompt("Motivo del rechazo Socios:");
    if (!motivo || motivo.trim().length === 0) return;
    setRechazandoSocios(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/picks-premium/${detalle.socios.pickId}/rechazar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivo.trim() }),
        },
      );
      if (!res.ok) throw new Error("Falló");
      router.refresh();
    } catch {
      // noop
    } finally {
      setRechazandoSocios(false);
    }
  }, [detalle, rechazandoSocios, router]);

  // Atajos de teclado
  useEffect(() => {
    function isFormElement(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      return false;
    }
    function onKey(e: KeyboardEvent) {
      if (isFormElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (e.shiftKey) {
        if (key === "a") {
          e.preventDefault();
          void aprobarSocios();
        } else if (key === "r") {
          e.preventDefault();
          void rechazarSocios();
        }
        return;
      }
      if (key === "a") {
        e.preventDefault();
        void aprobarFree();
      } else if (key === "r") {
        e.preventDefault();
        void rechazarFree();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aprobarFree, rechazarFree, aprobarSocios, rechazarSocios]);

  return (
    <div className="picks-layout">
      <div className="picks-cola">
        <div className="picks-cola-tabs">
          {TABS_COLA.map((t) => {
            const counter =
              t.value === "PENDIENTE"
                ? contadores.pendientes
                : t.value === "APROBADO"
                  ? contadores.aprobados
                  : t.value === "RECHAZADO"
                    ? contadores.rechazados
                    : contadores.todos;
            const active = t.value === filtroEstado;
            return (
              <Link
                key={t.value}
                href={`/admin/picks?estado=${t.value}`}
                className={`picks-cola-tab${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {t.label}
                {t.value === "PENDIENTE" && counter > 0 && (
                  <span className="picks-cola-tab-counter">{counter}</span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="picks-cola-list">
          {cola.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "rgba(0,16,80,.42)", fontSize: 13 }}>
              {filtroEstado === "PENDIENTE" ? "Cola vacía. Próxima generación: cron cada 4h." : "Sin partidos en este filtro."}
            </div>
          )}
          {cola.map((p) => {
            const active = detalle?.partidoId === p.partidoId;
            const meta = formatMetaPick(p.fechaInicio, p.liga);
            return (
              <Link
                key={p.partidoId}
                href={`/admin/picks?estado=${filtroEstado}&id=${p.partidoId}`}
                className={`pick-cola-item${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <div className="pick-cola-meta">{meta}</div>
                <div className="pick-cola-equipos">
                  {p.equipoLocal} vs {p.equipoVisita}
                </div>
                <div className="pick-cola-mercado">
                  <span
                    className={`adm-pill ${p.estadoFree === "APROBADO" ? "adm-pill-blue" : p.estadoFree === "PENDIENTE" || p.estadoFree === "SIN_GENERAR" ? "adm-pill-amber" : p.estadoFree === "RECHAZADO" ? "adm-pill-red" : "adm-pill-gray"}`}
                    style={{ fontSize: 9 }}
                  >
                    {p.estadoFree === "APROBADO" ? "Free ✓" : p.estadoFree === "RECHAZADO" ? "Free rechazado" : p.estadoFree === "ARCHIVADO" ? "Free archivado" : "Free pendiente"}
                  </span>{" "}
                  <span
                    className={`adm-pill ${p.estadoSocios === "APROBADO" || p.estadoSocios === "EDITADO_Y_APROBADO" ? "adm-pill-blue" : p.estadoSocios === "PENDIENTE" || p.estadoSocios === "SIN_GENERAR" ? "adm-pill-amber" : "adm-pill-red"}`}
                    style={{ fontSize: 9 }}
                  >
                    {p.estadoSocios === "APROBADO" || p.estadoSocios === "EDITADO_Y_APROBADO" ? "Socios ✓" : p.estadoSocios === "RECHAZADO" ? "Socios rechazado" : "Socios pendiente"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pick-detalle">
        {!detalle ? (
          <div style={{ padding: 40, textAlign: "center", color: "rgba(0,16,80,.42)" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>✓</div>
            <div style={{ fontSize: 14, color: "#001050", fontWeight: 700 }}>Selecciona un partido de la cola</div>
          </div>
        ) : (
          <>
            <div className="pick-detalle-header">
              <div className="pick-detalle-title-block">
                <h3>
                  {detalle.equipoLocal} vs {detalle.equipoVisita}
                </h3>
                <div className="pick-detalle-meta">
                  {detalle.liga} · {formatHoraDetalle(detalle.fechaInicio)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span className={`adm-pill ${detalle.filtro1 ? "adm-pill-blue" : "adm-pill-gray"}`}>
                  Filtro 1 {detalle.filtro1 ? "✓" : "✗"}
                </span>
                <span className={`adm-pill ${detalle.filtro2 ? "adm-pill-amber" : "adm-pill-gray"}`}>
                  Filtro 2 {detalle.filtro2 ? "✓" : "✗"}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid rgba(0,16,80,.06)", marginBottom: 18 }}>
              <button
                type="button"
                className={`tab-btn${tab === "free" ? " active" : ""}`}
                onClick={() => setTab("free")}
                data-pick-tab="free"
              >
                📊 Análisis Free (1X2)
              </button>
              <button
                type="button"
                className={`tab-btn${tab === "socios" ? " active" : ""}`}
                onClick={() => setTab("socios")}
                data-pick-tab="socios"
              >
                💎 Análisis Socios (combinada)
              </button>
            </div>

            {tab === "free" && (
              <div className="pick-content" id="pick-tab-free">
                <div style={{ background: "rgba(0,82,204,.04)", borderLeft: "3px solid #0052CC", padding: "12px 14px", borderRadius: "0 6px 6px 0", marginBottom: 18, fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#001050" }}>Análisis Free:</strong> visible para todos. Solo 1X2 + probabilidades + mejor cuota + redacción explicativa corta.
                </div>

                {detalle.free ? (
                  <>
                    <div style={{ background: "#F8FAFD", border: "1px dashed rgba(0,16,80,.16)", borderRadius: 6, padding: 14, marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(0,16,80,.42)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
                        🔒 Datos del motor · no editable
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                        <DatoLocal {...detalle.free} />
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#001050", textTransform: "uppercase", letterSpacing: ".04em" }}>
                          ✏️ Redacción explicativa (editable)
                        </label>
                        <span style={{ fontSize: 11, color: "rgba(0,16,80,.42)" }}>{contarPalabras(textoFree)}/120 palabras</span>
                      </div>
                      <textarea
                        style={{ width: "100%", minHeight: 90, padding: 12, border: "1px solid rgba(0,16,80,.16)", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.5, color: "#001050", resize: "vertical" }}
                        placeholder="Redacción corta para el resumen ejecutivo Free..."
                        value={textoFree}
                        onChange={(e) => setTextoFree(e.target.value)}
                      />
                      <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)", marginTop: 4 }}>
                        Esta es la única parte editable. Los datos numéricos los genera el motor automáticamente.
                      </div>
                    </div>
                    <div className="pick-detalle-actions">
                      <button
                        className="btn btn-rechazar btn-block"
                        type="button"
                        onClick={rechazarFree}
                        disabled={rechazandoFree}
                      >
                        Rechazar Free <span className="kbd-hint">R</span>
                      </button>
                      <button className="btn btn-ghost btn-block" type="button" disabled>
                        Re-generar redacción <span className="kbd-hint">G</span>
                      </button>
                      <button
                        className="btn btn-aprobar btn-block"
                        type="button"
                        onClick={aprobarFree}
                        disabled={aprobandoFree}
                      >
                        Aprobar Free <span className="kbd-hint">A</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 24, textAlign: "center", color: "rgba(0,16,80,.42)" }}>
                    Sin AnalisisPartido generado. Activa Filtro 1 desde /admin/partidos para disparar la generación.
                  </div>
                )}
              </div>
            )}

            {tab === "socios" && (
              <div className="pick-content" id="pick-tab-socios">
                <div style={{ background: "rgba(255,184,0,.06)", borderLeft: "3px solid #FFB800", padding: "12px 14px", borderRadius: "0 6px 6px 0", marginBottom: 18, fontSize: 12, color: "rgba(0,16,80,.58)", lineHeight: 1.5 }}>
                  <strong style={{ color: "#7A4A00" }}>Análisis Socios:</strong> solo para suscriptores. Combinada con value, stake, EV+, mercados secundarios + razonamiento detallado. La redacción es lo único editable.
                </div>

                {detalle.socios ? (
                  <>
                    <div style={{ background: "#FFFAEB", border: "1px dashed #FFB800", borderRadius: 6, padding: 14, marginBottom: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#7A4A00", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>
                        🔒 Datos del motor · no editable
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                        <div>
                          <div style={{ fontSize: 10, color: "rgba(0,16,80,.58)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                            Combinada principal
                          </div>
                          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 800, color: "#001050" }}>
                            {labelMercado(detalle.socios.mercado, detalle.socios.outcome)}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(0,16,80,.85)", marginTop: 4 }}>
                            @ {detalle.socios.cuotaSugerida.toFixed(2)} ·{" "}
                            {detalle.socios.casaRecomendada?.nombre ?? "Sin casa"} · Stake{" "}
                            {(detalle.socios.stakeSugerido * 100).toFixed(1)}%
                            {detalle.socios.evPctSugerido !== null && (
                              <>
                                {" "}
                                · EV+ {(detalle.socios.evPctSugerido * 100).toFixed(1)}%
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: "rgba(0,16,80,.58)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>
                            Estado actual
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(0,16,80,.85)" }}>
                            {detalle.socios.estado === "APROBADO" || detalle.socios.estado === "EDITADO_Y_APROBADO" ? "✅ Aprobado" : detalle.socios.estado === "RECHAZADO" ? "❌ Rechazado" : "⏳ Pendiente"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <label style={{ fontSize: 11, fontWeight: 800, color: "#001050", textTransform: "uppercase", letterSpacing: ".04em" }}>
                          ✏️ Razonamiento detallado (editable)
                        </label>
                        <span style={{ fontSize: 11, color: "rgba(0,16,80,.42)" }}>{contarPalabras(textoSocios)}/180 palabras</span>
                      </div>
                      <textarea
                        style={{ width: "100%", minHeight: 140, padding: 12, border: "1px solid rgba(0,16,80,.16)", borderRadius: 6, fontFamily: "'DM Sans', sans-serif", fontSize: 13, lineHeight: 1.5, color: "#001050", resize: "vertical" }}
                        value={textoSocios}
                        onChange={(e) => setTextoSocios(e.target.value)}
                      />
                      <div style={{ fontSize: 11, color: "rgba(0,16,80,.42)", marginTop: 4 }}>
                        El razonamiento se distribuye en el sitio (página de partido para Socios) + canal WhatsApp.
                      </div>
                    </div>

                    <div className="pick-detalle-actions">
                      <button
                        className="btn btn-rechazar btn-block"
                        type="button"
                        onClick={rechazarSocios}
                        disabled={rechazandoSocios}
                      >
                        Rechazar Socios <span className="kbd-hint">⇧R</span>
                      </button>
                      <button className="btn btn-ghost btn-block" type="button" disabled>
                        Re-generar análisis <span className="kbd-hint">⇧G</span>
                      </button>
                      <button
                        className="btn btn-aprobar btn-block"
                        type="button"
                        onClick={aprobarSocios}
                        disabled={aprobandoSocios}
                      >
                        Aprobar Socios + enviar al canal <span className="kbd-hint">⇧A</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 24, textAlign: "center", color: "rgba(0,16,80,.42)" }}>
                    Sin PickPremium generado para este partido. La generación de Socios se dispara desde el cron del Lote E o desde /admin/partidos al activar Filtro 1.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function DatoLocal({ probabilidades, mejorCuota }: { probabilidades: { local: number; empate: number; visita: number }; mejorCuota: { mercado: "LOCAL" | "EMPATE" | "VISITA"; cuota: number; casa: string } }) {
  const localBest = mejorCuota.mercado === "LOCAL";
  const empateBest = mejorCuota.mercado === "EMPATE";
  const visitaBest = mejorCuota.mercado === "VISITA";
  return (
    <>
      <div style={{ textAlign: "center", background: "#fff", padding: 10, borderRadius: 6, border: localBest ? "1.5px solid #0052CC" : undefined }}>
        <div style={{ fontSize: 10, color: "rgba(0,16,80,.58)", textTransform: "uppercase", fontWeight: 700 }}>{localBest ? "Local ✓ Top" : "Local"}</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900, color: localBest ? "#0052CC" : "#001050" }}>
          {Math.round(probabilidades.local * 100)}%
        </div>
        <div style={{ fontSize: 11, color: "rgba(0,16,80,.85)" }}>{localBest ? `@ ${mejorCuota.cuota.toFixed(2)} · ${mejorCuota.casa}` : "—"}</div>
      </div>
      <div style={{ textAlign: "center", background: "#fff", padding: 10, borderRadius: 6, border: empateBest ? "1.5px solid #0052CC" : undefined }}>
        <div style={{ fontSize: 10, color: "rgba(0,16,80,.58)", textTransform: "uppercase", fontWeight: 700 }}>{empateBest ? "Empate ✓ Top" : "Empate"}</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900, color: empateBest ? "#0052CC" : "#001050" }}>
          {Math.round(probabilidades.empate * 100)}%
        </div>
        <div style={{ fontSize: 11, color: "rgba(0,16,80,.85)" }}>{empateBest ? `@ ${mejorCuota.cuota.toFixed(2)} · ${mejorCuota.casa}` : "—"}</div>
      </div>
      <div style={{ textAlign: "center", background: "#fff", padding: 10, borderRadius: 6, border: visitaBest ? "1.5px solid #0052CC" : undefined }}>
        <div style={{ fontSize: 10, color: "rgba(0,16,80,.58)", textTransform: "uppercase", fontWeight: 700 }}>{visitaBest ? "Visita ✓ Top" : "Visita"}</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900, color: visitaBest ? "#0052CC" : "#001050" }}>
          {Math.round(probabilidades.visita * 100)}%
        </div>
        <div style={{ fontSize: 11, color: "rgba(0,16,80,.85)" }}>{visitaBest ? `@ ${mejorCuota.cuota.toFixed(2)} · ${mejorCuota.casa}` : "—"}</div>
      </div>
    </>
  );
}

function contarPalabras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function labelMercado(mercado: string, outcome: string): string {
  if (mercado === "RESULTADO_1X2") {
    if (outcome === "home") return "Local";
    if (outcome === "draw") return "Empate";
    if (outcome === "away") return "Visita";
  }
  if (mercado === "BTTS") return outcome === "btts_si" ? "BTTS Sí" : "BTTS No";
  if (mercado === "OVER_UNDER_25") return outcome === "over" ? "Más 2.5 goles" : "Menos 2.5 goles";
  if (mercado === "TARJETA_ROJA") return outcome === "roja_si" ? "Tarjeta roja: Sí" : "Tarjeta roja: No";
  if (mercado === "MARCADOR_EXACTO") return `Marcador ${outcome}`;
  return `${mercado} · ${outcome}`;
}

function formatMetaPick(fecha: Date, liga: string): string {
  const dHoy = diaLima(new Date());
  const dManana = diaLima(new Date(Date.now() + 86400000));
  const dPart = diaLima(fecha);
  const hora = horaLima(fecha);
  const emoji = liga.toLowerCase().includes("perú") || liga.toLowerCase().includes("peru") || liga.toLowerCase().includes("liga 1") ? "🇵🇪" : "🏆";
  let dia = "";
  if (dPart === dHoy) dia = "Hoy";
  else if (dPart === dManana) dia = "Mañana";
  else {
    const diasSem = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    dia = `${diasSem[fecha.getDay()]} ${fecha.getDate()}`;
  }
  return `${emoji} ${liga} · ${dia} ${hora}`;
}

function formatHoraDetalle(fecha: Date): string {
  const diasSem = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  return `${diasSem[fecha.getDay()]} ${horaLima(fecha)} hora Lima`;
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
