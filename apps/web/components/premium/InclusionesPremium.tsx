// InclusionesPremium — lista de "Lo que recibes" en la landing (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// 5 items con check verde + texto. Cada item tiene un strong destacado
// para el valor principal y luego una explicación corta.

const ITEMS: Array<{ titulo: string; detalle: string }> = [
  {
    titulo: "2-4 picks/día",
    detalle:
      "con razonamiento estadístico (datos H2H, forma reciente, EV+)",
  },
  {
    titulo: "Casa con mejor cuota",
    detalle: "incluida en cada pick — link directo",
  },
  {
    titulo: "Alertas en vivo",
    detalle:
      "durante partidos top (cambios de cuotas, oportunidades)",
  },
  {
    titulo: "Bot FAQ 24/7",
    detalle: "en WhatsApp para resolver dudas al instante",
  },
  {
    titulo: "Resumen semanal",
    detalle: "los lunes con performance de los picks",
  },
];

export function InclusionesPremium() {
  return (
    <section
      aria-label="Lo que recibes con Premium"
      className="border-t border-light bg-card px-4 py-6"
    >
      <h2 className="mb-4 text-center font-display text-display-sm font-extrabold uppercase tracking-tight text-dark">
        Lo que recibes
      </h2>
      <ul className="space-y-3">
        {ITEMS.map((it) => (
          <li key={it.titulo} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-status-green text-[11px] text-white"
            >
              ✓
            </span>
            <p className="text-body-sm leading-snug text-body">
              <strong className="text-dark">{it.titulo}</strong>{" "}
              {it.detalle}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
