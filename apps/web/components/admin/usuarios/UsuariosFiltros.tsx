"use client";

// UsuariosFiltros — search + rol + estado. Lote G.

import { useRouter, useSearchParams } from "next/navigation";

interface Props {
  initialQuery: string;
  initialRol: string;
  initialEstado: string;
}

export function UsuariosFiltros({
  initialQuery,
  initialRol,
  initialEstado,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function submitFiltros(formData: FormData) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    const q = (formData.get("q") as string) || "";
    const rol = (formData.get("rol") as string) || "";
    const estado = (formData.get("estado") as string) || "";
    if (q) p.set("q", q);
    else p.delete("q");
    if (rol) p.set("rol", rol);
    else p.delete("rol");
    if (estado) p.set("estado", estado);
    else p.delete("estado");
    p.delete("page");
    router.push(`/admin/usuarios?${p.toString()}`);
  }

  return (
    <form
      action={(fd) => submitFiltros(fd)}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1">
        <span className="text-admin-label text-muted-d">Buscar</span>
        <input
          type="text"
          name="q"
          defaultValue={initialQuery}
          placeholder="email, nombre o @username"
          className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta text-dark min-w-[260px]"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-admin-label text-muted-d">Rol</span>
        <select
          name="rol"
          defaultValue={initialRol}
          className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta text-dark"
        >
          <option value="">Todos</option>
          <option value="JUGADOR">JUGADOR</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-admin-label text-muted-d">Estado</span>
        <select
          name="estado"
          defaultValue={initialEstado}
          className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta text-dark"
        >
          <option value="">Todos</option>
          <option value="activo">Activos</option>
          <option value="soft_deleted">Eliminados</option>
        </select>
      </label>
      <button
        type="submit"
        className="rounded-sm bg-brand-blue-main px-3 py-1.5 text-admin-meta font-bold text-white"
      >
        Filtrar
      </button>
    </form>
  );
}
