"use client";

// Toaster — wrapper de sonner con configuración Habla! v3.1 (Lote H).
//
// Este es el contenedor que renderiza el stack de toasts. Se monta una sola
// vez en el `<RootLayout>` y los toasts se disparan via `showToast` desde
// cualquier componente cliente.
//
// Posicionamiento (regla del Lote H):
//   - Desktop:  bottom-right, ancho fijo ~380px.
//   - Mobile:   bottom-center, ancho calc(100% - 24px).
// sonner toma `bottom-right` y en mobile colapsa naturalmente al ancho
// disponible — el `mobile` de sonner está OK para nuestro caso.
//
// Z-index alto (z-toast del design system Lote A) para no chocar con
// `<BottomNav>` ni Sticky CTAs.
//
// `closeButton` true → permite que el usuario cierre cualquier toast con un
// click. Crítico para errores 6s que el usuario quiere resolver ya.

import { Toaster as SonnerToaster } from "sonner";

interface ToasterProps {
  /** Tema visual. Default light (Habla! es light-only). */
  theme?: "light" | "dark";
}

export function Toaster({ theme = "light" }: ToasterProps = {}) {
  return (
    <SonnerToaster
      position="bottom-right"
      theme={theme}
      richColors
      closeButton
      expand={false}
      visibleToasts={3}
      offset={20}
      gap={12}
      toastOptions={{
        style: {
          fontSize: "14px",
          fontFamily:
            "var(--font-dm-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          borderRadius: "12px",
        },
        className: "habla-toast",
      }}
    />
  );
}
