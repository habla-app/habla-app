// DisclaimerAfiliacion — Lote 8.
//
// Va al pie de cualquier artículo o review que contenga enlaces de
// afiliación a casas de apuestas. Estilo discreto, mismo tratamiento
// visual que `<DisclaimerLudopatia>`. Cumplimiento básico de divulgación
// de afiliados (FTC-style) para tener todo limpio frente a auditorías.

export function DisclaimerAfiliacion() {
  return (
    <aside
      role="note"
      aria-label="Aviso de afiliación"
      className="my-6 flex gap-2.5 rounded-sm border border-light bg-subtle px-4 py-3 text-[12px] leading-relaxed text-muted-d"
    >
      <span aria-hidden className="flex-shrink-0 text-[15px] opacity-70">
        🤝
      </span>
      <p className="m-0">
        <strong className="text-dark">Divulgación de afiliación.</strong> Este
        contenido contiene enlaces de afiliación. Si te registrás a través de
        ellos, Habla! recibe comisión sin costo adicional para vos. Las
        recomendaciones editoriales se hacen de forma independiente al modelo
        comercial.
      </p>
    </aside>
  );
}
