"use client";
// FooterSections — 4 secciones de cola del mockup (líneas 4160-4298):
//   - Seguridad: método login, dispositivos, cuentas vinculadas, descargar datos
//   - Ayuda: cómo jugar, FAQ, contáctanos, reportar problema
//   - Legal: términos, privacidad, juego responsable, sobre lukas, acerca
//   - Danger zone: cerrar sesión + eliminar cuenta
//
// Mini-lote 7.6:
//   - "Cerrar sesión" usa signOut con redirect:false + hard reload (mismo
//     patrón que UserMenu). Evita el 429 silencioso del rate limit y el
//     loop a OAuth que terminaba en lockout de Google.
//   - "Eliminar cuenta" reemplaza el flujo email-token por uno in-app
//     inmediato con confirmación typing "ELIMINAR". El endpoint nuevo
//     `/me/eliminar/inmediato` decide hard vs soft delete según
//     actividad histórica. El flujo email-token (POST /me/eliminar +
//     /me/eliminar/confirmar) queda como legacy en el backend pero la UI
//     no lo invoca.

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
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  async function cerrarSesion() {
    if (cerrandoSesion) return;
    setCerrandoSesion(true);
    try {
      await signOut({ redirect: false, callbackUrl: "/" });
    } catch {
      // signOut nunca rechaza con redirect:false; por si NextAuth tira
      // un edge inesperado, el hard reload muestra el estado real.
    }
    window.location.href = "/";
  }

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
          disabled={cerrandoSesion}
          onClick={() => void cerrarSesion()}
          className="mb-2.5 flex w-full items-center justify-center gap-2 rounded-sm border border-accent-clasico-dark/40 bg-white px-4 py-3 text-sm font-bold text-accent-clasico-dark transition hover:border-accent-clasico-dark hover:bg-accent-clasico-dark hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          🚪 {cerrandoSesion ? "Cerrando sesión…" : "Cerrar sesión"}
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

// EliminarCuentaModal — flujo in-app inmediato (Mini-lote 7.6). El usuario
// confirma tipeando "ELIMINAR" en un input; al click, POST a
// /api/v1/usuarios/me/eliminar/inmediato. El backend decide hard vs soft
// y devuelve `{ modo }`. Tras éxito, signOut() + hard reload a "/".
const TEXTO_CONFIRMACION = "ELIMINAR";

function EliminarCuentaModal({
  balanceLukas,
  onClose,
}: {
  balanceLukas: number;
  onClose: () => void;
}) {
  const [confirmacion, setConfirmacion] = useState("");
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [modoAplicado, setModoAplicado] = useState<"hard" | "soft" | null>(
    null,
  );
  const [error, setError] = useState("");

  const puedeConfirmar = confirmacion === TEXTO_CONFIRMACION && !cargando;

  async function eliminar() {
    if (!puedeConfirmar) return;
    setCargando(true);
    setError("");
    try {
      const resp = await authedFetch(
        "/api/v1/usuarios/me/eliminar/inmediato",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ confirmacion: TEXTO_CONFIRMACION }),
        },
      );
      const json = await resp.json();
      if (!resp.ok) {
        setEstado("error");
        setError(json?.error?.message ?? "No se pudo procesar.");
        return;
      }
      setModoAplicado(json?.data?.modo ?? "soft");
      setEstado("ok");
      // Pequeño delay para que el usuario lea el feedback antes del
      // signOut + hard reload — UX más amable que cortar al instante.
      setTimeout(async () => {
        try {
          await signOut({ redirect: false, callbackUrl: "/" });
        } catch {
          // ignore — el hard reload de abajo limpia la cookie igual
        }
        window.location.href = "/";
      }, 1800);
    } catch {
      setEstado("error");
      setError("Error de red. Reintentá en unos segundos.");
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
        {estado === "ok" ? (
          <div className="py-4 text-center">
            <div aria-hidden className="text-5xl">
              👋
            </div>
            <h3 className="mt-3 font-display text-lg font-bold text-dark">
              Tu cuenta se eliminó
            </h3>
            <p className="mt-2 text-[13px] text-body">
              {modoAplicado === "hard"
                ? "Borramos todos tus datos. Te enviamos un correo de confirmación."
                : "Anonimizamos tu información personal y borramos tus sesiones. Conservamos solo registros de tickets y transacciones por integridad histórica. Te enviamos un correo de confirmación."}
            </p>
            <p className="mt-3 text-[12px] text-muted-d">
              Cerrando sesión en un instante…
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
                . Si querés canjearlos antes, cerrá este diálogo y visitá la
                tienda.
              </div>
            ) : null}
            <p className="mt-3 text-sm text-body">
              Al confirmar:
            </p>
            <ul className="mt-2 list-disc pl-5 text-[13px] leading-relaxed text-body">
              <li>Se borran tus datos personales (nombre, email, teléfono, imagen, DNI).</li>
              <li>Se cierran todas tus sesiones activas.</li>
              <li>Se desvincula tu cuenta de Google si la tenías conectada.</li>
              <li>
                Tus tickets en torneos en curso siguen contando, pero quedan
                como <em>“Usuario eliminado”</em> en los rankings.
              </li>
            </ul>
            <p className="mt-3 text-[13px] font-semibold text-urgent-critical">
              Esta acción NO se puede revertir.
            </p>

            <div className="mt-4">
              <label
                htmlFor="confirmacion-eliminar"
                className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-muted-d"
              >
                Para confirmar, escribí{" "}
                <span className="font-bold text-dark">{TEXTO_CONFIRMACION}</span>
              </label>
              <input
                id="confirmacion-eliminar"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={confirmacion}
                onChange={(e) =>
                  setConfirmacion(e.target.value.toUpperCase())
                }
                disabled={cargando}
                className="mt-1.5 w-full rounded-md border border-light bg-card px-3 py-2.5 text-[15px] font-mono tracking-[0.08em] text-dark outline-none transition-colors focus:border-urgent-critical disabled:opacity-50"
                placeholder={TEXTO_CONFIRMACION}
              />
            </div>

            {error ? (
              <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
                {error}
              </div>
            ) : null}
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {estado === "ok" ? null : (
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onClose}
              disabled={cargando}
              className="w-full rounded-md border border-strong bg-card px-4 py-3 text-sm font-bold text-body transition hover:border-brand-blue-main hover:text-brand-blue-main disabled:opacity-50 sm:w-auto sm:flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={eliminar}
              disabled={!puedeConfirmar}
              className="w-full rounded-md bg-urgent-critical px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:flex-1"
            >
              {cargando ? "Eliminando…" : "Eliminar cuenta permanentemente"}
            </button>
          </div>
        )}
      </ModalFooter>
    </Modal>
  );
}
