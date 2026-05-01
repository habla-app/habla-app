"use client";

// Toast — backward-compat con `useToast()` legacy (Lotes 0-G) v3.1 (Lote H).
//
// La API legacy es:
//   const toast = useToast();
//   toast.show("Combinada enviada ✔");
//
// En Lote H se migró a `sonner` (ver `<Toaster />` en components/ui/Toaster.tsx
// y `showToast` en lib/toast.ts). Este wrapper mantiene la firma legacy
// para no romper los 16+ call sites existentes (admin panels, predicción
// form, marketing forms, etc) — cada `toast.show(msg)` se traduce a un
// `sonner.toast(msg)` sin severidad explícita (estilo neutro).
//
// Nuevos call sites: prefieren `import { showToast } from "@/lib/toast"`.

import { toast as sonnerToast } from "sonner";
import type { ReactNode } from "react";
import { Toaster } from "./Toaster";

interface ToastContextValue {
  show: (message: string) => void;
}

/**
 * `useToast()` legacy — devuelve un objeto con `.show(message: string)`.
 * Detrás del telón usa `sonner.toast()` con duración 3500ms (la del Lote
 * legacy). Lleva detección heurística de prefijos `✅`/`❌`/`⚠`/`ℹ️` para
 * mapear a la severidad correcta.
 */
export function useToast(): ToastContextValue {
  return {
    show: (message: string) => {
      const m = message.trim();
      if (m.startsWith("✅") || m.startsWith("✓")) {
        sonnerToast.success(m, { duration: 3500 });
      } else if (m.startsWith("❌") || m.startsWith("✗")) {
        sonnerToast.error(m, { duration: 5000 });
      } else if (m.startsWith("⚠") || m.startsWith("⚠️")) {
        sonnerToast.warning(m, { duration: 5000 });
      } else if (m.startsWith("ℹ") || m.startsWith("ℹ️")) {
        sonnerToast.info(m, { duration: 4000 });
      } else {
        sonnerToast(m, { duration: 3500 });
      }
    },
  };
}

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * `<ToastProvider>` legacy — renderea children + monta el `<Toaster />` de
 * sonner una sola vez. Mantiene compatibilidad con el `app/layout.tsx`
 * existente. Nuevos layouts pueden montar `<Toaster />` directamente.
 */
export function ToastProvider({ children }: ToastProviderProps) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
