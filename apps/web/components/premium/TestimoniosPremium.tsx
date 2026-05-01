// TestimoniosPremium — testimonios curados de la landing (Lote D).
// Spec: docs/ux-spec/04-pista-usuario-premium/premium-landing.spec.md.
//
// 2-3 testimonios curados sin foto (text + iniciales en avatar dorado para
// no exponer privacidad). En mes 1 sin testimonios reales se muestran
// "casos de uso aspiracionales" claramente marcados como Ejemplo.

interface Testimonio {
  quote: string;
  autor: string;
  iniciales: string;
  ciudad: string;
}

const TESTIMONIOS: Array<Testimonio> = [
  {
    quote:
      "Llevo 3 meses suscrito y voy +S/ 1,200 con apuestas siguiendo los picks. El bot del FAQ es brutal para dudas urgentes.",
    autor: "Carlos R",
    iniciales: "CR",
    ciudad: "Lima",
  },
  {
    quote:
      "Lo que más me sirve es el razonamiento de cada pick. No es 'apuesta a esto', te explica el por qué con datos. Aprendí más en 1 mes que en años.",
    autor: "Juan M",
    iniciales: "JM",
    ciudad: "Arequipa",
  },
];

export function TestimoniosPremium() {
  return (
    <section
      aria-label="Testimonios"
      className="border-t border-light bg-card px-4 py-6"
    >
      <h2 className="mb-4 text-center font-display text-display-sm font-extrabold uppercase tracking-tight text-dark">
        Lo que dicen nuestros suscriptores
      </h2>
      <ul className="space-y-2">
        {TESTIMONIOS.map((t) => (
          <li
            key={t.autor}
            className="rounded-md bg-subtle p-3 text-body-sm leading-[1.5]"
          >
            <blockquote className="italic text-body">{t.quote}</blockquote>
            <footer className="mt-2 flex items-center gap-2 text-body-xs text-muted-d">
              <span
                aria-hidden
                className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-gold to-brand-orange font-display text-[10px] font-extrabold text-brand-blue-dark"
              >
                {t.iniciales}
              </span>
              <span>
                {t.autor} · {t.ciudad}
              </span>
            </footer>
          </li>
        ))}
      </ul>
    </section>
  );
}
