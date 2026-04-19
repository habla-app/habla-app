"use client";
// ComboLauncher — botón que dispara el ComboModal con lazy-load del
// estado del torneo. Si el usuario no tiene sesión, lleva al login con
// callbackUrl al punto de entrada. Sub-Sprint 4.
//
// Usado desde:
//   - MatchCard (/matches)
//   - /torneo/:id
//   - /mis-combinadas (botón "+ Otra combinada")
//   - /live-match (si el torneo sigue abierto)

import { useCallback, useState } from "react";
import Link from "next/link";
import { ComboModal, type ComboTorneoInfo } from "./ComboModal";
import { DISTRIB_PREMIOS_FE } from "./premios";

interface ComboLauncherProps {
  torneoId: string;
  hasSession: boolean;
  /** URL a la que volver tras login si no hay sesión. */
  callbackUrl: string;
  /** Etiqueta del botón. */
  label?: string;
  /** Override de className del botón. */
  className?: string;
  /** Styling variant. */
  variant?: "primary" | "ghost" | "urgent";
  /** Si true, renderiza como Link (todo el elemento clickable). Cuando
   *  false, el botón delega la apertura del modal al padre via onOpenChange. */
  asButton?: boolean;
  /** Callback tras crear el ticket exitosamente. */
  onCreated?: (result: { ticketId: string; nuevoBalance: number }) => void;
}

export function ComboLauncher({
  torneoId,
  hasSession,
  callbackUrl,
  label = "🎯 Crear combinada",
  className,
  variant = "primary",
  onCreated,
}: ComboLauncherProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [torneoInfo, setTorneoInfo] = useState<ComboTorneoInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/torneos/${torneoId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("No se pudo cargar el torneo.");
        setLoading(false);
        return;
      }
      const json = (await res.json()) as {
        data?: {
          torneo: {
            id: string;
            nombre: string;
            entradaLukas: number;
            pozoBruto: number;
            pozoNeto: number;
            cierreAt: string;
            partido: { equipoLocal: string; equipoVisita: string };
          };
          miTicket: { id: string } | null;
        };
      };
      const d = json.data;
      if (!d) {
        setError("Torneo no encontrado.");
        setLoading(false);
        return;
      }
      const pozoNeto =
        d.torneo.pozoNeto > 0
          ? d.torneo.pozoNeto
          : Math.floor(d.torneo.pozoBruto * 0.88);
      const info: ComboTorneoInfo = {
        torneoId: d.torneo.id,
        partidoNombre: `${d.torneo.partido.equipoLocal} vs ${d.torneo.partido.equipoVisita}`,
        equipoLocal: d.torneo.partido.equipoLocal,
        equipoVisita: d.torneo.partido.equipoVisita,
        entradaLukas: d.torneo.entradaLukas,
        pozoBruto: d.torneo.pozoBruto,
        primerPremioEstimado: Math.floor(
          pozoNeto * DISTRIB_PREMIOS_FE.primero,
        ),
        cierreAt: d.torneo.cierreAt,
        tienePlaceholder: d.miTicket !== null,
      };
      setTorneoInfo(info);
      setOpen(true);
      setLoading(false);
    } catch {
      setError("Error de red.");
      setLoading(false);
    }
  }, [torneoId]);

  if (!hasSession) {
    return (
      <Link
        href={`/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
        className={buttonCls(variant, className)}
      >
        {label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={buttonCls(variant, className)}
      >
        {loading ? "Cargando..." : label}
      </button>
      {error && (
        <p className="mt-1 text-[11px] font-semibold text-danger">{error}</p>
      )}
      <ComboModal
        isOpen={open}
        onClose={() => setOpen(false)}
        torneo={torneoInfo}
        onCreated={onCreated}
      />
    </>
  );
}

function buttonCls(variant: string, extra?: string): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-6 py-4 font-display text-[15px] font-extrabold uppercase tracking-[0.04em] transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-70";
  const variants: Record<string, string> = {
    primary:
      "bg-brand-gold text-black shadow-gold-cta hover:-translate-y-px hover:bg-brand-gold-light hover:shadow-gold",
    urgent:
      "bg-urgent-critical text-white shadow-urgent-btn hover:-translate-y-px hover:bg-urgent-critical-hover",
    ghost:
      "border-[1.5px] border-strong bg-transparent text-body hover:border-brand-blue-main hover:text-brand-blue-main",
  };
  return [base, variants[variant] ?? variants.primary, extra]
    .filter(Boolean)
    .join(" ");
}
