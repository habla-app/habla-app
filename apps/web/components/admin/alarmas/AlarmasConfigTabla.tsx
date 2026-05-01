"use client";

// AlarmasConfigTabla — tabla editable de thresholds. Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AlarmaConfigFila } from "@/lib/services/alarmas.service";
import type { KPIMeta } from "@/lib/services/kpis-metadata";
import { authedFetch } from "@/lib/api-client";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";

interface Props {
  configs: AlarmaConfigFila[];
  catalogoKPIs: KPIMeta[];
}

export function AlarmasConfigTabla({ configs, catalogoKPIs }: Props) {
  const [editing, setEditing] = useState<AlarmaConfigFila | null>(null);
  const [adding, setAdding] = useState(false);

  // KPIs no configurados aún (para el modal de creación)
  const idsConfigurados = new Set(configs.map((c) => c.metricId));
  const noConfigurados = catalogoKPIs.filter(
    (k) => !idsConfigurados.has(k.id) && !k.pendienteCableado,
  );

  return (
    <AdminCard
      title="Configuración de thresholds"
      description="Define los límites min/max y duración para que el cron evalúe automáticamente"
      bodyPadding="none"
      actions={
        noConfigurados.length > 0 ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-sm bg-brand-blue-main px-3 py-1 text-admin-meta font-bold text-white hover:bg-brand-blue-dark"
          >
            + Threshold
          </button>
        ) : null
      }
    >
      <AdminTable
        data={configs}
        rowKey={(r) => r.id}
        empty="Sin thresholds configurados. Agregá uno para que el cron empiece a evaluar."
        columns={[
          {
            key: "label",
            label: "KPI",
            render: (r) => <span className="text-dark">{r.metricLabel}</span>,
          },
          {
            key: "min",
            label: "Min",
            align: "right",
            render: (r) =>
              r.thresholdMin === null ? (
                <span className="text-soft">—</span>
              ) : (
                <span className="font-mono tabular-nums text-dark">{r.thresholdMin}</span>
              ),
          },
          {
            key: "max",
            label: "Max",
            align: "right",
            render: (r) =>
              r.thresholdMax === null ? (
                <span className="text-soft">—</span>
              ) : (
                <span className="font-mono tabular-nums text-dark">{r.thresholdMax}</span>
              ),
          },
          {
            key: "duracion",
            label: "Duración",
            align: "right",
            render: (r) => (
              <span className="font-mono text-muted-d">{r.duracionMinutos}min</span>
            ),
          },
          {
            key: "severidad",
            label: "Severidad",
            render: (r) => (
              <span
                className={
                  r.severidad === "CRITICAL"
                    ? "text-status-red-text font-bold"
                    : r.severidad === "WARNING"
                      ? "text-status-amber-text font-bold"
                      : "text-muted-d"
                }
              >
                {r.severidad}
              </span>
            ),
          },
          {
            key: "habilitada",
            label: "Habilitada",
            render: (r) => (r.habilitada ? "✓" : "—"),
          },
          {
            key: "acciones",
            label: "",
            align: "right",
            render: (r) => (
              <button
                type="button"
                onClick={() => setEditing(r)}
                className="text-admin-meta font-bold text-brand-blue-main hover:underline"
              >
                Editar
              </button>
            ),
          },
        ]}
      />

      {(editing || adding) && (
        <ConfigForm
          config={editing}
          kpisDisponibles={editing ? [] : noConfigurados}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
        />
      )}
    </AdminCard>
  );
}

function ConfigForm({
  config,
  kpisDisponibles,
  onClose,
}: {
  config: AlarmaConfigFila | null;
  kpisDisponibles: KPIMeta[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [metricId, setMetricId] = useState(config?.metricId ?? kpisDisponibles[0]?.id ?? "");
  const [metricLabel, setMetricLabel] = useState(
    config?.metricLabel ?? kpisDisponibles[0]?.label ?? "",
  );
  const [thresholdMin, setThresholdMin] = useState<string>(
    config?.thresholdMin?.toString() ?? "",
  );
  const [thresholdMax, setThresholdMax] = useState<string>(
    config?.thresholdMax?.toString() ?? "",
  );
  const [duracionMinutos, setDuracionMinutos] = useState(
    config?.duracionMinutos ?? 60,
  );
  const [severidad, setSeveridad] = useState<"INFO" | "WARNING" | "CRITICAL">(
    config?.severidad ?? "WARNING",
  );
  const [habilitada, setHabilitada] = useState(config?.habilitada ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/v1/admin/alarmas/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricId,
          metricLabel,
          thresholdMin: thresholdMin === "" ? null : Number(thresholdMin),
          thresholdMax: thresholdMax === "" ? null : Number(thresholdMax),
          duracionMinutos,
          severidad,
          habilitada,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falló");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-modal flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-md bg-admin-card-bg p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-admin-card-title text-dark">
          {config ? "Editar threshold" : "Nuevo threshold"}
        </h3>
        {!config && (
          <label className="mb-3 block">
            <span className="text-admin-label text-muted-d">KPI</span>
            <select
              value={metricId}
              onChange={(e) => {
                const id = e.target.value;
                setMetricId(id);
                const kpi = kpisDisponibles.find((k) => k.id === id);
                if (kpi) setMetricLabel(kpi.label);
              }}
              className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
            >
              {kpisDisponibles.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {config && (
          <div className="mb-3">
            <span className="text-admin-label text-muted-d">KPI</span>
            <div className="text-admin-body text-dark">{config.metricLabel}</div>
          </div>
        )}
        <div className="mb-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-admin-label text-muted-d">Threshold min</span>
            <input
              type="number"
              step="any"
              value={thresholdMin}
              onChange={(e) => setThresholdMin(e.target.value)}
              placeholder="(opcional)"
              className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
            />
          </label>
          <label className="block">
            <span className="text-admin-label text-muted-d">Threshold max</span>
            <input
              type="number"
              step="any"
              value={thresholdMax}
              onChange={(e) => setThresholdMax(e.target.value)}
              placeholder="(opcional)"
              className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
            />
          </label>
        </div>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">Duración (min)</span>
          <input
            type="number"
            value={duracionMinutos}
            onChange={(e) => setDuracionMinutos(Number(e.target.value))}
            min={0}
            max={10080}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          />
          <span className="mt-1 block text-admin-meta text-muted-d">
            Tiempo que el KPI debe estar fuera de threshold para disparar
          </span>
        </label>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">Severidad</span>
          <select
            value={severidad}
            onChange={(e) => setSeveridad(e.target.value as typeof severidad)}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          >
            <option value="INFO">INFO</option>
            <option value="WARNING">WARNING</option>
            <option value="CRITICAL">CRITICAL (envía email al admin)</option>
          </select>
        </label>
        <label className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={habilitada}
            onChange={(e) => setHabilitada(e.target.checked)}
          />
          <span className="text-admin-body text-dark">Habilitada</span>
        </label>
        {error && (
          <p className="mb-3 rounded-sm bg-status-red-bg px-3 py-2 text-admin-meta text-status-red-text">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-sm border border-admin-table-border px-3 py-1.5 text-admin-meta text-muted-d hover:text-dark"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading || !metricId}
            className="rounded-sm bg-brand-blue-main px-3 py-1.5 text-admin-meta font-bold text-white disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
