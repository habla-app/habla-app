"use client";

// AuditoriaFiltros — filtros del listing de auditoría. Lote G.

import { useRouter, useSearchParams } from "next/navigation";

export function AuditoriaFiltros({
  initialEntidad,
  initialActorId,
}: {
  initialEntidad: string;
  initialActorId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function submitFiltros(formData: FormData) {
    const p = new URLSearchParams(searchParams?.toString() ?? "");
    const entidad = (formData.get("entidad") as string) || "";
    const actor = (formData.get("actorId") as string) || "";
    if (entidad) p.set("entidad", entidad);
    else p.delete("entidad");
    if (actor) p.set("actorId", actor);
    else p.delete("actorId");
    p.delete("page");
    router.push(`/admin/auditoria?${p.toString()}`);
  }

  return (
    <form
      action={(fd) => submitFiltros(fd)}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="flex flex-col gap-1">
        <span className="text-admin-label text-muted-d">Entidad</span>
        <select
          name="entidad"
          defaultValue={initialEntidad}
          className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta text-dark"
        >
          <option value="">Todas</option>
          <option value="PickPremium">PickPremium</option>
          <option value="Suscripcion">Suscripcion</option>
          <option value="PremioMensual">PremioMensual</option>
          <option value="DigestEnviado">Newsletter</option>
          <option value="Usuario">Usuario</option>
          <option value="MiembroChannel">MiembroChannel</option>
          <option value="CostoOperativo">CostoOperativo</option>
          <option value="ComisionAfiliacion">ComisionAfiliacion</option>
          <option value="Alarma">Alarma</option>
          <option value="AlarmaConfiguracion">AlarmaConfiguracion</option>
          <option value="LighthouseRun">LighthouseRun</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-admin-label text-muted-d">Actor (userId)</span>
        <input
          type="text"
          name="actorId"
          defaultValue={initialActorId}
          placeholder="cuid del admin"
          className="rounded-sm border border-admin-table-border bg-admin-card-bg px-3 py-1.5 text-admin-meta text-dark"
        />
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
