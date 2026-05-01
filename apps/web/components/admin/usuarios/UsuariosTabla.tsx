// UsuariosTabla — listing densa de usuarios. Lote G.

import Link from "next/link";

import type { UsuarioAdminFila } from "@/lib/services/usuarios.service";
import { AdminTable } from "@/components/ui/admin/AdminTable";

interface Props {
  rows: UsuarioAdminFila[];
}

export function UsuariosTabla({ rows }: Props) {
  return (
    <AdminTable
      data={rows}
      rowKey={(r) => r.id}
      empty="Sin usuarios que coincidan con los filtros."
      columns={[
        {
          key: "nombre",
          label: "Usuario",
          render: (r) => (
            <Link
              href={`/admin/usuarios/${r.id}`}
              className="text-dark font-medium hover:underline"
            >
              <div>{r.nombre}</div>
              <div className="text-admin-meta text-muted-d">@{r.username}</div>
            </Link>
          ),
        },
        {
          key: "email",
          label: "Email",
          render: (r) => (
            <span className="font-mono text-[11px] text-muted-d">
              {r.estado === "soft_deleted" ? "(eliminado)" : r.email}
            </span>
          ),
        },
        {
          key: "rol",
          label: "Rol",
          render: (r) => (
            <span
              className={
                r.rol === "ADMIN"
                  ? "rounded-sm bg-brand-blue-main px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-white"
                  : "rounded-sm bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted-d"
              }
            >
              {r.rol}
            </span>
          ),
        },
        {
          key: "estado",
          label: "Estado",
          render: (r) =>
            r.estado === "soft_deleted" ? (
              <span className="text-status-red-text font-bold">Eliminado</span>
            ) : (
              <span className="text-status-green-text">Activo</span>
            ),
        },
        {
          key: "tickets",
          label: "Tickets",
          align: "right",
          render: (r) => (
            <span className="font-mono tabular-nums text-muted-d">
              {r.ticketsCount}
            </span>
          ),
        },
        {
          key: "creadoEn",
          label: "Registrado",
          render: (r) => (
            <span className="font-mono text-[11px] text-muted-d">
              {r.creadoEn.toLocaleDateString("es-PE", { timeZone: "America/Lima" })}
            </span>
          ),
        },
      ]}
    />
  );
}
