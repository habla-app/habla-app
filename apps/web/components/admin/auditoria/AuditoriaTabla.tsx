"use client";

// AuditoriaTabla — tabla expandible con metadata JSON. Lote G.

import { useState } from "react";
import type { AuditoriaFila } from "@/lib/services/auditoria.service";

interface Props {
  rows: AuditoriaFila[];
}

export function AuditoriaTabla({ rows }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-md border border-admin-table-border">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="border-b border-admin-table-border bg-admin-table-row-stripe">
            <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">
              Cuándo
            </th>
            <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">
              Actor
            </th>
            <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">
              Acción
            </th>
            <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">
              Entidad · ID
            </th>
            <th className="text-admin-table-header text-muted-d px-3 py-2.5 text-left">
              Resumen
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-12 text-center text-admin-body text-muted-d"
              >
                Sin entradas que coincidan con los filtros.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const open = expanded === r.id;
            return (
              <RowFragment
                key={r.id}
                row={r}
                open={open}
                toggle={() => setExpanded(open ? null : r.id)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowFragment({
  row,
  open,
  toggle,
}: {
  row: AuditoriaFila;
  open: boolean;
  toggle: () => void;
}) {
  const meta = row.metadata
    ? JSON.stringify(row.metadata, null, 2)
    : null;
  return (
    <>
      <tr
        className="border-b border-admin-table-border cursor-pointer hover:bg-admin-table-row-hover"
        onClick={toggle}
      >
        <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
          {row.creadoEn.toLocaleString("es-PE", {
            timeZone: "America/Lima",
            day: "2-digit",
            month: "short",
            year: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </td>
        <td className="px-3 py-2 text-admin-table-cell text-dark">
          {row.actorEmail ?? row.actorId ?? "—"}
        </td>
        <td className="px-3 py-2 text-admin-table-cell">
          <code className="rounded-sm bg-subtle px-1.5 py-0.5 text-[11px] text-dark">
            {row.accion}
          </code>
        </td>
        <td className="px-3 py-2 text-admin-table-cell text-muted-d">
          <span className="font-mono text-[11px]">
            {row.entidad}
            {row.entidadId && ` · ${row.entidadId.slice(0, 12)}`}
          </span>
        </td>
        <td className="px-3 py-2 text-admin-table-cell text-dark">
          <span className="line-clamp-1">{row.resumen ?? "—"}</span>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-admin-table-border bg-subtle/40">
          <td colSpan={5} className="px-3 py-3">
            {meta ? (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-sm border border-admin-table-border bg-admin-card-bg p-3 font-mono text-[11px] text-dark">
                {meta}
              </pre>
            ) : (
              <span className="text-admin-meta text-muted-d">Sin metadata adicional.</span>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
