// MesesCerradosLink — sección de meses cerrados al pie de /comunidad
// (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/comunidad.spec.md.
//
// Lista los últimos 6 meses cerrados con el ganador y monto del 1° puesto.
// Cada item linkea a /comunidad/mes/[mes] (vista histórica del Lote 5).

import Link from "next/link";

const FMT_FECHA = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Lima",
});

interface MesCerrado {
  mes: string;
  nombreMes: string;
  cerradoEn: Date;
  totalUsuarios: number;
}

interface MesesCerradosLinkProps {
  meses: MesCerrado[];
}

export function MesesCerradosLink({ meses }: MesesCerradosLinkProps) {
  if (meses.length === 0) return null;

  return (
    <section className="bg-card px-4 py-4">
      <h2 className="mb-3 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        <span aria-hidden>📜</span>
        Meses cerrados
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {meses.slice(0, 6).map((m) => (
          <Link
            key={m.mes}
            href={`/comunidad/mes/${m.mes}`}
            className="touch-target rounded-md border border-light bg-card px-3 py-2.5 transition-all hover:border-brand-blue-main"
          >
            <p className="font-display text-display-xs font-bold capitalize text-dark">
              {m.nombreMes}
            </p>
            <p className="text-label-md text-muted-d">
              {m.totalUsuarios.toLocaleString("es-PE")} tipsters · cerrado{" "}
              {FMT_FECHA.format(m.cerradoEn)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
