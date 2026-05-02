// SoporteFooter — footer pequeño con link al soporte editorial (guías).
// Lote B v3.1. Spec:
// docs/ux-spec/02-pista-usuario-publica/partidos-slug.spec.md.
//
// Cumple el rol de "Producto A" (biblioteca de soporte) en la jerarquía
// de productos: invisible salvo cuando el usuario explícitamente busca
// ayuda. En la vista de partido aparece al pie del análisis editorial,
// como cierre.

import Link from "next/link";

export function SoporteFooter() {
  return (
    <p className="my-6 text-center text-body-sm text-muted-d">
      ¿Dudas con la jerga o los mercados?{" "}
      <Link
        href="/guias"
        className="font-bold text-brand-blue-main underline-offset-2 hover:underline"
      >
        Ver guías y glosario →
      </Link>
    </p>
  );
}
