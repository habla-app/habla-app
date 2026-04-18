"use client";

// Panel interno del admin — herramienta de ops, no replica pixel-perfect
// el mockup (el mockup no tiene pantalla de admin).
//
// Secciones:
//   1. Importar partidos de api-football por fecha.
//   2. Lista de partidos disponibles (PROGRAMADO, sin torneo) con form
//      inline para crear torneo por cada uno.
//
// Usa fetch contra /api/v1/admin/... que ya valida rol ADMIN.
import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { Button } from "@/components/ui";

interface PartidoDisponible {
  id: string;
  liga: string;
  equipoLocal: string;
  equipoVisita: string;
  fechaInicio: string;
}

export function AdminTorneosPanel() {
  const toast = useToast();
  const [disponibles, setDisponibles] = useState<PartidoDisponible[]>([]);
  const [cargando, setCargando] = useState(true);
  const [importando, setImportando] = useState(false);

  const hoy = new Date().toISOString().slice(0, 10);
  const [fechaImport, setFechaImport] = useState(hoy);

  const refrescarDisponibles = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/v1/admin/partidos/disponibles");
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
      const res = await fetch("/api/v1/admin/partidos/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha: fechaImport }),
      });
      const payload = await res.json();
      if (!res.ok)
        throw new Error(
          payload?.error?.message ?? "Error al importar partidos.",
        );
      const { total, importados, actualizados } = payload.data;
      toast.show(
        `✅ Importados ${importados} · actualizados ${actualizados} (total ${total}) desde api-football.`,
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
          Importar partidos
        </h2>
        <p className="mb-4 text-[13px] text-muted-d">
          Descarga los fixtures del día desde api-football y los upsertea en
          la BD. Requiere <code className="text-brand-blue-main">API_FOOTBALL_KEY</code> configurada.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-[12px] font-bold uppercase tracking-[0.06em] text-muted-d">
            Fecha (YYYY-MM-DD)
            <input
              type="date"
              value={fechaImport}
              onChange={(e) => setFechaImport(e.target.value)}
              className="rounded-sm border-[1.5px] border-light bg-card px-3.5 py-2.5 font-body text-[14px] text-dark outline-none transition-all focus:border-brand-blue-main focus:ring-4 focus:ring-brand-blue-main/10"
            />
          </label>
          <Button
            variant="primary"
            size="lg"
            onClick={handleImportar}
            disabled={importando}
          >
            {importando ? "Importando…" : "Importar partidos"}
          </Button>
        </div>
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
  const [entradaLukas, setEntradaLukas] = useState(10);
  const [nombre, setNombre] = useState("");
  const [creando, setCreando] = useState(false);

  const fecha = new Date(partido.fechaInicio);
  const fechaStr = `${fecha.toLocaleDateString("es-PE")} ${fecha.getHours().toString().padStart(2, "0")}:${fecha.getMinutes().toString().padStart(2, "0")}`;

  async function handleCrear() {
    setCreando(true);
    try {
      const res = await fetch("/api/v1/admin/torneos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partidoId: partido.id,
          tipo,
          entradaLukas,
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
        <input
          type="number"
          min={1}
          max={10000}
          value={entradaLukas}
          onChange={(e) => setEntradaLukas(Number(e.target.value))}
          className="w-32 rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
        />
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
