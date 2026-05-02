// cn — concatena clases condicionales (truthy) en un string single-space.
// Sirve como helper compartido para todos los componentes nuevos del Design
// System v3.1 (Lote A). Mantiene la dependencia mínima: no usa clsx ni
// tailwind-merge — el repo no los tiene instalados y agregar dependencias
// requiere discusión previa según regla 5 del CLAUDE.md.
//
// Uso:
//   cn("base", isActive && "bg-brand-gold", className)
//   cn("p-4", { "rounded-md": rounded, "shadow-md": elevated })
//
// Casos no cubiertos a propósito:
// - No deduplica clases conflictivas (ej. "p-4 p-6" → ambas se mantienen).
//   Si en el futuro hace falta merge tipo tailwind-merge, se discute como
//   dependencia nueva.
type ClassValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Record<string, boolean | null | undefined>
  | ClassValue[];

function pushClasses(input: ClassValue, out: string[]): void {
  if (!input) return;
  if (typeof input === "string" || typeof input === "number") {
    const trimmed = String(input).trim();
    if (trimmed) out.push(trimmed);
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) pushClasses(item, out);
    return;
  }
  if (typeof input === "object") {
    for (const [key, value] of Object.entries(input)) {
      if (value) out.push(key);
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) pushClasses(input, out);
  return out.join(" ");
}
