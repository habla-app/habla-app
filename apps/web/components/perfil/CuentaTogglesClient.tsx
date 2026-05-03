"use client";
// CuentaTogglesClient — Lote N v3.2.
// Toggles del bloque "Privacidad + sesión" del perfil
// (mockup líneas 4300-4322).
//
// 3 toggles:
//   1. Perfil público → PATCH /api/v1/usuarios/me { perfilPublico }
//   2. Notificaciones por email → PATCH /api/v1/usuarios/notificaciones { emailSemanal }
//   3. Notificaciones push → placeholder (no hay backend todavía).

import { useState } from "react";

interface Props {
  perfilPublico: boolean;
  emailSemanal: boolean;
}

export function CuentaTogglesClient({ perfilPublico, emailSemanal }: Props) {
  const [pub, setPub] = useState<boolean>(perfilPublico);
  const [email, setEmail] = useState<boolean>(emailSemanal);
  const [push, setPush] = useState<boolean>(false);

  async function togglePub() {
    const next = !pub;
    setPub(next);
    await fetch("/api/v1/usuarios/me", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ perfilPublico: next }),
    }).catch(() => setPub(!next));
  }

  async function toggleEmail() {
    const next = !email;
    setEmail(next);
    await fetch("/api/v1/usuarios/notificaciones", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailSemanal: next }),
    }).catch(() => setEmail(!next));
  }

  function togglePush() {
    setPush((v) => !v);
  }

  return (
    <>
      <div className="cuenta-toggle-row">
        <div>
          <div style={{ fontWeight: 700, color: "var(--text-dark)", fontSize: 13 }}>Perfil público</div>
          <div style={{ fontSize: 11, color: "var(--text-muted-d)" }}>Otros tipsters pueden ver tu perfil y predicciones</div>
        </div>
        <button
          type="button"
          className={pub ? "toggle-switch on" : "toggle-switch off"}
          onClick={togglePub}
          aria-pressed={pub}
          aria-label="Perfil público"
        >
          <div className="toggle-thumb"></div>
        </button>
      </div>
      <div className="cuenta-toggle-row">
        <div>
          <div style={{ fontWeight: 700, color: "var(--text-dark)", fontSize: 13 }}>Notificaciones por email</div>
          <div style={{ fontSize: 11, color: "var(--text-muted-d)" }}>Resumen semanal + recordatorios de cierre</div>
        </div>
        <button
          type="button"
          className={email ? "toggle-switch on" : "toggle-switch off"}
          onClick={toggleEmail}
          aria-pressed={email}
          aria-label="Notificaciones por email"
        >
          <div className="toggle-thumb"></div>
        </button>
      </div>
      <div className="cuenta-toggle-row">
        <div>
          <div style={{ fontWeight: 700, color: "var(--text-dark)", fontSize: 13 }}>Notificaciones push</div>
          <div style={{ fontSize: 11, color: "var(--text-muted-d)" }}>Cambios de cuotas y resultados de mis combinadas</div>
        </div>
        <button
          type="button"
          className={push ? "toggle-switch on" : "toggle-switch off"}
          onClick={togglePush}
          aria-pressed={push}
          aria-label="Notificaciones push"
        >
          <div className="toggle-thumb"></div>
        </button>
      </div>
    </>
  );
}
