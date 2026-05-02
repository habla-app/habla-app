// RevenueDesagregado — bar chart stacked SVG nativo. Lote G.

import type { RevenueMes } from "@/lib/services/finanzas.service";
import { AdminCard } from "@/components/ui/admin/AdminCard";

interface Props {
  data: RevenueMes[];
}

export function RevenueDesagregado({ data }: Props) {
  if (data.length === 0) {
    return (
      <AdminCard title="Revenue desagregado" bodyPadding="md">
        <p className="text-admin-body text-muted-d">Sin datos.</p>
      </AdminCard>
    );
  }

  const w = 800;
  const h = 280;
  const padX = 40;
  const padY = 36;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const maxTotal = Math.max(1, ...data.map((d) => d.total));
  const barW = (chartW / data.length) * 0.7;
  const stride = chartW / data.length;

  function ys(v: number) {
    return padY + chartH - (v / maxTotal) * chartH;
  }

  return (
    <AdminCard
      title="Revenue desagregado"
      description="Premium (oro) vs Afiliación (azul) · últimos 12 meses"
      bodyPadding="md"
    >
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Revenue desagregado por mes"
        >
          {/* Eje Y */}
          {[0, 0.5, 1].map((f) => {
            const valor = maxTotal * f;
            return (
              <g key={f}>
                <line
                  x1={padX}
                  x2={padX + chartW}
                  y1={ys(valor)}
                  y2={ys(valor)}
                  className="stroke-admin-table-border"
                  strokeDasharray="2 4"
                />
                <text
                  x={padX - 6}
                  y={ys(valor) + 4}
                  className="fill-muted-d font-mono"
                  fontSize="10"
                  textAnchor="end"
                >
                  S/{Math.round(valor).toLocaleString("es-PE")}
                </text>
              </g>
            );
          })}
          {/* Barras */}
          {data.map((d, i) => {
            const x = padX + stride * i + (stride - barW) / 2;
            const yPremium = ys(d.premium);
            const altoPremium = padY + chartH - yPremium;
            const yAfil = ys(d.premium + d.afiliacion);
            const altoAfil = (d.premium + d.afiliacion - d.premium) === 0
              ? 0
              : ys(d.premium) - yAfil;
            return (
              <g key={d.mes}>
                {/* Premium (oro) */}
                <rect
                  x={x}
                  y={yPremium}
                  width={barW}
                  height={altoPremium}
                  className="fill-brand-gold"
                >
                  <title>{`${d.mes} · Premium S/${d.premium.toLocaleString("es-PE")}`}</title>
                </rect>
                {/* Afiliación (azul) */}
                <rect
                  x={x}
                  y={yAfil}
                  width={barW}
                  height={altoAfil}
                  className="fill-brand-blue-main"
                >
                  <title>{`${d.mes} · Afiliación S/${d.afiliacion.toLocaleString("es-PE")}`}</title>
                </rect>
                {/* Total encima */}
                <text
                  x={x + barW / 2}
                  y={yAfil - 4}
                  className="fill-dark font-mono"
                  fontSize="10"
                  textAnchor="middle"
                >
                  S/{d.total.toLocaleString("es-PE")}
                </text>
                {/* Eje X */}
                <text
                  x={x + barW / 2}
                  y={padY + chartH + 16}
                  className="fill-muted-d font-mono"
                  fontSize="10"
                  textAnchor="middle"
                >
                  {d.mes.slice(2)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-4 text-admin-meta text-muted-d">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm bg-brand-gold" />
          Premium
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-2.5 w-5 rounded-sm bg-brand-blue-main" />
          Afiliación
        </span>
      </div>
    </AdminCard>
  );
}
