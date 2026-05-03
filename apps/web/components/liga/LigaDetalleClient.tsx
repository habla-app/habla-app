"use client";
// LigaDetalleClient — Lote M v3.2.
// Spec: docs/habla-mockup-v3.2.html § page-liga-detail.
//
// Orquestador client-side de /liga/[slug]. Monta MiCombinadaCard +
// ComboModalV32 + sincronía abrir/cerrar/eliminar. La página server
// resuelve los datos iniciales y pasa props.
//
// Auto-apertura: si la URL trae `?modal=1`, abre el modal en mount —
// permite que el LigaWidgetInline desde /las-fijas/[slug] o cualquier CTA
// externo dispare el modal directo.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  MiCombinadaCard,
  type MiCombinadaState,
} from "./MiCombinadaCard";
import {
  ComboModalV32,
  type ComboPredIniciales,
} from "@/components/combo/ComboModalV32";

interface Props {
  torneoId: string;
  ticketId: string | null;
  predIniciales: ComboPredIniciales | null;
  partidoNombre: string;
  equipoLocal: string;
  equipoVisita: string;
  cierreAt: string; // ISO
  combinada: MiCombinadaState | null;
  editable: boolean;
  finalizado: boolean;
  requiereLogin: boolean;
}

export function LigaDetalleClient(props: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Auto-open desde ?modal=1
  useEffect(() => {
    if (params.get("modal") === "1" && props.editable && !props.requiereLogin) {
      setOpen(true);
      // Limpiar el query param para que un refresh no lo vuelva a abrir.
      const next = new URLSearchParams(params.toString());
      next.delete("modal");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }
  }, [params, props.editable, props.requiereLogin, router]);

  const onAbrirModal = useCallback(() => {
    if (!props.editable) return;
    setOpen(true);
  }, [props.editable]);

  const onCerrar = useCallback(() => setOpen(false), []);
  const onSaved = useCallback(() => {
    // El modal hace router.refresh() internamente al guardar. Cerramos
    // después del feedback "Guardada" tras 1.2s para dar tiempo a leer.
    setTimeout(() => setOpen(false), 1200);
  }, []);

  const onEliminar = useCallback(() => {
    if (!props.editable || !props.ticketId) return;
    setOpen(true);
  }, [props.editable, props.ticketId]);

  return (
    <>
      <MiCombinadaCard
        combinada={props.combinada}
        equipoLocal={props.equipoLocal}
        equipoVisita={props.equipoVisita}
        editable={props.editable}
        finalizado={props.finalizado}
        requiereLogin={props.requiereLogin}
        onAbrirModal={onAbrirModal}
        onEliminar={onEliminar}
      />

      <ComboModalV32
        isOpen={open}
        onClose={onCerrar}
        torneo={{
          torneoId: props.torneoId,
          partidoNombre: props.partidoNombre,
          equipoLocal: props.equipoLocal,
          equipoVisita: props.equipoVisita,
          cierreAt: new Date(props.cierreAt),
        }}
        ticketId={props.ticketId}
        predIniciales={props.predIniciales}
        onSaved={onSaved}
      />
    </>
  );
}
