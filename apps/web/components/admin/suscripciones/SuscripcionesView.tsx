"use client";

// SuscripcionesView — listing con filtros + tabla densa. Lote F (May 2026).
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { cn } from "@/lib/utils/cn";
import type {
  StatsSuscripciones,
  SuscripcionAdminFila,
} from "@/lib/services/suscripciones.service";

interface Props {
  stats: StatsSuscripciones;
  rows: SuscripcionAdminFila[];
  total: number;
  page: number;
  pageSize: number;
  filtroEstado: string | null;
  filtroPlan: string | null;
  filtroQ: string;
}

const ESTADOS = [
  { value: "", label: "Todos" },
  { value: "ACTIVA", label: "Activa" },
  { value: "CANCELANDO", label: "Cancelando" },
  { value: "VENCIDA", label: "Vencida" },
  { value: "REEMBOLSADA", label: "Reembolsada" },
  { value: "FALLIDA", label: "Fallida" },
];

const PLANES = [
  { value: "", label: "Todos" },
  { value: "MENSUAL", label: "Mensual" },
  { value: "TRIMESTRAL", label: "Trimestral" },
  { value: "ANUAL", label: "Anual" },
];

export function SuscripcionesView({
  stats,
  rows,
  total,
  page,
  pageSize,
  filtroEstado,
  filtroPlan,
  filtroQ,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busqueda, setBusqueda] = useState(filtroQ);
  const [pending, startTransition] = useTransition();

  function aplicarFiltro(key: string, value: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => {
      router.push(`/admin/suscripciones?${params.toString()}`);
    });
  }

  function buscar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    aplicarFiltro("q", busqueda.trim());
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-4 gap-3">
        <StatCard label="Total activas" value={stats.totalActivas.toString()} tone="brand" />
        <StatCard
          label="MRR"
          value={`S/ ${(stats.mrrCentimos / 100).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`}
          tone="good"
        />
        <StatCard
          label="Cancelando este mes"
          value={stats.cancelandoMes.toString()}
          tone={stats.cancelandoMes > 0 ? "amber" : "neutral"}
        />
        <StatCard
          label="Vencidas/fallidas (30d)"
          value={stats.vencidasUltMes.toString()}
          tone={stats.vencidasUltMes > 0 ? "red" : "neutral"}
        />
      </section>

      <AdminCard title="Filtros" bodyPadding="md">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={buscar} className="flex-1 min-w-[260px]">
            <label htmlFor="q-busqueda" className="sr-only">
              Buscar por email o nombre
            </label>
            <input
              id="q-busqueda"
              type="search"
              placeholder="Email, nombre o @username"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark focus:border-brand-blue-main focus:outline-none"
            />
          </form>
          <select
            value={filtroEstado ?? ""}
            onChange={(e) => aplicarFiltro("estado", e.target.value)}
            className="rounded-sm border border-strong bg-card px-2 py-2 text-admin-body text-dark"
          >
            {ESTADOS.map((e) => (
              <option key={e.value} value={e.value}>
                Estado: {e.label}
              </option>
            ))}
          </select>
          <select
            value={filtroPlan ?? ""}
            onChange={(e) => aplicarFiltro("plan", e.target.value)}
            className="rounded-sm border border-strong bg-card px-2 py-2 text-admin-body text-dark"
          >
            {PLANES.map((p) => (
              <option key={p.value} value={p.value}>
                Plan: {p.label}
              </option>
            ))}
          </select>
        </div>
      </AdminCard>

      <AdminCard
        title={`Suscripciones · ${total.toLocaleString("es-PE")} resultado${total === 1 ? "" : "s"}`}
        bodyPadding="none"
      >
        <AdminTable
          columns={[
            {
              key: "usuario",
              label: "Usuario",
              render: (r) => (
                <div>
                  <Link
                    href={`/admin/suscripciones/${r.id}`}
                    className="font-bold text-dark hover:underline"
                  >
                    {r.nombre}
                  </Link>
                  <div className="text-admin-meta text-muted-d">{r.email}</div>
                </div>
              ),
            },
            {
              key: "plan",
              label: "Plan",
              render: (r) => (
                <span className="rounded-sm bg-subtle px-2 py-0.5 text-admin-meta font-bold uppercase text-dark">
                  {r.plan}
                </span>
              ),
            },
            {
              key: "estado",
              label: "Estado",
              render: (r) => <EstadoBadge estado={r.estado} />,
            },
            {
              key: "iniciada",
              label: "Iniciada",
              render: (r) => formatLima(r.iniciada, false),
            },
            {
              key: "proximo",
              label: "Próx. cobro",
              render: (r) =>
                r.proximoCobro && !r.cancelada
                  ? formatLima(r.proximoCobro, false)
                  : "—",
            },
            {
              key: "mrr",
              label: "MRR (S/)",
              align: "right",
              render: (r) => {
                const meses = r.plan === "ANUAL" ? 12 : r.plan === "TRIMESTRAL" ? 3 : 1;
                const mrr = Math.round(r.precio / meses) / 100;
                return (
                  <span className="tabular-nums">
                    {mrr.toLocaleString("es-PE", { maximumFractionDigits: 2 })}
                  </span>
                );
              },
            },
            {
              key: "garantia",
              label: "Garantía",
              align: "center",
              render: (r) =>
                r.enGarantia ? (
                  <span className="rounded-sm bg-status-amber-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-amber-text">
                    7d
                  </span>
                ) : (
                  <span className="text-admin-meta text-muted-d">—</span>
                ),
            },
            {
              key: "acciones",
              label: "",
              align: "right",
              render: (r) => (
                <Link
                  href={`/admin/suscripciones/${r.id}`}
                  className="text-admin-meta font-bold text-brand-blue-main hover:underline"
                >
                  Ver detalle →
                </Link>
              ),
            },
          ]}
          data={rows}
          rowKey={(r) => r.id}
          loading={pending}
          empty="Sin suscripciones que coincidan con los filtros."
        />
        <Paginator page={page} totalPages={totalPages} total={total} pageSize={pageSize} />
      </AdminCard>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "good" | "amber" | "red" | "neutral";
}) {
  const valueClass = {
    brand: "text-brand-blue-main",
    good: "text-status-green-text",
    amber: "text-status-amber-text",
    red: "text-status-red-text",
    neutral: "text-dark",
  }[tone];
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4">
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className={cn("mt-2 text-kpi-value-md tabular-nums", valueClass)}>
        {value}
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = (() => {
    switch (estado) {
      case "ACTIVA":
        return { label: "Activa", cls: "bg-status-green-bg text-status-green-text" };
      case "CANCELANDO":
        return { label: "Cancelando", cls: "bg-status-amber-bg text-status-amber-text" };
      case "VENCIDA":
        return { label: "Vencida", cls: "bg-status-neutral-bg text-status-neutral-text" };
      case "REEMBOLSADA":
        return { label: "Reembolsada", cls: "bg-subtle text-muted-d" };
      case "FALLIDA":
        return { label: "Fallida", cls: "bg-status-red-bg text-status-red-text" };
      case "PENDIENTE":
        return { label: "Pendiente", cls: "bg-status-amber-bg text-status-amber-text" };
      default:
        return { label: estado, cls: "bg-subtle text-muted-d" };
    }
  })();
  return (
    <span
      className={cn(
        "rounded-sm px-2 py-0.5 text-admin-meta font-bold uppercase",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function Paginator({
  page,
  totalPages,
  total,
  pageSize,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
}) {
  const searchParams = useSearchParams();

  function buildHref(p: number): string {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("page", String(p));
    return `/admin/suscripciones?${params.toString()}`;
  }

  if (totalPages <= 1) return null;

  const inicio = (page - 1) * pageSize + 1;
  const fin = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between border-t border-admin-table-border px-3 py-2 text-admin-meta text-muted-d"
    >
      <span>
        Mostrando {inicio}–{fin} de {total.toLocaleString("es-PE")}
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={buildHref(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            "rounded-sm border border-admin-table-border px-2 py-1 text-dark",
            page <= 1 && "pointer-events-none opacity-40",
          )}
        >
          ←
        </Link>
        <span className="px-2">
          {page} / {totalPages}
        </span>
        <Link
          href={buildHref(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            "rounded-sm border border-admin-table-border px-2 py-1 text-dark",
            page >= totalPages && "pointer-events-none opacity-40",
          )}
        >
          →
        </Link>
      </div>
    </nav>
  );
}

function formatLima(d: Date | string, withTime = true): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    year: "numeric",
  };
  if (withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("es-PE", opts).format(date);
}
