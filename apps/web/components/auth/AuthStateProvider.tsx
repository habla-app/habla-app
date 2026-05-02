"use client";
// AuthStateProvider — Lote K v3.2 (May 2026).
// Spec: docs/analisis-repo-vs-mockup-v3.2.md §1.4.
//
// Provee el estado de auth ('visitor' | 'free' | 'socios') vía React
// Context para que los client components descendientes lo lean sin
// re-fetch ni llamadas adicionales a `useSession()`.
//
// Patrón:
//   1. El layout server-side llama `obtenerEstadoAuthServer()` UNA VEZ.
//   2. Pasa el resultado como `initialState` a este Provider.
//   3. Cualquier client component descendiente puede llamar `useAuthState()`.
//
// El estado es estable durante la vida del request (no cambia entre
// renders del cliente). Si la session cambia (login/logout dentro del
// SPA), el server re-renderiza y el provider recibe nuevo `initialState`.
//
// Para cambios reactivos client-side (ej. después de checkout exitoso
// dentro del mismo SPA), las vistas afectadas hacen un router.refresh()
// para forzar nuevo render del layout y propagar el nuevo estado.

import { createContext, useContext, type ReactNode } from "react";

export type EstadoAuth = "visitor" | "free" | "socios";

const AuthStateContext = createContext<EstadoAuth>("visitor");

interface Props {
  initialState: EstadoAuth;
  children: ReactNode;
}

export function AuthStateProvider({ initialState, children }: Props) {
  return (
    <AuthStateContext.Provider value={initialState}>
      {children}
    </AuthStateContext.Provider>
  );
}

/**
 * Internal — usado por `useAuthState`. No exportar fuera del módulo de auth.
 */
export function useAuthStateContext(): EstadoAuth {
  return useContext(AuthStateContext);
}
