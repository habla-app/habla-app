"use client";
// TrackOnMount — dispara un evento analytics una sola vez al montar.
// Útil en server components que quieren emitir `torneo_viewed`, `tienda_viewed`,
// `signup_started`, etc. sin convertir toda la página a client.
//
// Dedupe: usa un ref para no disparar dos veces en strict mode (dev).

import { useEffect, useRef } from "react";
import { track, type EventName } from "@/lib/analytics";

interface Props {
  event: EventName;
  props?: Record<string, string | number | boolean | null | undefined>;
}

export function TrackOnMount({ event, props }: Props) {
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    track(event, props);
  }, [event, props]);
  return null;
}
