// Helper de templating para microcopy.
//
// Sustituye `{variable}` con valores de un objeto. Convención uniforme
// en todo el catálogo (ver `microcopy-catalogo.spec.md`).
//
// Uso:
//   import { tpl } from "@/lib/copy/template";
//   import { PREMIUM_COPY } from "@/lib/copy/premium";
//
//   tpl(PREMIUM_COPY.post_pago.hero_sub_template, {
//     plan: "Anual",
//     fecha: "30/04/2027",
//   });
//   // → "Plan Anual activo hasta el 30/04/2027"

export function tpl(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
