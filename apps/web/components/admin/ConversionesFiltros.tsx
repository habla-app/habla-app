"use client";
// ConversionesFiltros — Lote 7.
//
// Form de filtros para /admin/conversiones. Submit actualiza el query
// string. Reset limpia y vuelve a /admin/conversiones.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

interface AfiliadoMin {
  id: string;
  nombre: string;
  slug: string;
}

interface Props {
  afiliados: AfiliadoMin[];
  actualAfiliadoId: string;
  actualDesde: string;
  actualHasta: string;
}

const INPUT_CLASS =
  "rounded-sm border-[1.5px] border-light bg-card px-2 py-1.5 text-[12px] text-dark outline-none focus:border-brand-blue-main";

export function ConversionesFiltros({
  afiliados,
  actualAfiliadoId,
  actualDesde,
  actualHasta,
}: Props) {
  const router = useRouter();
  const [afiliadoId, setAfiliadoId] = useState(actualAfiliadoId);
  const [desde, setDesde] = useState(actualDesde);
  const [hasta, setHasta] = useState(actualHasta);

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const usp = new URLSearchParams();
    if (afiliadoId) usp.set("afiliadoId", afiliadoId);
    if (desde) usp.set("desde", desde);
    if (hasta) usp.set("hasta", hasta);
    router.push(
      `/admin/conversiones${usp.toString() ? `?${usp.toString()}` : ""}`,
    );
  }

  function limpiar() {
    setAfiliadoId("");
    setDesde("");
    setHasta("");
    router.push("/admin/conversiones");
  }

  return (
    <form onSubmit={aplicar} className="mb-4 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Afiliado
        <select
          value={afiliadoId}
          onChange={(e) => setAfiliadoId(e.target.value)}
          className={`${INPUT_CLASS} min-w-[180px] font-semibold`}
        >
          <option value="">(todos)</option>
          {afiliados.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Desde
        <input
          type="date"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Hasta
        <input
          type="date"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className={INPUT_CLASS}
        />
      </label>

      <Button type="submit" variant="primary" size="md">
        Aplicar
      </Button>
      <button
        type="button"
        onClick={limpiar}
        className="rounded-sm border border-light bg-card px-3 py-1.5 text-[12px] font-semibold text-muted-d hover:bg-subtle"
      >
        Limpiar
      </button>
    </form>
  );
}
