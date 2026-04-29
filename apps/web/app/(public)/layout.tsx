// Layout del grupo `(public)` — Lote 8.
//
// Envuelve las pages editoriales (blog, casas, guías, pronósticos,
// partidos, cuotas) con el `PublicHeader` propio + Footer global.
// Diferencias con `(main)`:
//   - No incluye NavBar logueado (con widget Lukas/En vivo) ni BottomNav.
//   - Usa ISR (revalidate 1h) en lugar de `force-dynamic` — el contenido
//     editorial no cambia entre requests.
//
// El `revalidate` por default queda heredado por las pages que NO lo
// override-ean. Pages como `/cuotas` que son placeholder estáticos heredan
// también; pages como `/casas` que cruzan con BD pueden override-ear a
// 60s para ver más rápido los cambios de afiliados (típico de admin).

import type { ReactNode } from "react";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";

export const revalidate = 3600;

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
