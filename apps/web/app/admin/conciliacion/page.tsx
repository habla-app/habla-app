// /admin/conciliacion — Lote 8.
//
// 3 secciones:
//   1) Cargar extracto (link al endpoint, instrucciones; no implementamos
//      uploader UI con auth admin compleja en este lote — usar `curl`).
//   2) Conciliados (esperado ↔ real).
//   3) Pendientes (esperados sin matchear + reales sin matchear).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { pagosHabilitados } from "@/lib/feature-flags";
import { PreviewBanner } from "@/components/admin/contabilidad/PreviewBanner";

export const dynamic = "force-dynamic";

export default async function ConciliacionPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin/conciliacion");
  if (session.user.rol !== "ADMIN") redirect("/");

  const flag = pagosHabilitados();

  const [cargas, conciliados, pendEsp, pendReal] = await Promise.all([
    prisma.cargaExtractoBanco.findMany({
      orderBy: { cargadoEn: "desc" },
      take: 10,
    }),
    prisma.movimientoBancoEsperado.findMany({
      where: { conciliadoConId: { not: null } },
      include: { conciliadoCon: true, asiento: { select: { descripcion: true, origenTipo: true } } },
      orderBy: { fecha: "desc" },
      take: 100,
    }),
    prisma.movimientoBancoEsperado.findMany({
      where: { conciliadoConId: null },
      include: { asiento: { select: { descripcion: true, origenTipo: true } } },
      orderBy: { fecha: "asc" },
      take: 100,
    }),
    prisma.movimientoBancoReal.findMany({
      where: { esperados: { none: {} } },
      orderBy: { fecha: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[28px] font-black uppercase tracking-[0.02em] text-white">
          🏦 Conciliación bancaria
        </h1>
        <p className="mt-1 text-sm text-gray-300">
          Esperado (proyección desde Caja-Banco) vs Real (extracto Interbank).
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold">
          <Link href="/admin/contabilidad" className="text-blue-400 hover:underline">
            ← Contabilidad
          </Link>
        </div>
      </header>

      <PreviewBanner enabled={flag} />

      <section className="mb-6 rounded-md bg-white p-5 text-gray-900">
        <h2 className="mb-2 font-display text-lg font-black uppercase">
          Cargar extracto
        </h2>
        <p className="text-sm text-gray-700">
          Subir CSV Interbank vía:
        </p>
        <pre className="mt-2 overflow-x-auto rounded bg-gray-100 p-3 text-xs">
{`curl -X POST -H "Authorization: Bearer $CRON_SECRET" \\
  -F "archivo=@interbank-2026-04.csv" \\
  https://hablaplay.com/api/v1/admin/contabilidad/cargar-extracto`}
        </pre>
        <h3 className="mt-4 text-sm font-bold">Cargas previas</h3>
        <table className="mt-2 w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Cargado</th>
              <th className="px-2 py-1 text-left">Archivo</th>
              <th className="px-2 py-1 text-right">Total</th>
              <th className="px-2 py-1 text-right">Insertados</th>
              <th className="px-2 py-1 text-right">Duplicados</th>
              <th className="px-2 py-1 text-right">Errores</th>
            </tr>
          </thead>
          <tbody>
            {cargas.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="px-2 py-1 font-mono">{c.cargadoEn.toISOString().slice(0, 16)}</td>
                <td className="px-2 py-1">{c.archivoNombre}</td>
                <td className="px-2 py-1 text-right font-mono">{c.filasTotales}</td>
                <td className="px-2 py-1 text-right font-mono text-green-700">{c.filasInsertadas}</td>
                <td className="px-2 py-1 text-right font-mono">{c.filasDuplicadas}</td>
                <td className="px-2 py-1 text-right font-mono text-red-700">{c.filasError}</td>
              </tr>
            ))}
            {cargas.length === 0 && (
              <tr><td colSpan={6} className="py-3 text-center text-gray-500">Sin cargas todavía.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-6 rounded-md bg-white p-5 text-gray-900">
        <h2 className="mb-2 font-display text-lg font-black uppercase">
          ✅ Conciliados ({conciliados.length})
        </h2>
        <table className="w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Fecha esp.</th>
              <th className="px-2 py-1 text-right">Monto</th>
              <th className="px-2 py-1 text-left">Esperado</th>
              <th className="px-2 py-1 text-left">Real (banco)</th>
            </tr>
          </thead>
          <tbody>
            {conciliados.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="px-2 py-1 font-mono">{c.fecha.toISOString().slice(0, 10)}</td>
                <td className="px-2 py-1 text-right font-mono">S/ {Number(c.monto.toString()).toFixed(2)}</td>
                <td className="px-2 py-1">{c.asiento.origenTipo} · {c.descripcion}</td>
                <td className="px-2 py-1 text-gray-600">
                  {c.conciliadoCon?.fecha.toISOString().slice(0, 10)} · {c.conciliadoCon?.descripcion}
                </td>
              </tr>
            ))}
            {conciliados.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-center text-gray-500">Sin conciliados aún.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md bg-yellow-50 p-5 text-gray-900">
          <h2 className="mb-2 font-display text-lg font-black uppercase text-yellow-900">
            🟡 Esperados sin match ({pendEsp.length})
          </h2>
          <p className="mb-2 text-xs text-yellow-800">
            Plata que el sistema espera ver en banco pero no aparece todavía.
          </p>
          <table className="w-full text-xs">
            <thead className="bg-yellow-100">
              <tr>
                <th className="px-2 py-1 text-left">Fecha</th>
                <th className="px-2 py-1 text-right">Monto</th>
                <th className="px-2 py-1 text-left">Origen</th>
              </tr>
            </thead>
            <tbody>
              {pendEsp.map((e) => (
                <tr key={e.id} className="border-b border-yellow-200">
                  <td className="px-2 py-1 font-mono">{e.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-2 py-1 text-right font-mono">S/ {Number(e.monto.toString()).toFixed(2)}</td>
                  <td className="px-2 py-1">{e.asiento.origenTipo}</td>
                </tr>
              ))}
              {pendEsp.length === 0 && (
                <tr><td colSpan={3} className="py-3 text-center text-yellow-700">Sin pendientes.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-md bg-red-50 p-5 text-gray-900">
          <h2 className="mb-2 font-display text-lg font-black uppercase text-red-900">
            🔴 Reales sin match ({pendReal.length})
          </h2>
          <p className="mb-2 text-xs text-red-800">
            Movimientos del banco que el sistema NO esperaba — investigar.
          </p>
          <table className="w-full text-xs">
            <thead className="bg-red-100">
              <tr>
                <th className="px-2 py-1 text-left">Fecha</th>
                <th className="px-2 py-1 text-right">Monto</th>
                <th className="px-2 py-1 text-left">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {pendReal.map((r) => (
                <tr key={r.id} className="border-b border-red-200">
                  <td className="px-2 py-1 font-mono">{r.fecha.toISOString().slice(0, 10)}</td>
                  <td className="px-2 py-1 text-right font-mono">S/ {Number(r.monto.toString()).toFixed(2)}</td>
                  <td className="px-2 py-1">{r.descripcion}</td>
                </tr>
              ))}
              {pendReal.length === 0 && (
                <tr><td colSpan={3} className="py-3 text-center text-red-700">Sin pendientes.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-xs text-gray-400">
        Para conciliar manualmente: <code>POST /admin/contabilidad/conciliar-manual</code> con body{" "}
        <code>{`{ esperadoId, realId }`}</code> + Bearer CRON_SECRET.
      </p>
    </div>
  );
}
