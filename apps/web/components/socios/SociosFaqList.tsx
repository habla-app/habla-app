"use client";
// SociosFaqList — Lote U v3.2.
//
// Lista FAQ del landing /socios con expansión click-to-toggle.
// Estructura HTML respeta el mockup (líneas 3891-3896 de
// docs/habla-mockup-v3.2.html):
//
//   <div class="faq-list">
//     <div class="faq-item">
//       <div class="faq-q">¿Cómo recibo los picks?</div>
//     </div>
//     ...
//
// El mockup HTML tiene solo `.faq-q` (CSS pone `+` via ::after). Para que
// la expansión funcione agregamos:
//   - el item recibe la clase `.faq-item.open` cuando está abierto
//   - cuando `.open`, mostramos el contenido `.faq-a` debajo de `.faq-q`
//   - el `+` se rota a `−` via CSS sobre `.faq-item.open .faq-q::after`
//
// `.faq-q` es un <button> nativo (semántica accesible), respetando el
// `cursor: pointer` que ya define mockup-styles.css.
//
// Las preguntas son las 5 literales del mockup. Las respuestas son las
// canónicas del producto Socios v3.2 (consistentes con el plan de
// negocios + reglas de Lote E + Lote H).

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

const ITEMS: FaqItem[] = [
  {
    q: "¿Cómo recibo los picks?",
    a: "Te invitamos a nuestro WhatsApp Channel privado de Socios apenas se confirma el pago. Los picks llegan ahí (broadcast 1 → muchos) y las dudas las respondés con el bot 1:1, también por WhatsApp.",
  },
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Sí. Cancelás desde tu hub de Socios en cualquier momento — la suscripción no se renueva al siguiente período. Mientras dure el período pagado seguís recibiendo todos los picks.",
  },
  {
    q: "¿Qué pasa si no acierto?",
    a: "No prometemos resultados. Lo que sí garantizamos es picks con razonamiento estadístico (H2H, forma reciente, EV+ calculado, stake sugerido). Si no te convence el servicio, hay garantía de 7 días: te devolvemos el 100% sin preguntas.",
  },
  {
    q: "¿Comparten mis datos con las casas?",
    a: "No. Tu suscripción es 100% independiente de las casas autorizadas MINCETUR. Recibimos comisión por afiliación cuando jugás en una casa que recomendamos, pero las casas no acceden a tu identidad como Socio.",
  },
  {
    q: "¿Cuánto tiempo me toma seguir un pick?",
    a: "Cada pick incluye casa con mejor cuota y stake sugerido. Si ya tenés cuenta en una casa autorizada, jugarlo te lleva 30-60 segundos. Si todavía no, te llevamos al registro con bono incluido.",
  },
];

export function SociosFaqList() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="faq-list">
      {ITEMS.map((item, idx) => {
        const open = openIdx === idx;
        return (
          <div key={idx} className={open ? "faq-item open" : "faq-item"}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={open}
              onClick={() => setOpenIdx(open ? null : idx)}
            >
              {item.q}
            </button>
            {open ? <div className="faq-a">{item.a}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
