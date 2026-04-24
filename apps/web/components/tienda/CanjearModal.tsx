// CanjearModal — confirmación de canje. Sub-Sprint 6.
//
// Estados:
//  - idle: muestra resumen del premio + form de dirección si requiereDireccion.
//  - submitting: loader en el CTA.
//  - success: panel con confirmación + CTA a /perfil.
//  - error: mensaje + retry.
"use client";

import { useState } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import type { PremioDTO } from "@/lib/services/premios.service";
import { authedFetch } from "@/lib/api-client";
import { track } from "@/lib/analytics";
import { useLukasStore } from "@/stores/lukas.store";

interface CanjearModalProps {
  premio: PremioDTO;
  balanceActual: number;
  onClose: () => void;
  onSuccess: () => void;
}

type Status = "idle" | "submitting" | "success" | "error";

export function CanjearModal({
  premio,
  onClose,
  onSuccess,
}: CanjearModalProps) {
  const balance = useLukasStore((s) => s.balance);
  const setBalance = useLukasStore((s) => s.setBalance);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");

  // Form de dirección (solo si requiereDireccion)
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [referencia, setReferencia] = useState("");

  const balanceDespues = Math.max(0, balance - premio.costeLukas);

  async function handleCanjear() {
    setStatus("submitting");
    setError("");
    try {
      const body = premio.requiereDireccion
        ? {
            direccion: {
              nombre: nombre.trim(),
              telefono: telefono.trim(),
              direccion: direccion.trim(),
              ciudad: ciudad.trim(),
              referencia: referencia.trim() || undefined,
            },
          }
        : {};
      const resp = await authedFetch(`/api/v1/premios/${premio.id}/canjear`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "No se pudo completar el canje.");
        setStatus("error");
        return;
      }
      setBalance(json.data.nuevoBalance);
      track("canje_solicitado", {
        premio_id: premio.id,
        costo_lukas: premio.costeLukas,
      });
      setStatus("success");
    } catch (e) {
      setError("Error de red. Intenta de nuevo.");
      setStatus("error");
    }
  }

  const formValido =
    !premio.requiereDireccion ||
    (nombre.trim().length >= 2 &&
      telefono.trim().length >= 7 &&
      direccion.trim().length >= 5 &&
      ciudad.trim().length >= 2);

  return (
    <Modal isOpen onClose={onClose} label={`Canjear ${premio.nombre}`} maxWidth="520px">
      <ModalHeader onClose={onClose} eyebrow="Canjear premio" shimmer>
        <h2 className="font-display text-[24px] font-extrabold">{premio.nombre}</h2>
      </ModalHeader>

      {status === "success" ? (
        <>
          <ModalBody>
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-4 text-6xl">🎉</div>
              <h3 className="font-display text-[22px] font-bold text-dark">
                ¡Canje realizado!
              </h3>
              <p className="mt-2 max-w-sm text-[14px] text-body">
                Te enviamos un email con los detalles. Seguimiento en tu perfil.
              </p>
              <div className="mt-6 rounded-md bg-subtle px-5 py-3">
                <div className="text-[12px] text-muted-d">Balance restante</div>
                <div className="font-display text-[28px] font-extrabold text-brand-gold-dark">
                  {balance} 🪙
                </div>
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSuccess}
                className="flex-1 rounded-md border border-light px-4 py-3 font-bold text-dark hover:bg-hover"
              >
                Seguir comprando
              </button>
              <a
                href="/perfil"
                className="flex-1 rounded-md bg-brand-blue-main px-4 py-3 text-center font-bold text-white hover:bg-brand-blue-mid"
              >
                Ver mis canjes
              </a>
            </div>
          </ModalFooter>
        </>
      ) : (
        <>
          <ModalBody>
            <div className="rounded-md bg-subtle p-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{premio.imagen ?? "🎁"}</span>
                <div className="flex-1">
                  <div className="font-display text-[17px] font-bold text-dark">
                    {premio.nombre}
                  </div>
                  <div className="text-[13px] text-body">
                    {premio.descripcion}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-[20px] font-extrabold text-brand-gold-dark">
                    {premio.costeLukas} 🪙
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border border-light p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-d">
                  Balance actual
                </div>
                <div className="font-display text-[20px] font-bold text-dark">
                  {balance} 🪙
                </div>
              </div>
              <div className="rounded-md border border-light p-3">
                <div className="text-[11px] uppercase tracking-wide text-muted-d">
                  Balance después
                </div>
                <div className="font-display text-[20px] font-bold text-brand-gold-dark">
                  {balanceDespues} 🪙
                </div>
              </div>
            </div>

            {premio.requiereDireccion && (
              <div className="mt-5">
                <h4 className="mb-3 font-display text-[14px] font-bold uppercase tracking-wide text-muted-d">
                  Dirección de envío
                </h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Nombre completo"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
                  />
                  <input
                    type="tel"
                    placeholder="Teléfono"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
                  />
                  <input
                    type="text"
                    placeholder="Dirección (av, calle, número)"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
                  />
                  <input
                    type="text"
                    placeholder="Ciudad / distrito"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
                  />
                  <input
                    type="text"
                    placeholder="Referencia (opcional)"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    className="w-full rounded-md border border-light px-3 py-2 text-[14px]"
                  />
                </div>
              </div>
            )}

            {status === "error" && error && (
              <div className="mt-4 rounded-md bg-alert-info-bg border border-alert-info-border p-3 text-[13px] text-alert-info-text">
                {error}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={handleCanjear}
              disabled={status === "submitting" || !formValido}
              className="w-full rounded-md bg-brand-gold px-4 py-3 font-bold text-dark shadow-gold-btn transition-colors hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="confirmar-canje-btn"
            >
              {status === "submitting"
                ? "Procesando..."
                : `✓ Confirmar por ${premio.costeLukas} 🪙`}
            </button>
          </ModalFooter>
        </>
      )}
    </Modal>
  );
}
