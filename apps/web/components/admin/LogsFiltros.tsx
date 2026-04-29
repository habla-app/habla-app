"use client";
// LogsFiltros — Lote 6.
//
// Form simple que actualiza el query string. Submit recarga la page con
// los nuevos params. Reset limpia todo a la URL base.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

interface Props {
  initialLevel: string;
  initialSource: string;
  initialDesde: string;
  initialHasta: string;
}

export function LogsFiltros({
  initialLevel,
  initialSource,
  initialDesde,
  initialHasta,
}: Props) {
  const router = useRouter();
  const [level, setLevel] = useState(initialLevel);
  const [source, setSource] = useState(initialSource);
  const [desde, setDesde] = useState(initialDesde);
  const [hasta, setHasta] = useState(initialHasta);

  function aplicar(e: React.FormEvent) {
    e.preventDefault();
    const usp = new URLSearchParams();
    if (level) usp.set("level", level);
    if (source.trim()) usp.set("source", source.trim());
    if (desde) usp.set("desde", desde);
    if (hasta) usp.set("hasta", hasta);
    router.push(`/admin/logs${usp.toString() ? `?${usp.toString()}` : ""}`);
  }

  function limpiar() {
    setLevel("");
    setSource("");
    setDesde("");
    setHasta("");
    router.push("/admin/logs");
  }

  return (
    <form onSubmit={aplicar} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Level
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="rounded-sm border-[1.5px] border-light bg-card px-2 py-1.5 text-[12px] font-semibold text-dark outline-none focus:border-brand-blue-main"
        >
          <option value="">(todos)</option>
          <option value="critical">critical</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Source contiene
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="ej. api:tickets"
          className="w-48 rounded-sm border-[1.5px] border-light bg-card px-2 py-1.5 font-mono text-[12px] text-dark outline-none focus:border-brand-blue-main"
        />
      </label>

      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Desde
        <input
          type="datetime-local"
          value={desde}
          onChange={(e) => setDesde(e.target.value)}
          className="rounded-sm border-[1.5px] border-light bg-card px-2 py-1.5 text-[12px] text-dark outline-none focus:border-brand-blue-main"
        />
      </label>

      <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Hasta
        <input
          type="datetime-local"
          value={hasta}
          onChange={(e) => setHasta(e.target.value)}
          className="rounded-sm border-[1.5px] border-light bg-card px-2 py-1.5 text-[12px] text-dark outline-none focus:border-brand-blue-main"
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
