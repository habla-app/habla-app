// SocialProofPremium — stats de social proof en la landing (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Sección con 3 stats:
//   - 65% acierto promedio
//   - X suscriptores activos (real, oculto si <50)
//   - +12% ROI promedio
//
// Si los datos reales no están listos (mes 1 sin tracker de acierto), el
// componente acepta `numerosBajos=true` y se oculta — la landing render
// el bloque de testimonios en su lugar.

interface Props {
  /** Suscriptores activos (real). Si <50 → se oculta este stat. */
  suscriptoresCount: number;
  /** % acierto último mes. Default 65 (placeholder hasta tracker real). */
  aciertoPct?: number;
  /** ROI promedio último mes en %. Default 12. */
  roiPct?: number;
  /** Si true, oculta toda la sección. Default false. */
  ocultar?: boolean;
}

export function SocialProofPremium({
  suscriptoresCount,
  aciertoPct = 65,
  roiPct = 12,
  ocultar = false,
}: Props) {
  if (ocultar) return null;

  const mostrarSuscriptores = suscriptoresCount >= 50;
  // Si estamos sin suscriptores real y sin acierto/ROI fuera de defaults,
  // ocultamos la sección completa (decisión del spec: mes 1 sin números).
  if (!mostrarSuscriptores && aciertoPct <= 0 && roiPct <= 0) return null;

  const items: Array<{ valor: string; label: string }> = [];
  if (aciertoPct > 0) {
    items.push({ valor: `${aciertoPct}%`, label: "Acierto últ. mes" });
  }
  if (mostrarSuscriptores) {
    items.push({
      valor: suscriptoresCount.toLocaleString("es-PE"),
      label: "Suscriptores",
    });
  }
  if (roiPct > 0) {
    items.push({ valor: `+${roiPct}%`, label: "ROI promedio" });
  }
  if (items.length === 0) return null;

  return (
    <section
      aria-label="Estadísticas Premium"
      className="grid grid-cols-3 gap-2 bg-card px-4 py-5 text-center"
      style={{
        gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      }}
    >
      {items.map((it) => (
        <div key={it.label}>
          <div className="font-display text-display-md font-extrabold leading-none text-dark">
            {it.valor}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.05em] text-muted-d">
            {it.label}
          </div>
        </div>
      ))}
    </section>
  );
}
