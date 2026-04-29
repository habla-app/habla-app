// /admin/afiliados — lista de afiliados (Lote 7).
//
// Tabla con todos los afiliados (incluye inactivos). Para cada uno mostramos:
//   - logo + nombre + slug
//   - modeloComision
//   - badge activo/inactivo
//   - clicks 7d, clicks 30d
//   - conversiones del mes en curso
//   - botón "Editar" → /admin/afiliados/[id]
//
// "Desactivar" se hace desde el detalle (toggle activo). Eso evita un
// confirm modal en la list page para una acción que es reversible.

import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  listarTodos,
  obtenerStatsResumenTodos,
  type AfiliadoVista,
} from "@/lib/services/afiliacion.service";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminAfiliadosPage() {
  const [afiliados, statsResumen] = await Promise.all([
    listarTodos(),
    obtenerStatsResumenTodos(),
  ]);

  return (
    <>
      <AdminPageHeader
        icon="🤝"
        title="Afiliados"
        description="Operadores autorizados por MINCETUR. El catálogo lo lee /go/[slug] y los componentes MDX (CasaCTA, CasaReviewCard, TablaCasas) que se inyectan en artículos editoriales."
        actions={
          <Link href="/admin/afiliados/nuevo">
            <Button variant="primary" size="md" type="button">
              + Nuevo afiliado
            </Button>
          </Link>
        }
      />

      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        {afiliados.length === 0 ? (
          <p className="rounded-sm border border-dashed border-light bg-subtle px-4 py-10 text-center text-[13px] text-muted-d">
            Todavía no hay afiliados cargados. Tocá <strong>+ Nuevo afiliado</strong>{" "}
            arriba para crear el primero. Los componentes MDX
            (<code className="font-mono">{"<CasaCTA>"}</code>,{" "}
            <code className="font-mono">{"<CasaReviewCard>"}</code>) van a
            renderizar <code className="font-mono">null</code> hasta que exista
            un afiliado con el slug que pasás.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-light">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="bg-subtle text-left font-body text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
                <tr>
                  <th className="px-3 py-2">Casa</th>
                  <th className="px-3 py-2">Modelo</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2 text-right">Clicks 7d</th>
                  <th className="px-3 py-2 text-right">Clicks 30d</th>
                  <th className="px-3 py-2 text-right">Conv. mes</th>
                  <th className="px-3 py-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-light">
                {afiliados.map((a) => {
                  const stats = statsResumen.get(a.id) ?? {
                    clicks7d: 0,
                    clicks30d: 0,
                    conversionesMes: 0,
                  };
                  return (
                    <tr key={a.id} className="text-dark hover:bg-subtle/60">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <LogoCell afiliado={a} />
                          <div className="min-w-0">
                            <div className="font-semibold">{a.nombre}</div>
                            <div className="font-mono text-[11px] text-muted-d">
                              /go/{a.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-block rounded-sm border border-light bg-subtle px-2 py-0.5 font-mono text-[11px] font-bold text-dark">
                          {a.modeloComision}
                        </span>
                        {a.modeloComision !== "REVSHARE" && a.montoCpa != null ? (
                          <div className="mt-0.5 text-[11px] text-muted-d">
                            S/ {a.montoCpa} CPA
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <EstadoBadge afiliado={a} />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {stats.clicks7d.toLocaleString("es-PE")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {stats.clicks30d.toLocaleString("es-PE")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={
                            stats.conversionesMes > 0
                              ? "font-bold text-alert-success-text tabular-nums"
                              : "text-muted-d tabular-nums"
                          }
                        >
                          {stats.conversionesMes}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/admin/afiliados/${a.id}`}
                          className="text-[12px] font-semibold text-brand-blue-main hover:underline"
                        >
                          Editar →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function LogoCell({ afiliado }: { afiliado: AfiliadoVista }) {
  if (afiliado.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={afiliado.logoUrl}
        alt=""
        className="h-8 w-8 flex-shrink-0 rounded-sm bg-card object-contain"
      />
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-brand-gold font-display text-[14px] font-black text-black"
    >
      {afiliado.nombre.charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function EstadoBadge({ afiliado }: { afiliado: AfiliadoVista }) {
  if (!afiliado.activo) {
    return (
      <span className="inline-block rounded-full bg-subtle px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
        Inactivo
      </span>
    );
  }
  if (!afiliado.autorizadoMincetur) {
    return (
      <span className="inline-block rounded-full bg-urgent-critical-bg px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-urgent-critical">
        Sin MINCETUR
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-alert-success-bg px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-alert-success-text">
      Activo
    </span>
  );
}
