"use client";
// NuevaConversionForm — Lote 7.
//
// Form inline arriba de /admin/conversiones para registrar manualmente
// una conversión reportada por la casa. Sin modal: la lista debajo se
// recarga (router.refresh) tras un submit ok. Si falla, mostramos toast
// + error inline; el form NO se limpia para que el admin pueda corregir.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import {
  TIPOS_CONVERSION,
  type AfiliadoVista,
  type TipoConversion,
} from "@/lib/services/afiliacion.service";

interface Props {
  afiliados: Pick<AfiliadoVista, "id" | "nombre" | "slug">[];
  /** Si viene seteado, el form arranca con ese afiliado pre-seleccionado
   *  (caso: el usuario llegó desde /admin/afiliados/[id] vía link). */
  afiliadoIdInicial?: string;
}

const INPUT_CLASS =
  "w-full rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10";

function hoyYmd(): string {
  // YYYY-MM-DD en hora Lima.
  const d = new Date();
  const tz = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return tz.format(d);
}

export function NuevaConversionForm({ afiliados, afiliadoIdInicial }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [afiliadoId, setAfiliadoId] = useState(
    afiliadoIdInicial ?? afiliados[0]?.id ?? "",
  );
  const [tipo, setTipo] = useState<TipoConversion>("FTD");
  const [montoComision, setMontoComision] = useState("");
  const [reportadoEn, setReportadoEn] = useState(hoyYmd());
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const payload = {
      afiliadoId,
      tipo,
      montoComision:
        montoComision.trim() === "" ? null : Number(montoComision),
      reportadoEn,
      notas: notas.trim() || null,
    };

    setEnviando(true);
    try {
      const res = await authedFetch("/api/v1/admin/conversiones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message ?? "Error al registrar.");
      }
      toast.show("✅ Conversión registrada");
      // Reset campos volátiles, conservar el afiliado seleccionado para
      // no obligar al admin a re-elegirlo si va a cargar varias seguidas.
      setMontoComision("");
      setNotas("");
      setReportadoEn(hoyYmd());
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }

  if (afiliados.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-light bg-subtle px-4 py-6 text-center text-[13px] text-muted-d">
        No hay afiliados todavía. Andá a{" "}
        <a
          href="/admin/afiliados/nuevo"
          className="font-semibold text-brand-blue-main hover:underline"
        >
          /admin/afiliados/nuevo
        </a>{" "}
        y cargá uno para poder registrar conversiones.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border-[1.5px] border-dashed border-brand-blue-main bg-brand-blue-main/[0.04] p-4"
    >
      <h3 className="mb-3 font-display text-[14px] font-black uppercase tracking-[0.04em] text-brand-blue-main">
        Registrar conversión manual
      </h3>
      {error ? (
        <div className="mb-3 rounded-sm border border-urgent-critical/30 bg-urgent-critical-bg/50 px-3 py-2 text-[12px] text-urgent-critical">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d lg:col-span-2">
          Afiliado
          <select
            value={afiliadoId}
            onChange={(e) => setAfiliadoId(e.target.value)}
            className={INPUT_CLASS}
            required
          >
            {afiliados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} ({a.slug})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoConversion)}
            className={INPUT_CLASS}
            required
          >
            {TIPOS_CONVERSION.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          Monto comisión (S/)
          <input
            type="number"
            min={0}
            step="0.01"
            value={montoComision}
            onChange={(e) => setMontoComision(e.target.value)}
            placeholder="100.00"
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
          Fecha reporte
          <input
            type="date"
            value={reportadoEn}
            onChange={(e) => setReportadoEn(e.target.value)}
            className={INPUT_CLASS}
            required
          />
        </label>
      </div>

      <label className="mt-3 flex flex-col gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        Notas (opcional)
        <textarea
          rows={2}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="ej: usuario @juan123, registró el 28-abr"
          className={INPUT_CLASS}
        />
      </label>

      <div className="mt-3">
        <Button type="submit" variant="primary" size="md" disabled={enviando}>
          {enviando ? "Guardando…" : "Registrar conversión"}
        </Button>
      </div>
    </form>
  );
}
