// /admin/contabilidad — Lote 8.
//
// Server Component que lee directo de Prisma (rol ADMIN ya validado):
//   - Balance General agrupado por tipo de cuenta.
//   - Estado de Resultados del mes (filtro searchParams.mes).
//   - Libro Diario (últimos 50 asientos, paginado simple).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { pagosHabilitados } from "@/lib/feature-flags";
import { PreviewBanner } from "@/components/admin/contabilidad/PreviewBanner";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { mes?: string; page?: string };
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rangoMes(mes: string | undefined): { desde: Date; hasta: Date } {
  if (!mes || !mes.match(/^\d{4}-\d{2}$/)) {
    const ahora = new Date();
    const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const hasta = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));
    return { desde, hasta };
  }
  const [y, m] = mes.split("-").map(Number);
  return {
    desde: new Date(Date.UTC(y, m - 1, 1)),
    hasta: new Date(Date.UTC(y, m, 1)),
  };
}

export default async function ContabilidadPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin/contabilidad");
  if (session.user.rol !== "ADMIN") redirect("/");

  const flag = pagosHabilitados();
  const mesActual = searchParams.mes ?? ymd(new Date());
  const rango = rangoMes(mesActual);
  const page = Math.max(1, Number(searchParams.page ?? "1"));
  const limit = 50;

  const [cuentas, asientosMes, asientosLista, totalAsientos] = await Promise.all([
    prisma.cuentaContable.findMany({ orderBy: { codigo: "asc" } }),
    prisma.asiento.findMany({
      where: { fecha: { gte: rango.desde, lt: rango.hasta } },
      include: { lineas: { include: { cuenta: { select: { codigo: true, tipo: true } } } } },
    }),
    prisma.asiento.findMany({
      include: {
        lineas: {
          include: { cuenta: { select: { codigo: true, nombre: true } } },
        },
      },
      orderBy: { fecha: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.asiento.count(),
  ]);

  // Agrupar cuentas por tipo.
  const porTipo = new Map<string, typeof cuentas>();
  for (const c of cuentas) {
    const arr = porTipo.get(c.tipo) ?? [];
    arr.push(c);
    porTipo.set(c.tipo, arr);
  }

  // Calcular ingreso/gasto del mes desde asientosMes.
  let ingresoMes = 0;
  let gastoMes = 0;
  for (const a of asientosMes) {
    for (const l of a.lineas) {
      const debe = Number(l.debe.toString());
      const haber = Number(l.haber.toString());
      if (l.cuenta.tipo === "INGRESO") ingresoMes += haber - debe;
      else if (l.cuenta.tipo === "GASTO") gastoMes += debe - haber;
    }
  }
  const resultadoMes = ingresoMes - gastoMes;

  // Identidad fundamental (suma por tipo del balance general)
  const sumaPorTipo = (tipo: string) =>
    cuentas
      .filter((c) => c.tipo === tipo)
      .reduce((acc, c) => acc + Number(c.saldoActual.toString()), 0);
  const totalActivo = sumaPorTipo("ACTIVO");
  const totalPasivo = sumaPorTipo("PASIVO");
  const totalPatrimonio = sumaPorTipo("PATRIMONIO");
  const totalIngreso = sumaPorTipo("INGRESO");
  const totalGasto = sumaPorTipo("GASTO");
  const lhs = totalActivo;
  const rhs = totalPasivo + totalPatrimonio + (totalIngreso - totalGasto);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[28px] font-black uppercase tracking-[0.02em] text-white">
          📒 Contabilidad
        </h1>
        <p className="mt-1 text-sm text-gray-300">
          Balance General · Estado de Resultados · Libro Diario.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold">
          <Link href="/admin" className="text-blue-400 hover:underline">
            ← Panel admin
          </Link>
          <Link href="/admin/conciliacion" className="text-blue-400 hover:underline">
            🏦 Conciliación bancaria →
          </Link>
          <Link href="/admin/ingresos" className="text-blue-400 hover:underline">
            💰 Ingresos por mes →
          </Link>
        </div>
      </header>

      <PreviewBanner enabled={flag} />

      <section className="mb-6 rounded-md bg-white p-5 text-gray-900">
        <h2 className="mb-3 font-display text-lg font-black uppercase">
          Balance General
        </h2>
        {Array.from(porTipo.entries()).map(([tipo, lista]) => (
          <div key={tipo} className="mb-4">
            <h3 className="mb-1 text-sm font-bold text-gray-700">{tipo}</h3>
            <table className="w-full text-sm">
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="py-1 font-mono text-xs text-gray-500">
                      {c.codigo}
                    </td>
                    <td className="py-1">{c.nombre}</td>
                    <td className="py-1 text-right font-mono">
                      S/ {Number(c.saldoActual.toString()).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        <div className="mt-3 rounded bg-gray-50 p-3 text-xs">
          <div>
            ∑ Activo = <strong>S/ {lhs.toFixed(2)}</strong>
          </div>
          <div>
            ∑ Pasivo + Patrimonio + (Ingreso − Gasto) ={" "}
            <strong>S/ {rhs.toFixed(2)}</strong>
          </div>
          <div className={Math.abs(lhs - rhs) < 0.01 ? "text-green-700" : "text-red-700"}>
            Identidad fundamental: <strong>{Math.abs(lhs - rhs) < 0.01 ? "✅ cuadra" : "❌ NO cuadra"}</strong>
          </div>
        </div>
      </section>

      <section className="mb-6 rounded-md bg-white p-5 text-gray-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-black uppercase">
            Estado de Resultados — {mesActual}
          </h2>
          <form>
            <input
              type="month"
              name="mes"
              defaultValue={mesActual}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <button type="submit" className="ml-2 rounded bg-blue-600 px-3 py-1 text-sm font-semibold text-white">
              Filtrar
            </button>
          </form>
        </div>
        <table className="w-full text-sm">
          <tbody>
            <tr><td>Ingresos</td><td className="text-right font-mono">S/ {ingresoMes.toFixed(2)}</td></tr>
            <tr><td>Gastos</td><td className="text-right font-mono">S/ {gastoMes.toFixed(2)}</td></tr>
            <tr className="border-t border-gray-300"><td className="py-1 font-bold">Resultado neto</td><td className={`text-right font-mono font-bold ${resultadoMes >= 0 ? "text-green-700" : "text-red-700"}`}>S/ {resultadoMes.toFixed(2)}</td></tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-md bg-white p-5 text-gray-900">
        <h2 className="mb-3 font-display text-lg font-black uppercase">
          Libro Diario ({totalAsientos.toLocaleString()} asientos)
        </h2>
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Fecha</th>
              <th className="px-2 py-1 text-left">Origen</th>
              <th className="px-2 py-1 text-left">Descripción</th>
              <th className="px-2 py-1 text-right">Debe</th>
              <th className="px-2 py-1 text-right">Haber</th>
            </tr>
          </thead>
          <tbody>
            {asientosLista.map((a) => (
              <tr key={a.id} className="border-b border-gray-100 align-top">
                <td className="px-2 py-1 font-mono text-gray-500">
                  {a.fecha.toISOString().slice(0, 10)}
                </td>
                <td className="px-2 py-1 text-gray-700">{a.origenTipo}</td>
                <td className="px-2 py-1">
                  <div>{a.descripcion}</div>
                  <div className="mt-1 text-[10px] text-gray-500">
                    {a.lineas.map((l) => (
                      <div key={l.id}>
                        {l.cuenta.codigo} {l.cuenta.nombre} —{" "}
                        D: S/ {Number(l.debe.toString()).toFixed(2)} ·{" "}
                        H: S/ {Number(l.haber.toString()).toFixed(2)}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  S/ {Number(a.totalDebe.toString()).toFixed(2)}
                </td>
                <td className="px-2 py-1 text-right font-mono">
                  S/ {Number(a.totalHaber.toString()).toFixed(2)}
                </td>
              </tr>
            ))}
            {asientosLista.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-gray-500">Sin asientos.</td></tr>
            )}
          </tbody>
        </table>
        <div className="mt-3 flex gap-2 text-sm">
          {page > 1 && (
            <Link href={`/admin/contabilidad?mes=${mesActual}&page=${page - 1}`} className="rounded bg-gray-200 px-3 py-1">
              ← Anterior
            </Link>
          )}
          {page * limit < totalAsientos && (
            <Link href={`/admin/contabilidad?mes=${mesActual}&page=${page + 1}`} className="rounded bg-gray-200 px-3 py-1">
              Siguiente →
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
