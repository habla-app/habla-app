// PreferenciasPanel — 7 toggles con debounce 500ms. Sub-Sprint 7.
"use client";

import { useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { PreferenciasNotificaciones } from "@/lib/services/notificaciones.service";

interface PreferenciasPanelProps {
  inicial: PreferenciasNotificaciones;
}

const LABELS: Array<{
  key: keyof Omit<PreferenciasNotificaciones, "usuarioId">;
  icono: string;
  titulo: string;
  descripcion: string;
}> = [
  {
    key: "notifInicioTorneo",
    icono: "🏁",
    titulo: "Inicio de torneos",
    descripcion: "Avisos cuando un torneo al que estás inscrito arranca.",
  },
  {
    key: "notifResultados",
    icono: "🎯",
    titulo: "Resultados y puntuación",
    descripcion: "Resultados de tus combinadas al finalizar partidos.",
  },
  {
    key: "notifPremios",
    icono: "🏆",
    titulo: "Premios ganados",
    descripcion: "Emails cuando ganás Lukas en un torneo.",
  },
  {
    key: "notifSugerencias",
    icono: "💡",
    titulo: "Sugerencias de torneos",
    descripcion: "Torneos destacados que pueden interesarte.",
  },
  {
    key: "notifCierreTorneo",
    icono: "⏰",
    titulo: "Cierre próximo",
    descripcion: "Recordatorio 30min antes del cierre de un torneo sin tu ticket.",
  },
  {
    key: "notifPromos",
    icono: "🎁",
    titulo: "Novedades y promos",
    descripcion: "Descuentos, nuevos premios, eventos especiales.",
  },
  {
    key: "emailSemanal",
    icono: "📬",
    titulo: "Resumen semanal",
    descripcion: "Tus stats de la semana cada lunes.",
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

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <section className="rounded-md border border-light bg-card p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[16px] font-extrabold uppercase tracking-[0.06em] text-dark">
          Notificaciones
        </h2>
        {guardando && (
          <span className="text-[11px] text-muted-d">Guardando...</span>
        )}
      </div>
      <div className="mt-4 divide-y divide-border-light">
        {LABELS.map((item) => (
          <ToggleRow
            key={item.key}
            icono={item.icono}
            titulo={item.titulo}
            descripcion={item.descripcion}
            value={prefs[item.key]}
            onToggle={() => toggle(item.key)}
            testId={`pref-${item.key}`}
          />
        ))}
      </div>
    </section>
  );
}

function ToggleRow({
  icono,
  titulo,
  descripcion,
  value,
  onToggle,
  testId,
}: {
  icono: string;
  titulo: string;
  descripcion: string;
  value: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="text-xl" aria-hidden>
        {icono}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-dark">{titulo}</div>
        <div className="text-[12px] text-muted-d">{descripcion}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={onToggle}
        data-testid={testId}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          value ? "bg-brand-green" : "bg-subtle"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
