"use client";
// LukasBalanceHydrator — sincroniza el balance de la sesión NextAuth
// (server-side) hacia el `useLukasStore` (client-side) en el primer
// render del MainLayout.
//
// Bug post-Sub-Sprint 5: el store inicia en `balance: 0` y nunca se
// hidrataba. El NavBar (Server Component) leía `session.user.balanceLukas`
// directo y mostraba bien, pero el ComboModal lee del store y veía 0,
// produciendo "Balance después: -5" porque calculaba `0 - entradaLukas`.
//
// Patrón:
//   1. Server Component padre (`(main)/layout.tsx`) llama `auth()`.
//   2. Pasa `initialBalance={session?.user?.balanceLukas ?? null}` aquí.
//   3. Este client component setea el store con `setBalance(initialBalance)`
//      en su primer effect (un solo render por mount).
//
// Si `initialBalance` cambia entre renders (re-render del layout post-
// mutación), el effect re-corre y re-sincroniza. Si es null (sin sesión),
// no toca el store — queda en 0, que es el valor correcto para anónimos.

import { useEffect } from "react";
import { useLukasStore } from "@/stores/lukas.store";

interface Props {
  /** Balance del usuario logueado, o null si no hay sesión. */
  initialBalance: number | null;
}

export function LukasBalanceHydrator({ initialBalance }: Props) {
  const setBalance = useLukasStore((s) => s.setBalance);

  useEffect(() => {
    if (initialBalance === null) return;
    setBalance(initialBalance);
  }, [initialBalance, setBalance]);

  return null;
}
