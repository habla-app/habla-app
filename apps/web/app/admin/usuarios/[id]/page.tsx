// /admin/usuarios/[id] — detalle de usuario + acciones admin. Lote G.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminTopbar } from "@/components/ui/admin/AdminTopbar";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { UsuarioAccionesPanel } from "@/components/admin/usuarios/UsuarioAccionesPanel";
import { obtenerDetalleUsuarioAdmin } from "@/lib/services/usuarios.service";
import { listarAuditoria } from "@/lib/services/auditoria.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: { id: string };
}

export default async function UsuarioDetallePage({ params }: PageProps) {
  const usuario = await obtenerDetalleUsuarioAdmin(params.id);
  if (!usuario) notFound();

  const auditoria = await listarAuditoria({
    actorId: params.id,
    pageSize: 20,
  });

  return (
    <>
      <AdminTopbar
        title={usuario.nombre}
        description={`@${usuario.username} · ${usuario.email}`}
        breadcrumbs={[
          { label: "Sistema" },
          { label: "Usuarios", href: "/admin/usuarios" },
          { label: usuario.nombre },
        ]}
      />

      <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AdminCard title="Datos básicos" bodyPadding="md">
          <Field label="ID">
            <code className="rounded-sm bg-subtle px-1.5 py-0.5 text-[11px] text-dark">
              {usuario.id}
            </code>
          </Field>
          <Field label="Email">{usuario.email}</Field>
          <Field label="Username">@{usuario.username}</Field>
          <Field label="Nombre">{usuario.nombre}</Field>
          <Field label="Rol">
            <span
              className={
                usuario.rol === "ADMIN"
                  ? "rounded-sm bg-brand-blue-main px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-white"
                  : "rounded-sm bg-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-muted-d"
              }
            >
              {usuario.rol}
            </span>
          </Field>
          <Field label="Estado">
            {usuario.estado === "soft_deleted" ? (
              <span className="text-status-red-text font-bold">Eliminado</span>
            ) : (
              <span className="text-status-green-text">Activo</span>
            )}
          </Field>
          <Field label="Email verificado">
            {usuario.emailVerified
              ? usuario.emailVerified.toLocaleString("es-PE", {
                  timeZone: "America/Lima",
                })
              : "—"}
          </Field>
          <Field label="Registrado">
            {usuario.creadoEn.toLocaleString("es-PE", {
              timeZone: "America/Lima",
            })}
          </Field>
          <Field label="Ubicación">{usuario.ubicacion ?? "—"}</Field>
          <Field label="Teléfono">{usuario.telefono ?? "—"}</Field>
          <Field label="Perfil público">
            {usuario.perfilPublico ? "Sí" : "No"}
          </Field>
        </AdminCard>

        <AdminCard title="Actividad" bodyPadding="md">
          <Field label="Tickets">
            <span className="font-mono tabular-nums text-dark">
              {usuario.ticketsCount.toLocaleString("es-PE")}
            </span>
          </Field>
          <Field label="Conversiones afiliados">
            <span className="font-mono tabular-nums text-dark">
              {usuario.conversionesAfiliadosCount.toLocaleString("es-PE")}
            </span>
          </Field>
          {usuario.suscripcionActiva ? (
            <>
              <Field label="Suscripción Premium">
                <span className="rounded-sm bg-brand-gold-dim px-1.5 py-0.5 text-[10px] uppercase tracking-[0.06em] text-brand-gold-dark">
                  {usuario.suscripcionActiva.estado}
                </span>{" "}
                {usuario.suscripcionActiva.plan}
              </Field>
              <Field label="Iniciada">
                {usuario.suscripcionActiva.iniciada.toLocaleDateString("es-PE", {
                  timeZone: "America/Lima",
                })}
              </Field>
              <Field label="Próximo cobro">
                {usuario.suscripcionActiva.proximoCobro
                  ? usuario.suscripcionActiva.proximoCobro.toLocaleDateString(
                      "es-PE",
                      { timeZone: "America/Lima" },
                    )
                  : "—"}
              </Field>
            </>
          ) : (
            <Field label="Suscripción Premium">—</Field>
          )}
        </AdminCard>
      </section>

      <AdminCard
        title="Acciones admin"
        description="Cambios destructivos quedan registrados en auditoría con motivo"
        bodyPadding="md"
        className="mb-6"
      >
        <UsuarioAccionesPanel
          usuarioId={usuario.id}
          rolActual={usuario.rol}
          estado={usuario.estado}
        />
      </AdminCard>

      {auditoria.rows.length > 0 && (
        <AdminCard
          title="Acciones del usuario en auditoría (como actor)"
          description="Si este usuario es admin, sus acciones se listan acá"
          bodyPadding="none"
          className="mb-6"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-admin-table-border bg-admin-table-row-stripe">
                <th className="text-admin-table-header text-muted-d px-3 py-2 text-left">
                  Cuándo
                </th>
                <th className="text-admin-table-header text-muted-d px-3 py-2 text-left">
                  Acción
                </th>
                <th className="text-admin-table-header text-muted-d px-3 py-2 text-left">
                  Resumen
                </th>
              </tr>
            </thead>
            <tbody>
              {auditoria.rows.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-admin-table-border"
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-d">
                    {a.creadoEn.toLocaleString("es-PE", {
                      timeZone: "America/Lima",
                    })}
                  </td>
                  <td className="px-3 py-2">
                    <code className="rounded-sm bg-subtle px-1.5 py-0.5 text-[11px] text-dark">
                      {a.accion}
                    </code>
                  </td>
                  <td className="px-3 py-2 text-admin-body text-dark">
                    {a.resumen ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      <Link
        href="/admin/usuarios"
        className="text-admin-meta font-bold text-brand-blue-main hover:underline"
      >
        ← Volver a usuarios
      </Link>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-admin-table-border py-2 last:border-b-0">
      <span className="text-admin-label text-muted-d">{label}</span>
      <span className="text-admin-body text-dark">{children}</span>
    </div>
  );
}
