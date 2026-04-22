"use client";
// PreferenciasPanel — 7 toggles con debounce 500ms (mockup `.toggle-row`).
// Debounce debounce y estado idénticos a la versión anterior; lo que
// cambia es la envoltura visual (SectionShell + switch styling del mockup).

import { useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PreferenciasNotificaciones } from "@/lib/services/notificaciones.service";
import { SectionShell } from "./SectionShell";

interface PreferenciasPanelProps {
  inicial: PreferenciasNotificaciones;
}

const LABELS: Array<{
  key: keyof Omit<PreferenciasNotificaciones, "usuarioId">;
  titulo: string;
  descripcion: string;
}> = [
  {
    key: "notifInicioTorneo",
    titulo: "Inicio de tus torneos",
    descripcion: "Aviso cuando empiece un partido donde estás inscrito",
  },
  {
    key: "notifResultados",
    titulo: "Resultados de tus combinadas",
    descripcion: "Puntos actualizados en vivo y resultado final",
  },
  {
    key: "notifPremios",
    titulo: "Premios ganados 🏆",
    descripcion: "Cuando ganes un premio en un torneo",
  },
  {
    key: "notifSugerencias",
    titulo: "Sugerencias de torneos",
    descripcion: "Torneos de tus equipos o ligas favoritas",
  },
  {
    key: "notifCierreTorneo",
    titulo: "Cierre de torneos ⏰",
    descripcion: "Recordatorio cuando un torneo de tus favoritos esté por cerrar",
  },
  {
    key: "notifPromos",
    titulo: "Novedades y promociones",
    descripcion: "Nuevas ligas, premios destacados y promos",
  },
  {
    key: "emailSemanal",
    titulo: "Email semanal de resumen",
    descripcion: "Tu balance, mejores partidos y estadísticas cada domingo",
  },
];

export function PreferenciasPanel({ inicial }: PreferenciasPanelProps) {
  const [prefs, setPrefs] = useState(inicial);
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

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return (
    <SectionShell
      title="Notificaciones"
      subtitle="Elige qué avisos quieres recibir"
      icon="🔔"
      iconTone="notif"
      badge={guardando ? "Guardando…" : undefined}
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
