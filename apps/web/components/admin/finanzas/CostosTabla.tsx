"use client";

// CostosTabla — tabla editable de costos operativos del mes. Lote G.

import { useState } from "react";
import type { CostoFila } from "@/lib/services/finanzas.service";
import { LABEL_CATEGORIA } from "@/lib/services/finanzas.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { CostoForm } from "./CostoForm";

interface Props {
  mes: string;
  costos: CostoFila[];
  totalRevenue: number;
}

export function CostosTabla({ mes, costos, totalRevenue }: Props) {
  const [editing, setEditing] = useState<CostoFila | null>(null);
  const [adding, setAdding] = useState(false);

  const total = costos.reduce((acc, c) => acc + c.monto, 0);
  const totalPctRev =
    totalRevenue > 0 ? Math.round((total / totalRevenue) * 1000) / 10 : null;

  return (
    <AdminCard
      title="Costos operativos"
      description={`Mes ${mes} · Editable`}
      bodyPadding="none"
      actions={
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-sm bg-brand-blue-main px-3 py-1 text-admin-meta font-bold text-white hover:bg-brand-blue-dark"
        >
          + Costo
        </button>
      }
    >
      <AdminTable
        data={costos}
        rowKey={(r) => r.id}
        empty="Sin costos registrados para este mes."
        columns={[
          {
            key: "categoria",
            label: "Categoría",
            render: (r) => (
              <span className="text-dark">
                {LABEL_CATEGORIA[r.categoria] ?? r.categoria}
              </span>
            ),
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
            key: "pctRev",
            label: "% revenue",
            align: "right",
            render: (r) => {
              if (totalRevenue <= 0) return <span className="text-soft">—</span>;
              return (
                <span className="font-mono tabular-nums text-muted-d">
                  {Math.round((r.monto / totalRevenue) * 1000) / 10}%
                </span>
              );
            },
          },
          {
            key: "notas",
            label: "Notas",
            render: (r) => (
              <span className="text-admin-meta text-muted-d">{r.notas ?? "—"}</span>
            ),
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
      <div className="border-t border-admin-table-border bg-admin-table-row-stripe px-3 py-2 text-admin-meta">
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase tracking-[0.06em] text-muted-d">
            Total costos
          </span>
          <span className="font-mono tabular-nums text-dark">
            S/ {total.toLocaleString("es-PE")}{" "}
            {totalPctRev !== null && (
              <span className="text-muted-d">({totalPctRev}% del revenue)</span>
            )}
          </span>
        </div>
      </div>

      {(editing || adding) && (
        <CostoForm
          mes={mes}
          categoriaInicial={editing?.categoria}
          montoInicial={editing?.monto}
          notasIniciales={editing?.notas}
          onClose={() => {
            setEditing(null);
            setAdding(false);
          }}
        />
      )}
    </AdminCard>
  );
}
