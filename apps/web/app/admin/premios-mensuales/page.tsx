// /admin/premios-mensuales — herramienta interna (Lote 5).
//
// Lista los registros PremioMensual creados al cerrar leaderboards. Filtros
// por estado (PENDIENTE | COORDINADO | PAGADO | CANCELADO) y por mes.
// Cada fila tiene CRUD inline (estado + datosPago + notas) y un botón
// "Copiar template" con el texto canónico de respuesta para que Gustavo
// conteste el email del ganador desde Resend.

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  listarPremios,
  PREMIO_PRIMER_PUESTO,
  type EstadoPremio,
  esEstadoValido,
} from "@/lib/services/leaderboard.service";
import { AdminPremiosMensualesPanel } from "@/components/admin/AdminPremiosMensualesPanel";

export const dynamic = "force-dynamic";

interface Props {
  searchParams?: { estado?: string; mes?: string };
}

export default async function AdminPremiosMensualesPage({
  searchParams,
}: Props) {
  const session = await auth();
  if (!session?.user) {
    redirect("/auth/signin?callbackUrl=/admin/premios-mensuales");
  }
  if (session.user.rol !== "ADMIN") redirect("/");

  const estado: EstadoPremio | undefined =
    searchParams?.estado && esEstadoValido(searchParams.estado)
      ? searchParams.estado
      : undefined;
  const mes = searchParams?.mes;

  const premios = await listarPremios({ estado, mes });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 md:px-6 md:pt-8 lg:pt-10">
      <header className="mb-5">
        <h1 className="font-display text-[32px] font-black uppercase tracking-[0.02em] text-dark md:text-[40px]">
          💰 Premios mensuales
        </h1>
        <p className="mt-1 text-sm text-muted-d">
          Estado de los pagos al Top 10 del leaderboard mensual. Marcá el
          estado conforme coordinás con el ganador.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold text-brand-blue-main">
          <Link href="/admin" className="hover:underline">
            ← Volver a Admin
          </Link>
          <Link href="/admin/leaderboard" className="hover:underline">
            Ir a leaderboard →
          </Link>
        </div>
      </header>

      <AdminPremiosMensualesPanel
        premios={premios.map((p) => ({
          ...p,
          // pasamos `creadoEn` y `pagadoEn` como ISO strings para evitar
          // problemas de serialización entre RSC y Client Component.
          creadoEn: p.creadoEn.toISOString(),
          pagadoEn: p.pagadoEn ? p.pagadoEn.toISOString() : null,
        }))}
        filtroEstado={estado ?? "TODOS"}
        filtroMes={mes ?? ""}
        premioPrimerPuesto={PREMIO_PRIMER_PUESTO}
      />
    </div>
  );
}
