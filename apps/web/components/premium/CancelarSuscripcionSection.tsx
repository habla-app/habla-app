"use client";

// CancelarSuscripcionSection — sección crítica de cancelar/reactivar
// (Lote D). Spec: docs/ux-spec/04-pista-usuario-premium/mi-suscripcion.spec.md.
//
// Cancelación honesta y clara — botón visible, modal con info honesta,
// sin dark patterns. Survey opcional 1 pregunta para entender churn.
//
// Si la suscripción ya está cancelada (estado=cancelando): el botón se
// reemplaza por "Reactivar", que llama a `reactivarMiSuscripcion()`.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import {
  cancelarMiSuscripcion,
  reactivarMiSuscripcion,
} from "@/app/(public)/premium/mi-suscripcion/actions";
import { formatearFechaLargaPe } from "@/lib/utils/datetime";

type Modo = "activa" | "cancelando";

interface Props {
  modo: Modo;
  vencimiento: Date | null;
}

const MOTIVOS = [
  { value: "caro", label: "Caro" },
  { value: "no_me_sirvio", label: "No me sirvió" },
  { value: "solo_probaba", label: "Solo lo probaba" },
  { value: "otro", label: "Otro motivo" },
] as const;

export function CancelarSuscripcionSection({ modo, vencimiento }: Props) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [motivo, setMotivo] = useState<(typeof MOTIVOS)[number]["value"] | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleCancelar = () => {
    setError(null);
    startTransition(async () => {
      const result = await cancelarMiSuscripcion(motivo ?? undefined);
      if (!result.ok) {
        setError(result.error ?? "Hubo un problema. Intenta de nuevo.");
        return;
      }
      setModalOpen(false);
      router.refresh();
    });
  };

  const handleReactivar = () => {
    setError(null);
    startTransition(async () => {
      const result = await reactivarMiSuscripcion();
      if (!result.ok) {
        setError(result.error ?? "Hubo un problema. Intenta de nuevo.");
        return;
      }
      router.refresh();
    });
  };

  if (modo === "cancelando") {
    return (
      <section
        aria-label="Reactivar suscripción"
        className="bg-card px-4 py-5"
      >
        <h3 className="mb-3 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-status-amber-text">
          ⚠ Tu suscripción está cancelando
        </h3>
        {vencimiento ? (
          <p className="mb-3 text-body-xs leading-snug text-body">
            Mantienes acceso al Channel hasta el{" "}
            <strong>{formatearFechaLargaPe(vencimiento)}</strong>. Puedes
            reactivar para que se renueve normalmente.
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleReactivar}
          disabled={pending}
          className="touch-target inline-flex w-full items-center justify-center rounded-md bg-brand-gold px-4 py-3 font-display text-[13px] font-extrabold uppercase tracking-[0.04em] text-black shadow-gold-btn transition-all hover:bg-brand-gold-light disabled:opacity-60"
        >
          {pending ? "Reactivando…" : "Reactivar suscripción"}
        </button>
        {error ? (
          <p className="mt-2 text-center text-body-xs text-urgent-critical">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Zona crítica"
      className="bg-card px-4 py-5"
    >
      <h3 className="mb-3 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-status-red">
        ⚠ Zona crítica
      </h3>
      <button
        type="button"
        onClick={() => {
          setMotivo(null);
          setError(null);
          setModalOpen(true);
        }}
        className="touch-target block w-full rounded-md border-[1.5px] border-status-red bg-transparent px-3 py-3 text-body-sm font-bold text-status-red transition-colors hover:bg-status-red-bg"
      >
        Cancelar suscripción
      </button>
      <p className="mt-2 text-center text-body-xs leading-snug text-muted-d">
        Mantienes acceso al Channel hasta tu próxima fecha de renovación. No te
        cobramos más después.
      </p>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        label="¿Cancelar tu suscripción?"
        maxWidth="480px"
      >
        <ModalHeader onClose={() => setModalOpen(false)} eyebrow="Cancelar Premium" tone="hero-blue">
          <h2 className="font-display text-display-md font-extrabold uppercase tracking-tight text-white">
            ¿Cancelar tu suscripción?
          </h2>
        </ModalHeader>
        <ModalBody>
          <p className="mb-3 text-body-sm leading-snug text-body">
            {vencimiento ? (
              <>
                Mantienes acceso al WhatsApp Channel hasta el{" "}
                <strong>{formatearFechaLargaPe(vencimiento)}</strong>. No te
                cobramos más a partir de esa fecha.
              </>
            ) : (
              "Mantienes acceso al WhatsApp Channel hasta el final del periodo pagado. No te cobramos más después."
            )}
          </p>
          <fieldset className="rounded-md bg-subtle p-3">
            <legend className="text-body-xs font-bold text-dark">
              ¿Por qué cancelas? (opcional)
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {MOTIVOS.map((m) => (
                <label
                  key={m.value}
                  className={`touch-target flex cursor-pointer items-center gap-2 rounded-sm border bg-card px-2 py-2 text-body-xs ${
                    motivo === m.value
                      ? "border-brand-blue-main bg-brand-blue-main/5 text-dark"
                      : "border-light text-body"
                  }`}
                >
                  <input
                    type="radio"
                    name="motivo-cancelacion"
                    value={m.value}
                    checked={motivo === m.value}
                    onChange={() => setMotivo(m.value)}
                    className="accent-brand-blue-main"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? (
            <p className="mt-3 rounded-md border border-alert-danger-border bg-alert-danger-bg px-3 py-2 text-body-xs text-alert-danger-text">
              {error}
            </p>
          ) : null}
        </ModalBody>
        <ModalFooter>
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              onClick={() => setModalOpen(false)}
              disabled={pending}
            >
              Mantener mi Premium
            </Button>
            <Button
              variant="danger"
              size="lg"
              onClick={handleCancelar}
              disabled={pending}
            >
              {pending ? "Cancelando…" : "Confirmar cancelación"}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
    </section>
  );
}
