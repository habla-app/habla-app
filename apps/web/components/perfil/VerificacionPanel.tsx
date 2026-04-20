// VerificacionPanel — email + edad + teléfono (con flujo SMS) + DNI.
"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PerfilCompleto } from "@/lib/services/usuarios.service";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";

interface VerificacionPanelProps {
  perfil: PerfilCompleto;
  onActualizar: () => void;
}

export function VerificacionPanel({ perfil, onActualizar }: VerificacionPanelProps) {
  const [openTel, setOpenTel] = useState(false);
  const [openDni, setOpenDni] = useState(false);

  function triggerRefresh() {
    onActualizar();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("perfil:refresh"));
    }
  }

  return (
    <section className="rounded-md border border-light bg-card p-5 shadow-sm">
      <h2 className="font-display text-[16px] font-extrabold uppercase tracking-[0.06em] text-dark">
        Verificación
      </h2>
      <p className="mt-1 text-[13px] text-muted-d">
        Verificá tu cuenta para mantenerla segura y habilitar canjes grandes.
      </p>
      <div className="mt-4 divide-y divide-border-light">
        <VerifRow
          icono="📧"
          label="Email"
          estado={perfil.emailVerified ? "verificado" : "pendiente"}
          texto={perfil.email}
        />
        <VerifRow
          icono="🎂"
          label="Edad (18+)"
          estado={perfil.fechaNac ? "verificado" : "pendiente"}
          texto={perfil.fechaNac ? "Verificada" : "Pendiente"}
        />
        <VerifRow
          icono="📱"
          label="Teléfono"
          estado={perfil.telefonoVerif ? "verificado" : perfil.telefono ? "pendiente" : "ausente"}
          texto={perfil.telefono ?? "No agregado"}
          ctaLabel={perfil.telefonoVerif ? undefined : "Verificar"}
          onCta={() => setOpenTel(true)}
        />
        <VerifRow
          icono="🪪"
          label="DNI (para canjes > S/500)"
          estado={perfil.dniVerif ? "verificado" : "ausente"}
          texto={perfil.dniVerif ? "Verificado" : "No verificado"}
          ctaLabel={perfil.dniVerif ? undefined : "Verificar"}
          onCta={() => setOpenDni(true)}
        />
      </div>

      {openTel && (
        <TelefonoModal
          onClose={() => setOpenTel(false)}
          onSuccess={() => {
            setOpenTel(false);
            triggerRefresh();
          }}
        />
      )}
      {openDni && (
        <DniModal
          onClose={() => setOpenDni(false)}
          onSuccess={() => {
            setOpenDni(false);
            triggerRefresh();
          }}
        />
      )}
    </section>
  );
}

function VerifRow({
  icono,
  label,
  estado,
  texto,
  ctaLabel,
  onCta,
}: {
  icono: string;
  label: string;
  estado: "verificado" | "pendiente" | "ausente";
  texto: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  const badge =
    estado === "verificado" ? (
      <span className="inline-flex items-center rounded-full bg-pred-correct-bg px-2.5 py-0.5 text-[11px] font-bold text-pred-correct">
        ✓ Verificado
      </span>
    ) : estado === "pendiente" ? (
      <span className="inline-flex items-center rounded-full bg-urgent-med-bg px-2.5 py-0.5 text-[11px] font-bold text-urgent-high">
        ⚠ Pendiente
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-subtle px-2.5 py-0.5 text-[11px] font-bold text-muted-d">
        Sin agregar
      </span>
    );
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-xl" aria-hidden>
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-dark">{label}</div>
        <div className="truncate text-[12px] text-muted-d">{texto}</div>
      </div>
      {badge}
      {ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          className="rounded-md border border-brand-blue-main px-3 py-1.5 text-[12px] font-bold text-brand-blue-main hover:bg-brand-blue-main hover:text-white"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}

// ---- Modal: verificar teléfono ----

function TelefonoModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [paso, setPaso] = useState<"telefono" | "codigo">("telefono");
  const [telefono, setTelefono] = useState("");
  const [codigo, setCodigo] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function solicitarCodigo() {
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
        <h2 className="font-display text-[22px] font-extrabold">📱 Verificar teléfono</h2>
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
              Te enviaremos un código de 6 dígitos por SMS (si no está configurado,
              llegará por email).
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
            {devCode && (
              <p className="mt-2 rounded-md bg-alert-info-bg px-3 py-2 text-[12px] text-alert-info-text">
                🔧 Modo dev: tu código es <strong>{devCode}</strong>
              </p>
            )}
            <p className="mt-2 text-[12px] text-muted-d">
              Expira en 10 minutos. 3 intentos máximos.
            </p>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        {paso === "telefono" ? (
          <button
            type="button"
            onClick={solicitarCodigo}
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

// ---- Modal: verificar DNI ----

function DniModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
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
        <h2 className="font-display text-[22px] font-extrabold">🪪 Verificar DNI</h2>
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
        {preview && (
          <div className="mt-3 overflow-hidden rounded-md border border-light">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview DNI" className="w-full" />
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted-d">
          Tu DNI será revisado por nuestro equipo en 24-48 horas. Te avisamos por email.
        </p>
        {error && (
          <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
            {error}
          </div>
        )}
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
