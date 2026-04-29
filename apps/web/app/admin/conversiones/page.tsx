// /admin/conversiones — listado + form de conversiones afiliadas (Lote 7).
//
// Form arriba: registra manualmente una conversión reportada por la casa.
// Lista debajo: histórico filtrado por afiliado y rango de fechas.
//
// Los filtros viven en el query string (?afiliadoId=, ?desde=, ?hasta=)
// para que sean linkeables desde otras pages (ej. /admin/afiliados/[id]
// linkea aquí con afiliadoId pre-filtrado).

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { NuevaConversionForm } from "@/components/admin/NuevaConversionForm";
import {
  listarConversiones,
  listarTodos,
} from "@/lib/services/afiliacion.service";
import { ConversionesFiltros } from "@/components/admin/ConversionesFiltros";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: {
    afiliadoId?: string;
    desde?: string;
    hasta?: string;
  };
}

export default async function AdminConversionesPage({
  searchParams,
}: PageProps) {
  const afiliadoId = searchParams.afiliadoId?.trim() || undefined;
  const desde = searchParams.desde ? new Date(searchParams.desde) : undefined;
  const hasta = searchParams.hasta ? new Date(searchParams.hasta) : undefined;

  const [afiliados, conversiones] = await Promise.all([
    listarTodos(),
    listarConversiones({ afiliadoId, desde, hasta }),
  ]);

  // Para el form: sólo afiliados activos (no tiene sentido cargar
  // conversiones de operadores apagados desde la UI, aunque el endpoint
  // no lo prohíbe — no hay razón funcional para impedirlo).
  const afiliadosForm = afiliados.filter((a) => a.activo);

  // Total revenue del rango listado (sólo de la página actual — el endpoint
  // ya devuelve hasta 200 filas).
  const revenueTotal = conversiones.reduce(
    (acc, c) => acc + (c.montoComision ?? 0),
    0,
  );

  return (
    <>
      <AdminPageHeader
        icon="💵"
        title="Conversiones"
        description="Registros manuales de REGISTRO/FTD reportados por las casas. Nos sirven para reconciliar al cierre del mes con lo que paga el partner."
      />

      <section className="mb-6">
        <NuevaConversionForm
          afiliados={afiliadosForm.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            slug: a.slug,
          }))}
          afiliadoIdInicial={afiliadoId}
        />
      </section>

      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <ConversionesFiltros
          afiliados={afiliados.map((a) => ({
            id: a.id,
            nombre: a.nombre,
            slug: a.slug,
          }))}
          actualAfiliadoId={afiliadoId ?? ""}
          actualDesde={searchParams.desde ?? ""}
          actualHasta={searchParams.hasta ?? ""}
        />

        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-t border-light pt-4">
          <h2 className="font-display text-[18px] font-black uppercase tracking-[0.02em] text-dark">
            Conversiones registradas
          </h2>
          <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
            {conversiones.length} en este rango ·{" "}
            <span className="text-dark">
              S/{" "}
              {revenueTotal.toLocaleString("es-PE", {
                minimumFractionDigits: 2,
              })}{" "}
              total
            </span>
          </span>
        </div>

        {conversiones.length === 0 ? (
          <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-8 text-center text-[13px] text-muted-d">
            No hay conversiones que coincidan con los filtros. Si nunca
            registraste ninguna, usá el form de arriba.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-light">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-subtle text-left font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Reportada</th>
                  <th className="px-3 py-2">Afiliado</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2 text-right">Comisión (S/)</th>
                  <th className="px-3 py-2">Notas</th>
                  <th className="px-3 py-2">Cargada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {conversiones.map((c) => (
                  <tr key={c.id} className="text-dark hover:bg-subtle/60">
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                      {c.reportadoEn.toLocaleDateString("es-PE", {
                        timeZone: "America/Lima",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{c.afiliadoNombre}</div>
                      <div className="font-mono text-[11px] text-muted-d">
                        {c.afiliadoSlug}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-block rounded-sm border border-light bg-subtle px-2 py-0.5 font-mono text-[11px] font-bold text-dark">
                        {c.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-display font-black tabular-nums">
                      {c.montoComision != null
                        ? c.montoComision.toLocaleString("es-PE", {
                            minimumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted-d">
                      {c.notas ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                      {c.creadoEn.toLocaleDateString("es-PE", {
                        timeZone: "America/Lima",
                        day: "2-digit",
                        month: "short",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
