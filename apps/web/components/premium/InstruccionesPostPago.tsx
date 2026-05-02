// InstruccionesPostPago — pasos numerados post-pago (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/post-pago.spec.md.

const PASOS: Array<{ titulo: string; detalle: string }> = [
  {
    titulo: "Únete al Channel",
    detalle: "con el botón verde de arriba.",
  },
  {
    titulo: "Recibirás 2-4 picks/día",
    detalle: "con razonamiento estadístico completo.",
  },
  {
    titulo: "El primer pick llega en menos de 24h",
    detalle: "(excepto domingos cuando hay menos partidos).",
  },
  {
    titulo: "Para FAQ 24/7",
    detalle: "envía cualquier mensaje al WhatsApp del bot.",
  },
];

export function InstruccionesPostPago() {
  return (
    <section
      aria-label="Qué pasa ahora"
      className="border-t border-light bg-card px-4 py-5"
    >
      <h3 className="mb-3.5 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.06em] text-muted-d">
        <span aria-hidden>📋</span> Qué pasa ahora
      </h3>
      <ol className="space-y-3">
        {PASOS.map((paso, idx) => (
          <li key={paso.titulo} className="flex items-start gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-gold-dim font-display text-[13px] font-extrabold text-brand-gold-dark"
            >
              {idx + 1}
            </span>
            <p className="text-body-sm leading-snug text-body">
              <strong className="text-dark">{paso.titulo}</strong>{" "}
              {paso.detalle}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
