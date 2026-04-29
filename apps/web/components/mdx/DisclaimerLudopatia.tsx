// DisclaimerLudopatia — Lote 7.
//
// Frase legal obligatoria que va al pie de TODO artículo o página
// que contenga CTAs a casas de apuestas (afiliación MINCETUR). El texto
// y el número de teléfono son los oficiales — confirmar antes de cambiar.
//
// Estilo discreto pero legible: fondo subtle, borde light, ícono pequeño,
// texto ~12px en muted-d. Mismo lenguaje visual que `.legal-note` del
// mockup (línea 1261 de habla-mockup-completo.html).

export function DisclaimerLudopatia() {
  return (
    <aside
      role="note"
      aria-label="Aviso legal: juego responsable"
      className="my-6 flex gap-2.5 rounded-sm border border-light bg-subtle px-4 py-3 text-[12px] leading-relaxed text-muted-d"
    >
      <span aria-hidden className="flex-shrink-0 text-[15px] opacity-70">
        ℹ️
      </span>
      <p className="m-0">
        <strong className="text-dark">Juega responsablemente.</strong> Solo +18
        años. Si crees que tienes un problema con el juego, llama a la línea
        gratuita 0800-1-2025 (MINCETUR).
      </p>
    </aside>
  );
}
