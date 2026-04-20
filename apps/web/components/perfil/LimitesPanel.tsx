// LimitesPanel — juego responsable: límite mensual compra + diario tickets
// + auto-exclusión (7/30/90 días).
"use client";

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { LimitesUsuario } from "@/lib/services/limites.service";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/components/ui/Modal";

interface LimitesPanelProps {
  inicial: LimitesUsuario;
}

export function LimitesPanel({ inicial }: LimitesPanelProps) {
  const [limites, setLimites] = useState(inicial);
  const [mensual, setMensual] = useState(inicial.limiteMensualCompra);
  const [diario, setDiario] = useState(inicial.limiteDiarioTickets);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [openExc, setOpenExc] = useState(false);

  const excluido =
    limites.autoExclusionHasta &&
    new Date(limites.autoExclusionHasta).getTime() > Date.now();

  async function guardar() {
    setGuardando(true);
    setMsg("");
    try {
      const resp = await authedFetch("/api/v1/usuarios/limites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          limiteMensualCompra: mensual,
          limiteDiarioTickets: diario,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setMsg(json?.error?.message ?? "No se pudo guardar.");
        return;
      }
      setLimites(json.data);
      setMsg("Límites guardados.");
    } finally {
      setGuardando(false);
    }
  }

  const porcMensual = Math.min(
    100,
    mensual > 0 ? Math.round((limites.uso.comprasMesActual / mensual) * 100) : 0,
  );
  const porcDiario = Math.min(
    100,
    diario > 0 ? Math.round((limites.uso.ticketsUltimas24h / diario) * 100) : 0,
  );

  return (
    <section className="rounded-md border border-light bg-card p-5 shadow-sm">
      <h2 className="font-display text-[16px] font-extrabold uppercase tracking-[0.06em] text-dark">
        Juego responsable
      </h2>
      <p className="mt-1 text-[13px] text-muted-d">
        Poné tus propios límites. Los respetamos de forma automática.
      </p>

      {excluido && (
        <div className="mt-3 rounded-md border border-urgent-critical bg-urgent-critical-bg px-3 py-2 text-[13px] text-urgent-critical-hover">
          🚫 Tu cuenta está en auto-exclusión hasta{" "}
          <strong>
            {new Date(limites.autoExclusionHasta!).toLocaleDateString("es-PE", {
              timeZone: "America/Lima",
            })}
          </strong>
          . Durante este período no podés inscribirte en torneos ni canjear.
        </div>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-[13px] font-bold text-dark">
            Límite mensual de compra
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={10000}
              value={mensual}
              onChange={(e) => setMensual(Number(e.target.value) || 0)}
              className="w-28 rounded-md border border-light px-3 py-2 text-[14px]"
            />
            <span className="text-[13px] text-muted-d">S/ por mes (0 = sin límite)</span>
          </div>
          <div className="mt-2 text-[12px] text-muted-d">
            Llevas este mes: <strong>S/ {limites.uso.comprasMesActual}</strong>
          </div>
          {mensual > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle">
              <div
                className={`h-full transition-all ${
                  porcMensual >= 90
                    ? "bg-urgent-critical"
                    : porcMensual >= 70
                      ? "bg-urgent-high"
                      : "bg-brand-green"
                }`}
                style={{ width: `${porcMensual}%` }}
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-[13px] font-bold text-dark">
            Límite diario de tickets
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={100}
              value={diario}
              onChange={(e) => setDiario(Number(e.target.value) || 0)}
              className="w-28 rounded-md border border-light px-3 py-2 text-[14px]"
            />
            <span className="text-[13px] text-muted-d">
              tickets / 24h (0 = sin límite)
            </span>
          </div>
          <div className="mt-2 text-[12px] text-muted-d">
            Llevas hoy: <strong>{limites.uso.ticketsUltimas24h}</strong>
          </div>
          {diario > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-subtle">
              <div
                className={`h-full transition-all ${
                  porcDiario >= 90
                    ? "bg-urgent-critical"
                    : porcDiario >= 70
                      ? "bg-urgent-high"
                      : "bg-brand-green"
                }`}
                style={{ width: `${porcDiario}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={guardar}
            disabled={guardando}
            className="rounded-md bg-brand-blue-main px-5 py-2.5 font-bold text-white disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar límites"}
          </button>
          {msg && <span className="text-[12px] text-muted-d">{msg}</span>}
        </div>

        <div className="mt-4 rounded-md border border-light bg-subtle p-4">
          <h3 className="font-display text-[14px] font-bold text-dark">
            Auto-exclusión temporal
          </h3>
          <p className="mt-1 text-[12px] text-muted-d">
            Bloquea tu cuenta de inscripciones y canjes por 7, 30 o 90 días.
            No se puede revertir antes del vencimiento.
          </p>
          <button
            type="button"
            onClick={() => setOpenExc(true)}
            disabled={Boolean(excluido)}
            className="mt-3 rounded-md border border-urgent-critical px-4 py-2 text-[13px] font-bold text-urgent-critical hover:bg-urgent-critical hover:text-white disabled:opacity-50"
          >
            {excluido ? "Auto-exclusión activa" : "Activar auto-exclusión"}
          </button>
        </div>
      </div>

      {openExc && (
        <AutoExclusionModal
          onClose={() => setOpenExc(false)}
          onSuccess={(nuevos) => {
            setLimites(nuevos);
            setOpenExc(false);
          }}
        />
      )}
    </section>
  );
}

function AutoExclusionModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (l: LimitesUsuario) => void;
}) {
  const [dias, setDias] = useState<7 | 30 | 90 | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function activar() {
    if (!dias) return;
    setCargando(true);
    setError("");
    try {
      const resp = await authedFetch(
        "/api/v1/usuarios/limites/autoexclusion",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dias }),
        },
      );
      const json = await resp.json();
      if (!resp.ok) {
        setError(json?.error?.message ?? "No se pudo activar.");
        return;
      }
      onSuccess(json.data);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} label="Auto-exclusión" maxWidth="440px">
      <ModalHeader onClose={onClose} eyebrow="Juego responsable">
        <h2 className="font-display text-[22px] font-extrabold">🚫 Auto-exclusión</h2>
      </ModalHeader>
      <ModalBody>
        <p className="text-[14px] text-body">
          Elegí cuánto tiempo querés bloquear tu cuenta. Una vez confirmado, no
          podrás revertirlo antes del vencimiento.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDias(d as 7 | 30 | 90)}
              className={`rounded-md border px-3 py-3 text-center ${
                dias === d
                  ? "border-urgent-critical bg-urgent-critical-bg text-urgent-critical-hover"
                  : "border-light hover:bg-hover"
              }`}
            >
              <div className="font-display text-[20px] font-extrabold">{d}</div>
              <div className="text-[11px] text-muted-d">días</div>
            </button>
          ))}
        </div>
        {error && (
          <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
            {error}
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={activar}
          disabled={!dias || cargando}
          className="w-full rounded-md bg-urgent-critical px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          {cargando ? "Activando..." : `Activar ${dias ? `por ${dias} días` : ""}`}
        </button>
      </ModalFooter>
    </Modal>
  );
}
