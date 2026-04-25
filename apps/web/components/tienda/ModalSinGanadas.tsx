"use client";
// ModalSinGanadas — Lote 6B. Se abre cuando el usuario intenta canjear un
// premio pero su balance de Lukas Ganados es insuficiente (BALANCE_INSUFICIENTE
// devuelto por la API). Muestra el déficit y redirige a /matches.

import { useEffect } from "react";
import Link from "next/link";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { track } from "@/lib/analytics";

interface Props {
  open: boolean;
  onClose: () => void;
  ganadas: number;
  coste: number;
}

export function ModalSinGanadas({ open, onClose, ganadas, coste }: Props) {
  useEffect(() => {
    if (!open) return;
    track("tienda_canje_bloqueado_sin_ganadas", {
      ganadas_actuales: ganadas,
      coste_premio: coste,
      deficit: coste - ganadas,
    });
  }, [open, ganadas, coste]);

  return (
    <Modal isOpen={open} onClose={onClose} label="Lukas Ganados insuficientes" maxWidth="440px">
      <ModalHeader onClose={onClose} eyebrow="Canjear premio" shimmer>
        <h2 className="font-display text-[20px] font-extrabold">
          Lukas Ganados insuficientes
        </h2>
      </ModalHeader>

      <ModalBody>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-5 text-[48px] leading-none">🏆</div>

          <div className="mb-5 grid w-full grid-cols-2 gap-3">
            <div className="rounded-md border border-light bg-subtle p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-d">
                Tu balance Ganados
              </div>
              <div className="mt-1 font-display text-[24px] font-black leading-none text-brand-green">
                {ganadas.toLocaleString("es-PE")}
                <span aria-hidden className="ml-1 text-[0.6em]">
                  🪙
                </span>
              </div>
            </div>
            <div className="rounded-md border border-light bg-subtle p-3">
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-d">
                Necesitas
              </div>
              <div className="mt-1 font-display text-[24px] font-black leading-none text-dark">
                {coste.toLocaleString("es-PE")}
                <span aria-hidden className="ml-1 text-[0.6em]">
                  🪙
                </span>
              </div>
            </div>
          </div>

          <p className="max-w-xs text-[14px] leading-relaxed text-body">
            Los Lukas Ganados solo se obtienen{" "}
            <strong className="text-dark">ganando en torneos</strong>.
            ¡Compite ahora y acumula los tuyos!
          </p>
        </div>
      </ModalBody>

      <ModalFooter>
        <div className="flex flex-col gap-2.5">
          <Link
            href="/matches"
            onClick={() => {
              track("tienda_sin_ganadas_cta_partidos_clicked");
              onClose();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-3 font-bold text-black shadow-gold-btn transition hover:bg-brand-gold-light"
          >
            ⚽ Ver partidos disponibles →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-light px-4 py-3 font-bold text-dark hover:bg-hover"
          >
            Cerrar
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
}
