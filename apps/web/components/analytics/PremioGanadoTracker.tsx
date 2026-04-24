"use client";
// PremioGanadoTracker — dispara `premio_ganado` una vez por ticketId.
//
// Se monta en /mis-combinadas (tab ganadas) con la lista de tickets
// ganados del usuario. Dedupe vía localStorage (`habla:premios_tracked`)
// que guarda un Set de ticketId ya reportados a analytics.
//
// Trade-off (Lote 2): idealmente el evento se dispara server-side cuando
// `finalizarTorneo` acredita el premio. Eso requeriría `posthog-node`,
// explícitamente fuera de scope en este lote. La alternativa client-side
// dispara el evento la primera vez que el usuario ABRE la pantalla de
// ganadas — con latencia, pero correcto y sin dup.

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics";

interface GanadoInfo {
  ticketId: string;
  torneoId: string;
  posicion: number;
  lukasGanados: number;
}

const STORAGE_KEY = "habla:premios_tracked";

function readTracked(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function writeTracked(set: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* storage bloqueado, next time will retry */
  }
}

export function PremioGanadoTracker({ tickets }: { tickets: GanadoInfo[] }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (tickets.length === 0) return;
    const tracked = readTracked();
    let changed = false;
    for (const t of tickets) {
      if (tracked.has(t.ticketId)) continue;
      tracked.add(t.ticketId);
      changed = true;
      track("premio_ganado", {
        torneo_id: t.torneoId,
        posicion: t.posicion,
        lukas_ganados: t.lukasGanados,
      });
    }
    if (changed) writeTracked(tracked);
  }, [tickets]);

  return null;
}
