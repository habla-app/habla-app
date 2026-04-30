"use client";
// NotificacionesSection — toggles del perfil. Lote 11 (May 2026).
//
// Simplificado a 4 notificaciones + 1 toggle de privacidad ("Perfil
// público"). El resto de los toggles legacy (sugerencias, cierre de
// torneo) ya no se exponen en UI — el schema los conserva por
// compatibilidad pero ningún caller los usa post-Lote 11. Default opt-in
// se mantiene por schema; el día que un usuario los reactive vía API
// directa, igual recibirá los avisos.
//
// El toggle "Perfil público" controla `Usuario.perfilPublico` (Lote 11
// migration). Cuando está off, /comunidad/[username] muestra "perfil
// privado" (no expone stats ni historial de predicciones).

import { useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PreferenciasNotificaciones } from "@/lib/services/notificaciones.service";
import { SectionShell } from "./SectionShell";

interface Props {
  inicial: PreferenciasNotificaciones;
  /** Lote 11 — valor inicial de `Usuario.perfilPublico`. */
  perfilPublicoInicial: boolean;
}

const LABELS: Array<{
  key: keyof Omit<PreferenciasNotificaciones, "usuarioId">;
  titulo: string;
  descripcion: string;
}> = [
  {
    key: "notifInicioTorneo",
    titulo: "Inicio de tus predicciones",
    descripcion: "Aviso cuando empiece un partido donde estás inscrito",
  },
  {
    key: "notifResultados",
    titulo: "Resultados de tus combinadas",
    descripcion: "Puntos finales y posición en el ranking del torneo",
  },
  {
    key: "notifSemanal",
    titulo: "Resumen semanal por email",
    descripcion: "Top tipsters, mejores cuotas y artículos cada sábado",
  },
  {
    key: "notifPromos",
    titulo: "Novedades y promociones",
    descripcion: "Nuevas ligas, premios destacados y promos",
  },
];

export function NotificacionesSection({
  inicial,
  perfilPublicoInicial,
}: Props) {
  const [prefs, setPrefs] = useState(inicial);
  const [perfilPublico, setPerfilPublico] = useState(perfilPublicoInicial);
  const [guardando, setGuardando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function toggle(key: keyof Omit<PreferenciasNotificaciones, "usuarioId">) {
    const nuevo = { ...prefs, [key]: !prefs[key] };
    setPrefs(nuevo);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGuardando(true);
      try {
        await authedFetch("/api/v1/usuarios/notificaciones", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: nuevo[key] }),
        });
      } finally {
        setGuardando(false);
      }
    }, 500);
  }

  function togglePerfilPublico() {
    const nuevo = !perfilPublico;
    setPerfilPublico(nuevo);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGuardando(true);
      try {
        await authedFetch("/api/v1/usuarios/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ perfilPublico: nuevo }),
        });
      } finally {
        setGuardando(false);
      }
    }, 500);
  }

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <SectionShell
      title="Notificaciones y privacidad"
      subtitle="Elige qué avisos recibir y quién puede ver tu perfil"
      icon="🔔"
      iconTone="notif"
      badge={guardando ? "Guardando…" : undefined}
      anchorId="notificaciones"
    >
      {LABELS.map((item) => (
        <ToggleRow
          key={item.key}
          titulo={item.titulo}
          descripcion={item.descripcion}
          value={prefs[item.key]}
          onToggle={() => toggle(item.key)}
          testId={`pref-${item.key}`}
        />
      ))}
      {/* Toggle de privacidad — Lote 11. */}
      <ToggleRow
        titulo="Perfil público"
        descripcion="Permitir que otros vean tu @handle, stats y predicciones finalizadas en /comunidad/{tu-handle}"
        value={perfilPublico}
        onToggle={togglePerfilPublico}
        testId="pref-perfilPublico"
      />
    </SectionShell>
  );
}

function ToggleRow({
  titulo,
  descripcion,
  value,
  onToggle,
  testId,
}: {
  titulo: string;
  descripcion: string;
  value: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-3.5 border-b border-light px-5 py-3.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-dark">{titulo}</div>
        <div className="text-xs leading-[1.4] text-muted-d">{descripcion}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={onToggle}
        data-testid={testId}
        className={`relative h-6 w-11 flex-shrink-0 rounded-full transition ${
          value ? "bg-brand-green" : "bg-border-strong"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition ${
            value ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
