"use client";
// LogsTable — Lote 6.
//
// Tabla expandible de errores. Click en row revela stack + metadata JSON.
// Usa state local; los filtros y paginación viven en el query string.

import { useState } from "react";
import type { ErrorRow } from "@/lib/services/logs.service";

interface Props {
  rows: ErrorRow[];
}

export function LogsTable({ rows }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-sm border border-light">
      <table className="w-full min-w-[720px] text-[12px]">
        <thead className="bg-subtle text-left font-body text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          <tr>
            <th className="px-3 py-2 w-[140px]">Cuándo</th>
            <th className="px-3 py-2 w-[80px]">Level</th>
            <th className="px-3 py-2 w-[180px]">Source</th>
            <th className="px-3 py-2">Mensaje</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-light">
          {rows.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <>
                <tr
                  key={r.id}
                  className="cursor-pointer text-dark hover:bg-subtle/60"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                    {r.creadoEn.toLocaleString("es-PE", {
                      timeZone: "America/Lima",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <LevelBadge level={r.level} />
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                    {r.source}
                  </td>
                  <td className="px-3 py-2">
                    <span className="line-clamp-2 break-words">{r.message}</span>
                  </td>
                </tr>
                {isOpen && (
                  <tr key={`${r.id}-detail`} className="bg-subtle/40">
                    <td colSpan={4} className="px-3 py-3">
                      <DetalleError row={r} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  const tone =
    level === "critical"
      ? "bg-brand-live/15 text-brand-live"
      : level === "error"
        ? "bg-brand-gold-dim text-brand-gold-dark"
        : "bg-subtle text-muted-d";
  return (
    <span
      className={`inline-block rounded-sm px-2 py-0.5 font-display text-[10px] font-black uppercase tracking-[0.06em] ${tone}`}
    >
      {level}
    </span>
  );
}

function DetalleError({ row }: { row: ErrorRow }) {
  const metaJson = row.metadata
    ? JSON.stringify(row.metadata, null, 2)
    : null;
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
          Mensaje
        </div>
        <pre className="whitespace-pre-wrap rounded-sm border border-light bg-card p-3 font-mono text-[11px] text-dark">
          {row.message}
        </pre>
      </div>
      {row.stack && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
            Stack
          </div>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-sm border border-light bg-card p-3 font-mono text-[10px] text-muted-d">
            {row.stack}
          </pre>
        </div>
      )}
      {metaJson && (
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-d">
            Metadata
          </div>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-sm border border-light bg-card p-3 font-mono text-[10px] text-dark">
            {metaJson}
          </pre>
        </div>
      )}
      {row.userId && (
        <div className="text-[11px] text-muted-d">
          User ID:{" "}
          <code className="rounded-sm bg-subtle px-1.5 py-0.5 font-mono">
            {row.userId}
          </code>
        </div>
      )}
    </div>
  );
}
