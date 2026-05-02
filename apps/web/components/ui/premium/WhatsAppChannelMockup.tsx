// WhatsAppChannelMockup — mockup decorativo del Channel privado (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// Visualización del WhatsApp Channel "Habla! Picks" para la landing.
// Decorativo, no funcional. Header verde oscuro + 2 picks de ejemplo
// embebidos en burbujas blancas con check azul + count de reacciones.
//
// Datos: count real de suscriptores activos. Si <50, ocultamos para no
// transmitir falta de social proof. El consumer pasa `suscriptoresCount`.

interface Props {
  /** Suscriptores activos. Si <50 → no se muestra el count. */
  suscriptoresCount: number;
}

const PICKS_DEMO: Array<{
  title: string;
  partido: string;
  recomendacion: string;
  casa: string;
  reacciones: number;
  hora: string;
}> = [
  {
    title: "🎯 Pick #1 · 7:00 PM",
    partido: "Alianza vs Universitario",
    recomendacion: "Ambos anotan: SÍ @ 1.85",
    casa: "Betano",
    reacciones: 47,
    hora: "9:42",
  },
  {
    title: "🎯 Pick #2 · 7:15 PM",
    partido: "Real Madrid vs Man City",
    recomendacion: "Más de 2.5 goles @ 1.95",
    casa: "Betsson",
    reacciones: 38,
    hora: "9:48",
  },
];

export function WhatsAppChannelMockup({ suscriptoresCount }: Props) {
  const mostrarCount = suscriptoresCount >= 50;

  return (
    <div
      aria-hidden
      className="relative mx-4 -mt-2 overflow-hidden rounded-xl border-[6px] border-whatsapp-green-darker bg-whatsapp-chat shadow-premium-card"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M0 0h100v100H0z' fill='%23ECE5DD'/%3E%3Cpath d='M20 20l5 5M40 60l5 5M70 30l5 5M30 80l5 5' stroke='%23DDD7CB' stroke-width='1.5'/%3E%3C/svg%3E\")",
      }}
    >
      {/* Header del Channel */}
      <div className="flex items-center gap-2 bg-whatsapp-green-darker px-3 py-2 text-white">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue-dark font-display text-[12px] font-black text-brand-gold">
          ⊕
        </span>
        <div className="flex-1 leading-tight">
          <div className="flex items-center gap-1 text-[13px] font-semibold">
            Habla! Picks{" "}
            <span className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-whatsapp-green text-[7px] font-bold text-white">
              ✓
            </span>
          </div>
          <div className="text-[10px] text-white/70">
            {mostrarCount
              ? `Canal · ${suscriptoresCount.toLocaleString("es-PE")} suscriptores`
              : "Canal · privado"}
          </div>
        </div>
        <span className="text-[14px] text-white/70">⋮</span>
      </div>

      {/* Picks de ejemplo */}
      <div className="space-y-2 p-3">
        {PICKS_DEMO.map((pick) => (
          <div
            key={pick.title}
            className="max-w-[90%] rounded-lg bg-whatsapp-chat-bubble p-2.5 text-[11px] text-[#303030] shadow-sm"
          >
            <div className="font-bold text-whatsapp-green-dark">
              {pick.title}
            </div>
            <div className="mt-1 leading-snug">
              <strong className="text-dark">{pick.partido}</strong>
              <br />
              {pick.recomendacion}
            </div>
            <span className="mt-1 inline-block rounded-sm bg-brand-gold-dim px-1.5 py-0.5 text-[10px] font-bold text-brand-gold-dark">
              🏠 Mejor cuota: {pick.casa} →
            </span>
            <div className="mt-1 flex items-center justify-between text-[9px] text-[#888]">
              <span>🔥 {pick.reacciones}</span>
              <span>
                {pick.hora}{" "}
                <span className="text-whatsapp-check-blue">✓✓</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
