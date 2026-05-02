"use client";
// useAuthState — Lote K v3.2 (May 2026).
// Spec: docs/analisis-repo-vs-mockup-v3.2.md §1.4.
//
// Hook único para que cualquier client component lea el estado de auth
// del visitante: 'visitor' | 'free' | 'socios'.
//
// Internamente lee del React Context provisto por <AuthStateProvider>
// (ver `components/auth/AuthStateProvider.tsx`). El layout server-side
// es responsable de calcular el estado UNA vez via
// `obtenerEstadoAuthServer()` y pasarlo al provider.
//
// Si no hay provider en el árbol, devuelve 'visitor' como default seguro
// (el usuario no ve bloques Socios y se le muestran CTAs de registro).
//
// Uso:
//   const estado = useAuthState();
//   if (estado === 'socios') { ... }
//
// Para gating declarativo en JSX, preferir <AuthGate> sobre branches
// manuales con if/else.

import { useAuthStateContext, type EstadoAuth } from "@/components/auth/AuthStateProvider";

export type { EstadoAuth };

export function useAuthState(): EstadoAuth {
  return useAuthStateContext();
}
