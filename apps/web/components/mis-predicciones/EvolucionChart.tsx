// EvolucionChart — line chart de "Puntos por mes" para /mis-predicciones
// (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/mis-predicciones.spec.md.
//
// Implementado con SVG nativo en vez de Recharts — el bundle de Recharts
// pesa ~150kB minificado y para una vista que solo necesita un line chart
// pequeño no justifica el costo en LCP/INP de mobile. Si el chart crece a
// múltiples series, se migra a Recharts.
//
// Si hay menos de 2 meses con data, el componente devuelve null (la page
// decide ocultar la sección).

import type { EvolucionMes } from "@/lib/services/leaderboard.service";

interface EvolucionChartProps {
  data: EvolucionMes[];
}

const W = 320;
const H = 80;
const PAD_X = 12;
const PAD_Y = 16;

export function EvolucionChart({ data }: EvolucionChartProps) {
  const conActividad = data.filter((d) => d.predicciones > 0);
  if (conActividad.length < 2) return null;

  const max = Math.max(1, ...data.map((d) => d.puntosTotal));
  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const puntos = data.map((d, idx) => {
    const x = PAD_X + idx * stepX;
    const y = PAD_Y + innerH - (d.puntosTotal / max) * innerH;
    return { x, y, d };
  });

  const path = puntos
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const fillPath = `${path} L ${puntos[puntos.length - 1]!.x.toFixed(1)} ${(H - PAD_Y).toFixed(1)} L ${puntos[0]!.x.toFixed(1)} ${(H - PAD_Y).toFixed(1)} Z`;

  return (
    <section className="bg-card px-4 py-4">
      <h2 className="mb-2 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        <span aria-hidden>📈</span>
        Evolución últimos {data.length} meses
      </h2>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-20 w-full text-brand-gold"
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfica de puntos por mes"
      >
        <defs>
          {/* gradient stops usan currentColor y stop-opacity para respetar
              la regla 7 (cero hex en JSX): el color base se define por la
              clase Tailwind del <svg>. */}
          <linearGradient id="evol-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill="url(#evol-grad)" />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {puntos.map((p, idx) => (
          <circle
            key={p.d.mes}
            cx={p.x}
            cy={p.y}
            r={idx === puntos.length - 1 ? 4 : 3}
            fill="currentColor"
            stroke={idx === puntos.length - 1 ? "white" : undefined}
            strokeWidth={idx === puntos.length - 1 ? 2 : 0}
          />
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-label-sm text-muted-d">
        {data.map((d) => (
          <span key={d.mes}>{d.etiqueta}</span>
        ))}
      </div>
    </section>
  );
}
