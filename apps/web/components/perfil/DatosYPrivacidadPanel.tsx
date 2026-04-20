// DatosYPrivacidadPanel — descargar datos + eliminar cuenta. Sub-Sprint 7.
"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";

interface Props {
  balanceLukas: number;
}

export function DatosYPrivacidadPanel({ balanceLukas }: Props) {
  const [msg, setMsg] = useState<{ tipo: "ok" | "error"; texto: string } | null>(
    null,
  );
  const [openEliminar, setOpenEliminar] = useState(false);

  async function descargar() {
    setMsg(null);
    try {
      const resp = await authedFetch("/api/v1/usuarios/me/datos-download", {
        method: "POST",
      });
      const json = await resp.json();
      if (!resp.ok) {
        setMsg({ tipo: "error", texto: json?.error?.message ?? "Error" });
        return;
      }
      setMsg({
        tipo: "ok",
        texto: "Te enviamos un email con el link de descarga.",
      });
    } catch {
      setMsg({ tipo: "error", texto: "Error de red." });
    }
  }

  return (
    <section className="rounded-md border border-light bg-card p-5 shadow-sm">
      <h2 className="font-display text-[16px] font-extrabold uppercase tracking-[0.06em] text-dark">
        Datos y privacidad
      </h2>
      <p className="mt-1 text-[13px] text-muted-d">
        Controlá tu información personal.
      </p>
      <div className="mt-4 space-y-3">
        <div className="flex flex-col gap-3 rounded-md border border-light bg-subtle p-4 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-display text-[14px] font-bold text-dark">
              📥 Descargar mis datos
            </div>
            <div className="text-[12px] text-muted-d">
              Archivo JSON con tu perfil, transacciones, tickets y canjes.
            </div>
          </div>
          <button
            type="button"
            onClick={descargar}
            className="rounded-md border border-brand-blue-main px-4 py-2 text-[13px] font-bold text-brand-blue-main hover:bg-brand-blue-main hover:text-white"
          >
            Solicitar
          </button>
        </div>
        <div className="flex flex-col gap-3 rounded-md border border-urgent-critical/20 bg-urgent-critical-bg p-4 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="font-display text-[14px] font-bold text-urgent-critical-hover">
              🗑️ Eliminar cuenta
            </div>
            <div className="text-[12px] text-urgent-high-dark">
              Tu cuenta se anonimiza. Los tickets y transacciones se preservan
              por requerimientos de auditoría.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpenEliminar(true)}
            className="rounded-md border border-urgent-critical px-4 py-2 text-[13px] font-bold text-urgent-critical hover:bg-urgent-critical hover:text-white"
          >
            Eliminar
          </button>
        </div>
      </div>
      {msg && (
        <div
          className={`mt-3 rounded-md px-3 py-2 text-[13px] ${
            msg.tipo === "ok"
              ? "bg-alert-success-bg text-alert-success-text"
              : "bg-pred-wrong-bg text-pred-wrong"
          }`}
        >
          {msg.texto}
        </div>
      )}

      {openEliminar && (
        <EliminarCuentaModal
          balanceLukas={balanceLukas}
          onClose={() => setOpenEliminar(false)}
        />
      )}
    </section>
  );
}

function EliminarCuentaModal({
  balanceLukas,
  onClose,
}: {
  balanceLukas: number;
  onClose: () => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<"idle" | "enviado" | "error">("idle");
  const [error, setError] = useState("");

  async function solicitar() {
    setCargando(true);
    setError("");
    try {
      const resp = await authedFetch("/api/v1/usuarios/me/eliminar", {
        method: "POST",
      });
      const json = await resp.json();
      if (!resp.ok) {
        setEstado("error");
        setError(json?.error?.message ?? "No se pudo procesar.");
        return;
      }
      setEstado("enviado");
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} label="Eliminar cuenta" maxWidth="460px">
      <ModalHeader onClose={onClose} eyebrow="Danger zone">
        <h2 className="font-display text-[22px] font-extrabold">🗑️ Eliminar cuenta</h2>
      </ModalHeader>
      <ModalBody>
        {estado === "enviado" ? (
          <div className="py-4 text-center">
            <div className="text-5xl">📧</div>
            <h3 className="mt-3 font-display text-[18px] font-bold text-dark">
              Revisá tu email
            </h3>
            <p className="mt-2 text-[13px] text-body">
              Te enviamos un link de confirmación. Es válido por 48 horas. Si no
              lo confirmás, tu cuenta sigue activa.
            </p>
          </div>
        ) : (
          <>
            {balanceLukas > 0 && (
              <div className="rounded-md border border-urgent-high bg-urgent-high-bg px-3 py-2 text-[13px] text-urgent-high-dark">
                ⚠️ Perderás <strong>{balanceLukas} Lukas canjeables</strong>.
                Si querés canjearlos antes, ignorá este flujo y visitá la tienda.
              </div>
            )}
            <p className="mt-3 text-[14px] text-body">
              Al confirmar, tu cuenta se anonimiza: tu nombre, email, teléfono e
              imagen se borran. Los tickets y transacciones se preservan para
              auditoría pero sin asociación a tu identidad.
            </p>
            <p className="mt-2 text-[13px] text-muted-d">
              Esta acción NO se puede revertir.
            </p>
            {error && (
              <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
                {error}
              </div>
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {estado === "enviado" ? (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md bg-brand-blue-main px-4 py-3 font-bold text-white"
          >
            Entendido
          </button>
        ) : (
          <button
            type="button"
            onClick={solicitar}
            disabled={cargando}
            className="w-full rounded-md bg-urgent-critical px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {cargando ? "Enviando..." : "Enviarme el link de confirmación"}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}
