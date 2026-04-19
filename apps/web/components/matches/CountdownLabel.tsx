"use client";
// CountdownLabel — Hotfix #6 Ítem 5.
//
// MatchCard antes renderizaba el countdown como texto server-rendered
// con `formatCountdown(cierreAt)` — quedaba pegado al valor del SSR
// hasta que el usuario refrescaba manualmente. Este componente lo
// re-renderiza cada 1s en el cliente.
//
// Decisión de performance: setInterval por instancia (opción b del PO).
// Con 20+ MatchCards en pantalla son 20 timers de 1s; el costo es
// bajo en MVP y el test de carga del Sprint 8 nos dirá si migramos
// a un store compartido.
//
// La urgencia (tier + color del chip) se mantiene server-side para el
// primer render; cuando el usuario cruza un umbral (<15 min, <1h) el
// color NO se actualiza hasta el próximo refresh. Aceptable para MVP
// — la intención del bug era solo el label, no un re-calc de estilos
// segundo a segundo.

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/utils/datetime";

interface CountdownLabelProps {
  cierreAt: Date | string;
}

export function CountdownLabel({ cierreAt }: CountdownLabelProps) {
  const [label, setLabel] = useState(() => formatCountdown(cierreAt));

  useEffect(() => {
    // Actualiza de inmediato para corregir cualquier drift entre el
    // label del SSR y la hora actual del cliente.
    setLabel(formatCountdown(cierreAt));
    const id = setInterval(() => {
      setLabel(formatCountdown(cierreAt));
    }, 1000);
    return () => clearInterval(id);
  }, [cierreAt]);

  return <>{label}</>;
}
