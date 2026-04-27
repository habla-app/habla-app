// /admin/ingresos — Lote 8.
// Lee del ledger filtrando por origenTipo IN (CIERRE_TORNEO, CANJE_APROBADO)
// y agrupa por mes. Reemplaza las tablas dedicadas IngresoRake/IngresoCanje
// que NO se crean (fuente única = ledger).

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@habla/db";
import { pagosHabilitados } from "@/lib/feature-flags";
import { PreviewBanner } from "@/components/admin/contabilidad/PreviewBanner";

export const dynamic = "force-dynamic";

interface MesAgregado {
  mes: string;
  rake: number;
  canjes: number;
  igvGenerado: number;
}

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminIngresosPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/admin/ingresos");
  if (session.user.rol !== "ADMIN") redirect("/");

  const flag = pagosHabilitados();

  const asientos = await prisma.asiento.findMany({
    where: { origenTipo: { in: ["CIERRE_TORNEO", "CANJE_APROBADO"] } },
    include: { lineas: { include: { cuenta: { select: { codigo: true } } } } },
    orderBy: { fecha: "desc" },
  });

  const porMes = new Map<string, MesAgregado>();
  for (const a of asientos) {
    const mes = ymd(a.fecha);
    const acc = porMes.get(mes) ?? { mes, rake: 0, canjes: 0, igvGenerado: 0 };
    for (const l of a.lineas) {
      const haber = Number(l.haber.toString());
      if (l.cuenta.codigo === "7010") acc.rake += haber;
      if (l.cuenta.codigo === "7020") acc.canjes += haber;
      if (l.cuenta.codigo === "4040") acc.igvGenerado += haber;
    }
    porMes.set(mes, acc);
  }
  const meses = Array.from(porMes.values()).sort((a, b) => (a.mes < b.mes ? 1 : -1));

  const totalRake = meses.reduce((a, m) => a + m.rake, 0);
  const totalCanjes = meses.reduce((a, m) => a + m.canjes, 0);
  const totalIgv = meses.reduce((a, m) => a + m.igvGenerado, 0);

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 pt-6 md:px-6 md:pt-8">
      <header className="mb-5">
        <h1 className="font-display text-[28px] font-black uppercase tracking-[0.02em] text-white">
          💰 Ingresos por mes
        </h1>
        <p className="mt-1 text-sm text-gray-300">
          Lectura del ledger por origenTipo: CIERRE_TORNEO + CANJE_APROBADO.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-[12px] font-semibold">
          <Link href="/admin/contabilidad" className="text-blue-400 hover:underline">
            ← Contabilidad
          </Link>
        </div>
      </header>

      <PreviewBanner enabled={flag} />

      <section className="rounded-md bg-white p-5 text-gray-900">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Mes</th>
              <th className="px-2 py-1 text-right">Rake (neto)</th>
              <th className="px-2 py-1 text-right">Canjes (neto)</th>
              <th className="px-2 py-1 text-right">IGV generado</th>
            </tr>
          </thead>
          <tbody>
            {meses.map((m) => (
              <tr key={m.mes} className="border-b border-gray-100">
                <td className="px-2 py-2 font-mono">{m.mes}</td>
                <td className="px-2 py-2 text-right font-mono">S/ {m.rake.toFixed(2)}</td>
                <td className="px-2 py-2 text-right font-mono">S/ {m.canjes.toFixed(2)}</td>
                <td className="px-2 py-2 text-right font-mono">S/ {m.igvGenerado.toFixed(2)}</td>
              </tr>
            ))}
            {meses.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-gray-500">Sin ingresos registrados.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 font-bold">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2 text-right font-mono">S/ {totalRake.toFixed(2)}</td>
              <td className="px-2 py-2 text-right font-mono">S/ {totalCanjes.toFixed(2)}</td>
              <td className="px-2 py-2 text-right font-mono">S/ {totalIgv.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
