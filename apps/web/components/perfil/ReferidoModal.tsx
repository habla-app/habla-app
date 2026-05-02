"use client";

// ReferidoModal — modal con link de referido del usuario (Lote C v3.1).
// Spec: docs/ux-spec/03-pista-usuario-autenticada/perfil.spec.md.
//
// Lote C implementa solo la base del modal: link único `/?ref=[username]`,
// botón "Copiar" + share via WhatsApp/Twitter intents nativos. Tracking
// real de referidos (atribución, premio por X conversiones) se implementa
// post-launch.
//
// El modal se abre desde QuickAccessGrid → "Mi link de referido". Usa el
// <Modal> del Lote 0 con createPortal.

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

interface ReferidoModalProps {
  username: string;
  open: boolean;
  onClose: () => void;
}

export function ReferidoModal({ username, open, onClose }: ReferidoModalProps) {
  const toast = useToast();
  const [link, setLink] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    setLink(`${origin}/?ref=${encodeURIComponent(username)}`);
  }, [username]);

  if (!open) return null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      toast.show("📋 Link copiado al portapapeles");
    } catch {
      toast.show("❌ No pudimos copiar el link");
    }
  }

  function track(canal: string) {
    // Best-effort fire-and-forget. Cuando el endpoint exista (post-Lote C),
    // este fetch reportará el evento; si la ruta no existe aún, falla
    // silenciosamente y la share igual sucede.
    void fetch("/api/v1/analytics/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evento: "referido_invitacion_compartida",
        props: { canal, username },
      }),
      credentials: "include",
    }).catch(() => {});
  }

  const mensaje = `¡Compite gratis en Habla! Top 10 del mes gana S/ 1,250 en efectivo. Mi link: ${link}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
  const twHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(mensaje)}`;

  return (
    <Modal isOpen={open} onClose={onClose} label="Mi link de referido" maxWidth="420px">
      <ModalHeader onClose={onClose} eyebrow="Referidos">
        <h2 className="font-display text-display-sm font-extrabold">
          🤝 Tu link de referido
        </h2>
      </ModalHeader>
      <ModalBody>
        <p className="text-body-sm text-body">
          Compartí tu link único. Cada amigo que cree cuenta cuenta como
          referido.
        </p>

        <div className="mt-4 rounded-md border border-light bg-subtle px-3 py-2.5">
          <p className="break-all font-mono text-body-xs text-dark">{link}</p>
        </div>

        <button
          type="button"
          onClick={() => void copiar()}
          className="touch-target mt-3 inline-flex w-full items-center justify-center gap-2 rounded-sm bg-brand-blue-dark px-4 py-3 text-label-md font-bold text-white transition-all hover:bg-brand-blue-pale active:scale-[0.99]"
        >
          📋 Copiar link
        </button>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <a
            href={waHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("whatsapp")}
            className="touch-target inline-flex items-center justify-center gap-2 rounded-sm bg-whatsapp-green px-3 py-2.5 text-label-md font-bold text-white"
          >
            <span aria-hidden>📱</span> WhatsApp
          </a>
          <a
            href={twHref}
            target="_blank"
            rel="noreferrer"
            onClick={() => track("twitter")}
            className="touch-target inline-flex items-center justify-center gap-2 rounded-sm bg-brand-blue-dark px-3 py-2.5 text-label-md font-bold text-white"
          >
            <span aria-hidden>𝕏</span> Twitter / X
          </a>
        </div>

        <p className="mt-3 text-label-md text-muted-d">
          Tracking de referidos exitosos llega post-launch.
        </p>
      </ModalBody>
    </Modal>
  );
}
