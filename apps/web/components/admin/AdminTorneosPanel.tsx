"use client";

// Panel interno del admin — herramienta de ops, no replica pixel-perfect
// el mockup (el mockup no tiene pantalla de admin).
//
// Secciones:
//   1. Trigger manual del auto-import de partidos (las ligas y la
//      ventana de 14 días salen de lib/config/ligas.ts — no se elige
//      aquí). El cron in-process lo corre cada 6h; este botón es para
//      forzar refresh on-demand.
//   2. Lista de partidos disponibles (PROGRAMADO, sin torneo) con form
//      inline para crear torneo por cada uno. Con auto-import, la
//      mayoría de partidos ya llegan con torneo; esta lista es fallback
//      para crear torneos ad-hoc sobre partidos existentes.
//
// Usa fetch contra /api/v1/admin/... que ya valida rol ADMIN.
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { Button } from "@/components/ui";
import { formatKickoff } from "@/lib/utils/datetime";
import { authedFetch } from "@/lib/api-client";
import { ENTRADA_LUKAS } from "@/lib/config/economia";

interface PartidoDisponible {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: string;
}

interface ImportLigaResult {
  liga: string;
  season: number | null;
  partidosCreados: number;
  partidosActualizados: number;
  torneosCreados: number;
  errores: number;
}

export function AdminTorneosPanel() {
  const toast = useToast();
  const [disponibles, setDisponibles] = useState<PartidoDisponible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [importando, setImportando] = useState(false);
  const [ultimoImport, setUltimoImport] = useState<ImportLigaResult[] | null>(
    null,
  );

  const refrescarDisponibles = useCallback(async () => {
    setCargando(true);
    try {
      const res = await authedFetch("/api/v1/admin/partidos/disponibles");
      const payload = await res.json();
      if (!res.ok)
        throw new Error(payload?.error?.message ?? "No se pudo cargar.");
      setDisponibles(payload.data.partidos);
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setCargando(false);
    }
  }, [toast]);

  useEffect(() => {
    refrescarDisponibles();
  }, [refrescarDisponibles]);

  async function handleImportar() {
    setImportando(true);
    try {
      const res = await authedFetch("/api/v1/admin/partidos/importar", {
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(
          payload?.error?.message ?? "Error al importar partidos.",
        );
      const resultados = payload.data as ImportLigaResult[];
      setUltimoImport(resultados);
      const totales = resultados.reduce(
        (acc, r) => ({
          creados: acc.creados + r.partidosCreados,
          actualizados: acc.actualizados + r.partidosActualizados,
          torneos: acc.torneos + r.torneosCreados,
          errores: acc.errores + r.errores,
        }),
        { creados: 0, actualizados: 0, torneos: 0, errores: 0 },
      );
      toast.show(
        `✅ ${resultados.length} ligas · ${totales.creados} partidos nuevos · ${totales.torneos} torneos creados${totales.errores ? ` · ${totales.errores} con error` : ""}`,
      );
      refrescarDisponibles();
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setImportando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* IMPORT */}
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <h2 className="mb-1 font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
          Auto-import de partidos
        </h2>
        <p className="mb-4 text-[13px] text-muted-d">
          Trae fixtures de las ligas whitelisteadas (ventana hoy+14 días) y
          crea el torneo por cada partido nuevo. Corre solo cada 6h; acá
          puedes forzarlo. Requiere{" "}
          <code className="text-brand-blue-main">API_FOOTBALL_KEY</code>.
        </p>
        <Button
          variant="primary"
          size="lg"
          onClick={handleImportar}
          disabled={importando}
        >
          {importando ? "Importando…" : "Refrescar ahora"}
        </Button>

        {ultimoImport && (
          <div className="mt-4 overflow-x-auto rounded-sm border border-light">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead className="bg-subtle text-left font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Liga</th>
                  <th className="px-3 py-2">Season</th>
                  <th className="px-3 py-2 text-right">Nuevos</th>
                  <th className="px-3 py-2 text-right">Actualiz.</th>
                  <th className="px-3 py-2 text-right">Torneos</th>
                  <th className="px-3 py-2 text-right">Errores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {ultimoImport.map((r) => (
                  <tr key={r.liga} className="text-dark">
                    <td className="px-3 py-2 font-semibold">{r.liga}</td>
                    <td className="px-3 py-2 text-muted-d">
                      {r.season ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.partidosCreados}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.partidosActualizados}
                    </td>
                    <td className="px-3 py-2 text-right">{r.torneosCreados}</td>
                    <td
                      className={`px-3 py-2 text-right ${r.errores > 0 ? "font-bold text-brand-live" : "text-muted-d"}`}
                    >
                      {r.errores}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* DISPONIBLES + CREAR TORNEO */}
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
            Partidos disponibles
          </h2>
          <button
            type="button"
            onClick={refrescarDisponibles}
            className="text-[12px] font-semibold text-brand-blue-main hover:underline"
          >
            Refrescar
          </button>
        </div>
        {cargando ? (
          <p className="text-[13px] text-muted-d">Cargando…</p>
        ) : disponibles.length === 0 ? (
          <p className="text-[13px] text-muted-d">
            No hay partidos disponibles (sin torneo asociado) a futuro. Importa
            desde api-football primero.
          </p>
        ) : (
          <ul className="divide-y divide-light">
            {disponibles.map((p) => (
              <li key={p.id} className="py-4">
                <CrearTorneoRow
                  partido={p}
                  onCreated={() => refrescarDisponibles()}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fila que combina metadata del partido + form inline para crear torneo
// ---------------------------------------------------------------------------

function CrearTorneoRow({
  partido,
  onCreated,
}: {
  partido: PartidoDisponible;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<
    "EXPRESS" | "ESTANDAR" | "PREMIUM" | "GRAN_TORNEO"
  >("ESTANDAR");
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const fechaStr = formatKickoff(partido.fechaInicio);

  async function handleCrear() {
    setCreando(true);
    try {
      const res = await authedFetch("/api/v1/admin/torneos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoId: partido.id,
          tipo,
          // Plan v6: la entrada es uniforme; el backend ignora el campo
          // pero lo enviamos por explicitud del request.
          entradaLukas: ENTRADA_LUKAS,
          nombre: nombre.trim() || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(
          payload?.error?.message ?? "Error al crear torneo.",
        );
      toast.show(`✅ Torneo creado: ${payload.data.torneo.nombre}`);
      onCreated();
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
          {partido.liga}
        </div>
        <div className="truncate font-display text-[16px] font-extrabold uppercase text-dark">
          {partido.equipoLocal} vs {partido.equipoVisita}
        </div>
        <div className="text-[12px] text-muted-d">📅 {fechaStr}</div>
      </div>

      <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Tipo
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as typeof tipo)}
          className="rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
        >
          <option value="EXPRESS">Express</option>
          <option value="ESTANDAR">Estándar</option>
          <option value="PREMIUM">Premium</option>
          <option value="GRAN_TORNEO">Gran Torneo</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Entrada (Lukas)
        <div
          aria-readonly
          className="flex w-32 items-center gap-1 rounded-sm border-[1.5px] border-light bg-subtle px-3 py-2 font-body text-[13px] font-bold text-dark"
          title="Plan v6: entrada uniforme para todos los torneos."
        >
          <span aria-hidden>🪙</span>
          <span>{ENTRADA_LUKAS}</span>
        </div>
      </label>

      <label className="flex min-w-0 flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Nombre (opcional)
        <input
          type="text"
          maxLength={120}
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder={`${partido.equipoLocal} vs ${partido.equipoVisita}`}
          className="w-full rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none placeholder:text-soft focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
        />
      </label>

      <Button
        variant="primary"
        size="md"
        onClick={handleCrear}
        disabled={creando}
      >
        {creando ? "Creando…" : "Crear torneo"}
      </Button>
    </div>
  );
}
