"use client";
// FooterSections — 4 secciones de cola del mockup (líneas 4160-4298):
//   - Seguridad: método login, dispositivos, cuentas vinculadas, descargar datos
//   - Ayuda: cómo jugar, FAQ, contáctanos, reportar problema
//   - Legal: términos, privacidad, juego responsable, sobre lukas, acerca
//   - Danger zone: cerrar sesión + eliminar cuenta
//
// Endpoints preservados del SS7 (nada nuevo): POST /me/datos-download,
// POST /me/eliminar. Modal de eliminar usa createPortal.

import { useState } from "react";
import { signOut } from "next-auth/react";
import { authedFetch } from "@/lib/api-client";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/Modal";
import { SectionShell, MenuItem } from "./SectionShell";

interface Props {
  balanceLukas: number;
  email: string;
}

export function FooterSections({ balanceLukas, email }: Props) {
  const [openEliminar, setOpenEliminar] = useState(false);
  const [descargaMsg, setDescargaMsg] = useState<
    { tipo: "ok" | "error"; texto: string } | null
  >(null);
  const [descargando, setDescargando] = useState(false);

  async function descargar() {
    setDescargaMsg(null);
    setDescargando(true);
    try {
      const resp = await authedFetch("/api/v1/usuarios/me/datos-download", {
        method: "POST",
      });
      const json = await resp.json();
      if (!resp.ok) {
        setDescargaMsg({
          tipo: "error",
          texto: json?.error?.message ?? "Error",
        });
        return;
      }
      setDescargaMsg({
        tipo: "ok",
        texto: "Te enviamos un email con el link de descarga.",
      });
    } catch {
      setDescargaMsg({ tipo: "error", texto: "Error de red." });
    } finally {
      setDescargando(false);
    }
  }

  return (
    <>
      <SectionShell
        title="Seguridad"
        subtitle="Cuidado de tu cuenta y datos"
        icon="🔐"
        iconTone="secur"
      >
        <MenuItem
          icon="✉️"
          label="Método de inicio de sesión"
          sub={`Magic link o Google · ${email}`}
        />
        <MenuItem
          icon="📱"
          label="Dispositivos activos"
          sub="Ver sesiones y cerrar las que no reconoces"
        />
        <MenuItem
          icon="📥"
          label="Descargar mis datos"
          sub={
            descargando
              ? "Solicitando…"
              : descargaMsg
                ? descargaMsg.texto
                : "Recibe una copia de tu información en un archivo"
          }
          onClick={descargar}
          disabled={descargando}
        />
      </SectionShell>

      <SectionShell
        title="Ayuda y soporte"
        subtitle="Resolvemos tus dudas rápido"
        icon="💬"
        iconTone="help"
      >
        <MenuItem
          icon="📖"
          label="Cómo jugar"
          sub="Guía paso a paso"
          href="/como-jugar"
        />
        <MenuItem
          icon="❓"
          label="Preguntas frecuentes"
          sub="Respuestas a dudas comunes"
          href="/faq"
        />
        <MenuItem
          icon="✉️"
          label="Contáctanos"
          sub="equipo@hablaplay.com · Respondemos en menos de 24h"
          href="mailto:equipo@hablaplay.com"
        />
        <MenuItem
          icon="🐛"
          label="Reportar un problema"
          sub="¿Algo no funciona como debería?"
          href="mailto:equipo@hablaplay.com?subject=Reporte%20de%20problema"
        />
      </SectionShell>

      <SectionShell
        title="Información legal"
        subtitle="Términos, privacidad y más"
        icon="📄"
        iconTone="legal"
      >
        <MenuItem icon="📋" label="Términos de servicio" href="/legal/terminos" />
        <MenuItem
          icon="🔒"
          label="Política de privacidad"
          href="/legal/privacidad"
        />
        <MenuItem
          icon="⚖️"
          label="Información sobre juego responsable"
          href="/legal/juego-responsable"
        />
        <MenuItem
          icon="🪙"
          label="Sobre los Lukas (moneda virtual)"
          href="/legal/lukas"
        />
        <MenuItem icon="🏠" label="Acerca de Habla!" href="/legal/acerca" />
      </SectionShell>

      <section className="mb-6 rounded-md border border-urgent-critical/20 bg-pred-wrong-bg/60 px-5 py-5 shadow-sm">
        <div className="mb-3 font-display text-sm font-extrabold uppercase tracking-[0.06em] text-accent-clasico-dark">
          ⚠️ Acciones de cuenta
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-sm border border-accent-clasico-dark/40 bg-white px-4 py-3 text-sm font-bold text-accent-clasico-dark transition hover:border-accent-clasico-dark hover:bg-accent-clasico-dark hover:text-white"
        >
          🚪 Cerrar sesión
        </button>
        <button
          type="button"
          onClick={() => setOpenEliminar(true)}
          className="w-full text-center text-xs font-semibold text-danger underline-offset-2 hover:underline"
        >
          Eliminar mi cuenta permanentemente
        </button>
      </section>

      <footer className="pb-8 text-center text-xs text-muted-d">
        Habla! v1.0 · Hecho en Perú 🇵🇪
      </footer>

      {openEliminar ? (
        <EliminarCuentaModal
          balanceLukas={balanceLukas}
          onClose={() => setOpenEliminar(false)}
        />
      ) : null}
    </>
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
        <h2 className="font-display text-[22px] font-extrabold">
          🗑️ Eliminar cuenta
        </h2>
      </ModalHeader>
      <ModalBody>
        {estado === "enviado" ? (
          <div className="py-4 text-center">
            <div aria-hidden className="text-5xl">
              📧
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-dark">
              Revisá tu email
            </h3>
            <p className="mt-2 text-[13px] text-body">
              Te enviamos un link de confirmación. Es válido por 48 horas. Si no
              lo confirmás, tu cuenta sigue activa.
            </p>
          </div>
        ) : (
          <>
            {balanceLukas > 0 ? (
              <div className="rounded-md border border-urgent-high bg-urgent-high-bg px-3 py-2 text-[13px] text-urgent-high-dark">
                ⚠️ Perderás{" "}
                <strong>
                  {balanceLukas.toLocaleString("es-PE")} Lukas canjeables
                </strong>
                . Si querés canjearlos antes, ignorá este flujo y visitá la
                tienda.
              </div>
            ) : null}
            <p className="mt-3 text-sm text-body">
              Al confirmar, tu cuenta se anonimiza: tu nombre, email, teléfono
              e imagen se borran. Los tickets y transacciones se preservan para
              auditoría pero sin asociación a tu identidad.
            </p>
            <p className="mt-2 text-[13px] text-muted-d">
              Esta acción NO se puede revertir.
            </p>
            {error ? (
              <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
                {error}
              </div>
            ) : null}
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
