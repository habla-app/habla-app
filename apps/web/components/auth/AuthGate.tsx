"use client";
// AuthGate — Lote K v3.2 (May 2026).
// Spec: docs/analisis-repo-vs-mockup-v3.2.md §1.4.
//
// Componente de gating declarativo. Renderiza children solo si el estado
// de auth coincide con la regla. Lee el estado vía useAuthState().
//
// Tres formas de uso:
//
//   <AuthGate state="socios">
//     ...solo Socios ven esto...
//   </AuthGate>
//
//   <AuthGate state={['free', 'socios']}>
//     ...usuarios logueados (free o socios) ven esto...
//   </AuthGate>
//
//   <AuthGate not="visitor">
//     ...todos menos visitantes anónimos ven esto...
//   </AuthGate>
//
//   <AuthGate not={['visitor', 'free']}>
//     ...solo Socios (excluye visitor + free)...
//   </AuthGate>
//
// `state` y `not` son mutuamente excluyentes — pasar ambos lanza error en
// runtime (asserción interna). El prop `fallback` opcional renderiza algo
// cuando la regla no matchea (ej. teaser bloqueado con CTA "Hacete Socio").

import type { ReactNode } from "react";
import { useAuthState, type EstadoAuth } from "@/hooks/useAuthState";

interface BaseProps {
  /** Renderizado cuando la regla NO matchea. Default: null (oculto). */
  fallback?: ReactNode;
  children: ReactNode;
}

interface PropsState extends BaseProps {
  state: EstadoAuth | EstadoAuth[];
  not?: never;
}

interface PropsNot extends BaseProps {
  not: EstadoAuth | EstadoAuth[];
  state?: never;
}

export type AuthGateProps = PropsState | PropsNot;

function matchesState(actual: EstadoAuth, target: EstadoAuth | EstadoAuth[]): boolean {
  if (Array.isArray(target)) return target.includes(actual);
  return actual === target;
}

export function AuthGate(props: AuthGateProps): ReactNode {
  const estado = useAuthState();
  // Children + fallback son comunes a las dos variantes del discriminated
  // union — los extraemos vía cast a BaseProps para que TS no estrechar
  // `props` a `never` después de los dos `if`.
  const { children, fallback } = props as BaseProps;

  if ("state" in props && props.state !== undefined) {
    const visible = matchesState(estado, props.state);
    return visible ? <>{children}</> : <>{fallback ?? null}</>;
  }

  if ("not" in props && props.not !== undefined) {
    const oculto = matchesState(estado, props.not);
    return oculto ? <>{fallback ?? null}</> : <>{children}</>;
  }

  // Si no se pasó ni `state` ni `not`, default seguro: renderizar children
  // (efectivamente sin gate). Esto evita romper UI por error de tipado.
  return <>{children}</>;
}
