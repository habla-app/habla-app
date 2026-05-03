"use client";

// UserMenu — Lote S v3.2 · portación literal del avatar dropdown del mockup
// (docs/habla-mockup-v3.2.html líneas 2149-2202).
//
// Estructura:
//   .avatar-wrap > .avatar-mini.avatar-trigger (botón circular dorado)
//                > .avatar-dropdown.open (panel flotante con header + stats + items)
//
// Las clases CSS son las del mockup (definidas en mockup-styles.css por el
// Lote R). Cero Tailwind utility en este componente.
//
// Estados de auth manejados via <AuthGate>:
//   - badge "💎 Socio"     → socios-only
//   - badge "Free"          → solo free (state="free")
//   - item "Mi hub Socios"  → socios-only
//   - item "Hacerme Socio"  → free-only (state="free")
//
// Lógica preservada de la versión previa:
//   - Click fuera y ESC cierran el dropdown.
//   - Cerrar sesión: signOut con redirect:false + hard reload (mini-lote 7.6).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AuthGate } from "@/components/auth/AuthGate";

interface UserMenuProps {
  iniciales: string;
  username: string;
  usernameLocked: boolean;
  email: string;
  /** Posición mensual (#N mes). Si no se pasa, no se muestra el badge. */
  posicionMes?: number;
  /** Stats del mes (puntos / acierto% / # predicciones). Defaults a "—". */
  puntosMes?: number | string;
  porcAciertoMes?: number | string;
  prediccionesMes?: number | string;
  /** Notificaciones no leídas (default 0, oculto si 0). */
  notificaciones?: number;
}

export function UserMenu({
  iniciales,
  username,
  usernameLocked,
  email,
  posicionMes,
  puntosMes = "—",
  porcAciertoMes = "—",
  prediccionesMes = "—",
  notificaciones = 0,
}: UserMenuProps) {
  const [abierto, setAbierto] = useState(false);
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  async function cerrarSesion() {
    if (cerrandoSesion) return;
    setCerrandoSesion(true);
    try {
      await signOut({ redirect: false, callbackUrl: "/" });
    } catch {
      // Mini-lote 7.6: signOut con redirect:false no rechaza, pero por si
      // NextAuth tira un edge, igual hacemos hard reload abajo.
    }
    window.location.href = "/";
  }

  useEffect(() => {
    if (!abierto) return;
    function cerrarAlClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", cerrarAlClickFuera);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", cerrarAlClickFuera);
      document.removeEventListener("keydown", onEsc);
    };
  }, [abierto]);

  const handleLabel = usernameLocked && username ? `@${username}` : "@nuevo_usuario";

  return (
    <div ref={ref} className="avatar-wrap" style={{ position: "relative" }}>
      <button
        type="button"
        className="avatar-mini avatar-trigger"
        aria-label="Menú de usuario"
        aria-expanded={abierto}
        aria-haspopup="menu"
        onClick={() => setAbierto((v) => !v)}
      >
        <span>{iniciales}</span>
      </button>

      <div
        className={abierto ? "avatar-dropdown open" : "avatar-dropdown"}
        role="menu"
      >
        <div className="avatar-dd-header">
          <div className="avatar-dd-avatar">{iniciales}</div>
          <div>
            <div className="avatar-dd-name">
              {usernameLocked && username ? (
                handleLabel
              ) : (
                <Link
                  href="/auth/completar-perfil"
                  onClick={() => setAbierto(false)}
                  style={{ color: "inherit" }}
                >
                  Elegí tu @handle →
                </Link>
              )}
            </div>
            <div className="avatar-dd-email">{email}</div>
            <div className="avatar-dd-badges">
              <AuthGate state="socios">
                <span className="badge badge-gold">💎 Socio</span>
              </AuthGate>
              <AuthGate state="free">
                <span className="badge badge-blue">Free</span>
              </AuthGate>
              {posicionMes !== undefined && (
                <span className="badge badge-blue">#{posicionMes} mes</span>
              )}
            </div>
          </div>
        </div>

        <div className="avatar-dd-stats">
          <div className="avatar-dd-stat">
            <div className="avatar-dd-stat-val">{puntosMes}</div>
            <div className="avatar-dd-stat-lbl">Pts mes</div>
          </div>
          <div className="avatar-dd-stat">
            <div className="avatar-dd-stat-val">{porcAciertoMes}</div>
            <div className="avatar-dd-stat-lbl">Acierto</div>
          </div>
          <div className="avatar-dd-stat">
            <div className="avatar-dd-stat-val">{prediccionesMes}</div>
            <div className="avatar-dd-stat-lbl">Predicc.</div>
          </div>
        </div>

        <div className="avatar-dd-divider"></div>

        <Link
          className="avatar-dd-item"
          href="/perfil"
          onClick={() => setAbierto(false)}
          role="menuitem"
        >
          <span>👤</span> Mi perfil y cuenta
        </Link>

        <AuthGate state="socios">
          <Link
            className="avatar-dd-item"
            href="/socios-hub"
            onClick={() => setAbierto(false)}
            role="menuitem"
          >
            <span>💎</span> Mi hub Socios
          </Link>
        </AuthGate>

        <AuthGate state="free">
          <Link
            className="avatar-dd-item"
            href="/socios"
            onClick={() => setAbierto(false)}
            role="menuitem"
          >
            <span>💎</span> Hacerme Socio
          </Link>
        </AuthGate>

        <Link
          className="avatar-dd-item"
          href="/perfil#notificaciones"
          onClick={() => setAbierto(false)}
          role="menuitem"
        >
          <span>📨</span> Notificaciones
          {notificaciones > 0 && (
            <span className="avatar-dd-counter">{notificaciones}</span>
          )}
        </Link>

        <div className="avatar-dd-divider"></div>

        <Link
          className="avatar-dd-item"
          href="/ayuda/faq"
          onClick={() => setAbierto(false)}
          role="menuitem"
        >
          <span>📚</span> Centro de ayuda
        </Link>

        <button
          type="button"
          className="avatar-dd-item avatar-dd-signout"
          role="menuitem"
          disabled={cerrandoSesion}
          onClick={() => {
            setAbierto(false);
            void cerrarSesion();
          }}
        >
          <span>↪</span> {cerrandoSesion ? "Cerrando sesión…" : "Cerrar sesión"}
        </button>
      </div>
    </div>
  );
}
