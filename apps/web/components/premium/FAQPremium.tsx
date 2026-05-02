"use client";

// FAQPremium — accordion de preguntas frecuentes Premium (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// 5 FAQs frecuentes Premium. La primera abierta por default; el resto
// colapsadas. Implementación con `<details>` nativo para no tener que
// reusar el FAQAccordion del Lote 0 (que no es mobile-first).

const FAQS: Array<{ pregunta: string; respuesta: string }> = [
  {
    pregunta: "¿Cómo recibo los picks?",
    respuesta:
      "Después de pagar, te enviamos un link único al WhatsApp Channel privado. Te unes con un click y recibes 2-4 picks/día.",
  },
  {
    pregunta: "¿Puedo cancelar cuando quiera?",
    respuesta:
      "Sí. Cancelas desde tu perfil en un click. Mantienes acceso hasta el fin del periodo pagado y no te cobramos más.",
  },
  {
    pregunta: "¿Qué pasa si no acierto?",
    respuesta:
      "Los primeros 7 días tienes garantía de reembolso completo, sin preguntas. Pasada esa ventana, los picks tienen acierto promedio de ~65% — pero las apuestas siempre tienen riesgo. Apuesta lo que puedas perder.",
  },
  {
    pregunta: "¿Comparten mis datos con las casas?",
    respuesta:
      "No. Solo te enviamos el link a la casa con mejor cuota; tú decides si abrir cuenta o no. Tu email queda en Habla! exclusivamente.",
  },
  {
    pregunta: "¿Cuánto tiempo me toma seguir un pick?",
    respuesta:
      "Cada pick incluye el partido, el mercado y la cuota. Te toma 1-2 minutos: abres el link a la casa, validas la cuota y haces tu apuesta.",
  },
];

export function FAQPremium() {
  return (
    <section
      aria-label="Preguntas frecuentes"
      className="border-t border-light bg-card px-4 py-6"
    >
      <h2 className="mb-3 text-center font-display text-display-sm font-extrabold uppercase tracking-tight text-dark">
        Preguntas frecuentes
      </h2>
      <ul className="divide-y divide-light">
        {FAQS.map((faq, idx) => (
          <li key={faq.pregunta}>
            <details
              className="group py-3"
              open={idx === 0}
              data-faq-item
            >
              <summary
                className="flex cursor-pointer items-center justify-between gap-3 text-body-sm font-bold text-dark touch-target"
                style={{ minHeight: "auto" }}
              >
                <span>{faq.pregunta}</span>
                <span
                  aria-hidden
                  className="text-body-md text-muted-d transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-2 text-body-sm leading-[1.55] text-body">
                {faq.respuesta}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
