// HorizontalScrollChips — re-export desde la ubicación canónica v3.1
// (Lote A). Spec: docs/ux-spec/00-design-system/componentes-mobile.md §4.
//
// El componente vive en `components/ui/HorizontalScrollChips.tsx` desde
// el Lote 8. La spec v3.1 lo cataloga como mobile-specific. Reexportamos
// acá para que código nuevo pueda importarlo desde el path canónico:
//
//   import { HorizontalScrollChips } from "@/components/ui/mobile";
//
// Mover el archivo físicamente ahora rompería callers (CasasGrid, /cuotas,
// etc.). El move se aplica en el Lote B junto con la reauditoría móvil
// de la capa pública.
export { HorizontalScrollChips } from "@/components/ui/HorizontalScrollChips";
