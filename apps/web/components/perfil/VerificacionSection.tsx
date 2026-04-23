"use client";
// VerificacionSection — mockup `.profile-section.urgent` (línea 3951). 4
// filas: email, edad (+18), teléfono, DNI. Los dos últimos tienen botón
// "Agregar"/"Verificar" que abre modal.
//
// La verificación sigue siendo OPCIONAL en el MVP — teléfono da recuperación
// de cuenta, DNI habilita canjes > S/500. El usuario puede usar la app sin
// completarlas.

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/Modal";
import { SectionShell } from "./SectionShell";

interface Props {
  perfil: PerfilCompleto;
}

export function VerificacionSection({ perfil }: Props) {
  const [openTel, setOpenTel] = useState(false);
  const [openDni, setOpenDni] = useState(false);

  function triggerRefresh() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("perfil:refresh"));
    }
  }

  const pendientes =
    (perfil.telefonoVerif ? 0 : 1) + (perfil.dniVerif ? 0 : 1);
  const urgent = pendientes > 0;

  return (
    <SectionShell
      title="Verificación de cuenta"
      subtitle="Completa tu verificación para desbloquear todos los premios"
      icon="🛡️"
      iconTone="verif"
      urgent={urgent}
      badge={urgent ? `${pendientes} pendiente${pendientes > 1 ? "s" : ""}` : undefined}
    >
      <VerifRow
        done={!!perfil.emailVerified}
        title="Correo electrónico"
        desc={
          perfil.emailVerified
            ? `${perfil.email} · Verificado al registrarte`
            : perfil.email
        }
      />
      <VerifRow
        done={!!perfil.fechaNac}
        title="Edad (+18)"
        desc={
          perfil.fechaNac
            ? "Edad confirmada por fecha de nacimiento"
            : "Falta confirmar fecha de nacimiento"
        }
      />
      <VerifRow
        done={perfil.telefonoVerif}
        title="Teléfono"
        desc={
          perfil.telefonoVerif
            ? (perfil.telefono ?? "Teléfono verificado")
            : "Recomendado para recuperación de cuenta y seguridad"
        }
        ctaLabel={
          perfil.telefonoVerif
            ? undefined
            : perfil.telefono
              ? "Verificar"
              : "Agregar"
        }
        onCta={() => setOpenTel(true)}
      />
      <VerifRow
        done={perfil.dniVerif}
        title="DNI"
        desc={
          perfil.dniVerif
            ? "DNI verificado"
            : "Requerido solo para canjes de premios mayores a S/ 500"
        }
        ctaLabel={perfil.dniVerif ? undefined : "Verificar"}
        onCta={() => setOpenDni(true)}
      />

      {openTel ? (
        <TelefonoModal
          onClose={() => setOpenTel(false)}
          onSuccess={() => {
            setOpenTel(false);
            triggerRefresh();
          }}
        />
      ) : null}
      {openDni ? (
        <DniModal
          onClose={() => setOpenDni(false)}
          onSuccess={() => {
            setOpenDni(false);
            triggerRefresh();
          }}
        />
      ) : null}
    </SectionShell>
  );
}

function VerifRow({
  done,
  title,
  desc,
  ctaLabel,
  onCta,
}: {
  done: boolean;
  title: string;
  desc: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const iconCls = done
    ? "bg-alert-success-bg text-alert-success-text"
    : "bg-urgent-med-bg text-urgent-high-dark";
  return (
    <div className="flex items-center gap-3.5 border-b border-light px-5 py-3.5 last:border-b-0">
      <div
        aria-hidden
        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-base font-bold ${iconCls}`}
      >
        {done ? "✓" : "!"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-dark">{title}</div>
        <div className="text-xs leading-[1.4] text-muted-d">{desc}</div>
      </div>
      {done ? (
        <span className="flex-shrink-0 rounded-full bg-alert-success-bg px-3 py-1 text-[11px] font-bold uppercase tracking-[0.04em] text-alert-success-text">
          ✓ Verificado
        </span>
      ) : ctaLabel ? (
        <button
          type="button"
          onClick={onCta}
          className="flex-shrink-0 whitespace-nowrap rounded-sm bg-brand-blue-main px-3.5 py-1.5 text-xs font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-blue-light"
        >
          {ctaLabel}
        </button>
      ) : null}
    </div>
  );
}

function TelefonoModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [paso, setPaso] = useState<"telefono" | "codigo">("telefono");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function solicitar() {
    setCargando(true);
    setError("");
    try {
      const resp = await authedFetch("/api/v1/usuarios/verificacion/telefono", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "No se pudo enviar el código.");
        return;
      }
      setDevCode(json.data?.devCode ?? null);
      setPaso("codigo");
    } finally {
      setCargando(false);
    }
  }

  async function confirmar() {
    setCargando(true);
    setError("");
    try {
      const resp = await authedFetch(
        "/api/v1/usuarios/verificacion/telefono/confirmar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo }),
        },
      );
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "Código incorrecto.");
        return;
      }
      onSuccess();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} label="Verificar teléfono" maxWidth="420px">
      <ModalHeader onClose={onClose} eyebrow="Verificación">
        <h2 className="font-display text-[22px] font-extrabold">
          📱 Verificar teléfono
        </h2>
      </ModalHeader>
      <ModalBody>
        {paso === "telefono" ? (
          <div>
            <label className="text-[13px] font-bold text-dark">
              Número de teléfono
            </label>
            <input
              type="tel"
              placeholder="+51 999 999 999"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="mt-1 w-full rounded-md border border-light px-3 py-2 text-[14px]"
            />
            <p className="mt-2 text-[12px] text-muted-d">
              Te enviaremos un código de 6 dígitos por SMS (si no está
              configurado, llegará por email).
            </p>
          </div>
        ) : (
          <div>
            <label className="text-[13px] font-bold text-dark">
              Código recibido
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="mt-1 w-full rounded-md border border-light px-3 py-2 text-center font-display text-[24px] font-extrabold tracking-widest"
            />
            {devCode ? (
              <p className="mt-2 rounded-md bg-alert-info-bg px-3 py-2 text-[12px] text-alert-info-text">
                🔧 Modo dev: tu código es <strong>{devCode}</strong>
              </p>
            ) : null}
            <p className="mt-2 text-[12px] text-muted-d">
              Expira en 10 minutos. 3 intentos máximos.
            </p>
          </div>
        )}
        {error ? (
          <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
            {error}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        {paso === "telefono" ? (
          <button
            type="button"
            onClick={solicitar}
            disabled={cargando || telefono.length < 7}
            className="w-full rounded-md bg-brand-blue-main px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {cargando ? "Enviando..." : "Enviar código"}
          </button>
        ) : (
          <button
            type="button"
            onClick={confirmar}
            disabled={cargando || codigo.length !== 6}
            className="w-full rounded-md bg-brand-gold px-4 py-3 font-bold text-dark shadow-gold-btn disabled:opacity-50"
          >
            {cargando ? "Verificando..." : "✓ Confirmar"}
          </button>
        )}
      </ModalFooter>
    </Modal>
  );
}

function DniModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [dni, setDni] = useState("");
  const [imagen, setImagen] = useState<string>("");
  const [preview, setPreview] = useState<string>("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImagen(url);
      setPreview(url);
    };
    reader.readAsDataURL(file);
  }

  async function subir() {
    setCargando(true);
    setError("");
    try {
      const resp = await authedFetch("/api/v1/usuarios/verificacion/dni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dniNumero: dni, imagenBase64: imagen }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "No se pudo subir el DNI.");
        return;
      }
      onSuccess();
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} label="Verificar DNI" maxWidth="480px">
      <ModalHeader onClose={onClose} eyebrow="Verificación">
        <h2 className="font-display text-[22px] font-extrabold">
          🪪 Verificar DNI
        </h2>
      </ModalHeader>
      <ModalBody>
        <label className="text-[13px] font-bold text-dark">Número de DNI</label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          placeholder="12345678"
          value={dni}
          onChange={(e) => setDni(e.target.value.replace(/\D/g, ""))}
          className="mt-1 w-full rounded-md border border-light px-3 py-2 text-[14px]"
        />
        <label className="mt-4 block text-[13px] font-bold text-dark">
          Foto del DNI (máx 1.5MB — JPG/PNG)
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png"
          onChange={onFile}
          className="mt-1 w-full rounded-md border border-light bg-subtle px-3 py-2 text-[13px]"
        />
        {preview ? (
          <div className="mt-3 overflow-hidden rounded-md border border-light">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview DNI" className="w-full" />
          </div>
        ) : null}
        <p className="mt-3 text-[12px] text-muted-d">
          Tu DNI será revisado por nuestro equipo en 24-48 horas. Te avisamos
          por email.
        </p>
        {error ? (
          <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
            {error}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={subir}
          disabled={cargando || dni.length !== 8 || !imagen}
          className="w-full rounded-md bg-brand-blue-main px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          {cargando ? "Enviando..." : "Subir para revisión"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
