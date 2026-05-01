"use client";

// ComisionesTabla — tabla de comisiones afiliación con form para registrar nuevas. Lote G.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ComisionFila } from "@/lib/services/finanzas.service";
import { authedFetch } from "@/lib/api-client";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";

interface AfiliadoOption {
  id: string;
  nombre: string;
}

interface Props {
  mes: string;
  comisiones: ComisionFila[];
  afiliados: AfiliadoOption[];
}

export function ComisionesTabla({ mes, comisiones, afiliados }: Props) {
  const [adding, setAdding] = useState(false);
  const total = comisiones.reduce((acc, c) => acc + c.monto, 0);

  return (
    <AdminCard
      title="Comisiones afiliación"
      description={`Mes ${mes} · Pagos reportados por las casas`}
      bodyPadding="none"
      actions={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-sm bg-brand-blue-main px-3 py-1 text-admin-meta font-bold text-white hover:bg-brand-blue-dark"
        >
          + Comisión
        </button>
      }
    >
      <AdminTable
        data={comisiones}
        rowKey={(r) => r.id}
        empty="Sin comisiones registradas para este mes."
        columns={[
          {
            key: "afiliado",
            label: "Casa",
            render: (r) => <span className="text-dark">{r.afiliadoNombre}</span>,
          },
          {
            key: "monto",
            label: "Monto",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-dark">
                S/ {r.monto.toLocaleString("es-PE")}
              </span>
            ),
          },
          {
            key: "ftds",
            label: "FTDs",
            align: "right",
            render: (r) => (
              <span className="font-mono tabular-nums text-muted-d">
                {r.ftdsContados}
              </span>
            ),
          },
          {
            key: "notas",
            label: "Notas",
            render: (r) => (
              <span className="text-admin-meta text-muted-d">{r.notas ?? "—"}</span>
            ),
          },
        ]}
      />
      <div className="border-t border-admin-table-border bg-admin-table-row-stripe px-3 py-2 text-admin-meta">
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase tracking-[0.06em] text-muted-d">
            Total
          </span>
          <span className="font-mono tabular-nums text-dark">
            S/ {total.toLocaleString("es-PE")}
          </span>
        </div>
      </div>

      {adding && (
        <ComisionForm mes={mes} afiliados={afiliados} onClose={() => setAdding(false)} />
      )}
    </AdminCard>
  );
}

function ComisionForm({
  mes,
  afiliados,
  onClose,
}: {
  mes: string;
  afiliados: AfiliadoOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [afiliadoId, setAfiliadoId] = useState(afiliados[0]?.id ?? "");
  const [montoSoles, setMontoSoles] = useState(0);
  const [ftds, setFtds] = useState(0);
  const [notas, setNotas] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authedFetch("/api/v1/admin/finanzas/comisiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes,
          afiliadoId,
          montoSoles,
          ftdsContados: ftds,
          notas: notas || undefined,
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
        <h3 className="mb-4 text-admin-card-title text-dark">Nueva comisión · {mes}</h3>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">Casa</span>
          <select
            value={afiliadoId}
            onChange={(e) => setAfiliadoId(e.target.value)}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          >
            {afiliados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">Monto (S/)</span>
          <input
            type="number"
            value={montoSoles}
            onChange={(e) => setMontoSoles(Number(e.target.value))}
            min={0}
            step={1}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          />
        </label>
        <label className="mb-3 block">
          <span className="text-admin-label text-muted-d">FTDs contados</span>
          <input
            type="number"
            value={ftds}
            onChange={(e) => setFtds(Number(e.target.value))}
            min={0}
            step={1}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          />
        </label>
        <label className="mb-4 block">
          <span className="text-admin-label text-muted-d">Notas (opcional)</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-body text-dark"
          />
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
            disabled={loading || !afiliadoId}
            className="rounded-sm bg-brand-blue-main px-3 py-1.5 text-admin-meta font-bold text-white disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
