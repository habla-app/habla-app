"use client";
// JuegoResponsableSection — límite mensual compra + diario tickets +
// auto-exclusión (7/30/90 días). Mockup `.limit-row` + `.limit-progress`
// (línea 4107).

import { useState } from "react";
import { authedFetch } from "@/lib/api-client";
import type { LimitesUsuario } from "@/lib/services/limites.service";
import {
  LIMITE_MENSUAL_DEFAULT,
  LIMITE_MENSUAL_MAX,
} from "@/lib/config/economia";
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/Modal";
import { SectionShell, MenuItem } from "./SectionShell";

interface Props {
  inicial: LimitesUsuario;
}

const EXCLUSION_FECHA_FMT = new Intl.DateTimeFormat("es-PE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Lima",
});

export function JuegoResponsableSection({ inicial }: Props) {
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
    <SectionShell
      title="Juego responsable"
      subtitle="Controla tu gasto y tiempo de juego · Habla! promueve el juego responsable"
      icon="⚖️"
      iconTone="respon"
    >
      {excluido ? (
        <div className="mx-5 mt-4 rounded-sm border border-urgent-critical bg-urgent-critical-bg px-3 py-2 text-[13px] text-urgent-critical-hover">
          🚫 Tu cuenta está en auto-exclusión hasta{" "}
          <strong>
            {EXCLUSION_FECHA_FMT.format(new Date(limites.autoExclusionHasta!))}
          </strong>
          . Durante este período no podés inscribirte en torneos ni canjear.
        </div>
      ) : null}

      <LimitRow
        title="💳 Límite mensual de compra"
        valueLabel={mensual > 0 ? `S/ ${mensual} / mes` : "Sin límite"}
        desc={`Cantidad máxima que puedes gastar en Lukas por mes. Default S/ ${LIMITE_MENSUAL_DEFAULT}, máximo S/ ${LIMITE_MENSUAL_MAX}.`}
        usageText={`S/ ${limites.uso.comprasMesActual} usados este mes`}
        pct={porcMensual}
      >
        <input
          type="number"
          min={0}
          max={LIMITE_MENSUAL_MAX}
          value={mensual}
          onChange={(e) => setMensual(Number(e.target.value) || 0)}
          className="w-24 rounded-sm border border-light px-2.5 py-1 text-sm"
        />
        <span className="text-xs text-muted-d">
          S/ (0 = sin límite, máx {LIMITE_MENSUAL_MAX})
        </span>
      </LimitRow>

      <LimitRow
        title="🎫 Límite diario de tickets"
        valueLabel={diario > 0 ? `${diario} tickets / día` : "Sin límite"}
        desc="Máximo de combinadas que puedes enviar por día"
        usageText={`${limites.uso.ticketsUltimas24h} de ${diario || "∞"} usados hoy`}
        pct={porcDiario}
      >
        <input
          type="number"
          min={0}
          max={100}
          value={diario}
          onChange={(e) => setDiario(Number(e.target.value) || 0)}
          className="w-24 rounded-sm border border-light px-2.5 py-1 text-sm"
        />
        <span className="text-xs text-muted-d">tickets / 24h</span>
      </LimitRow>

      <div className="flex flex-wrap items-center gap-3 border-b border-light px-5 py-4 last:border-b-0">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="rounded-sm bg-brand-blue-main px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-blue-light disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar límites"}
        </button>
        {msg ? <span className="text-xs text-muted-d">{msg}</span> : null}
      </div>

      <MenuItem
        icon="🛑"
        label="Auto-exclusión temporal"
        sub="Bloquea tu cuenta por 7, 30 o 90 días"
        onClick={() => setOpenExc(true)}
        disabled={Boolean(excluido)}
      />
      <MenuItem
        icon="📞"
        label="Recursos y ayuda"
        sub="Si sientes que el juego te afecta, podemos ayudarte"
        href="https://www.juegoenexceso.com/"
      />

      {openExc ? (
        <AutoExclusionModal
          onClose={() => setOpenExc(false)}
          onSuccess={(nuevos) => {
            setLimites(nuevos);
            setOpenExc(false);
          }}
        />
      ) : null}
    </SectionShell>
  );
}

function LimitRow({
  title,
  valueLabel,
  desc,
  usageText,
  pct,
  children,
}: {
  title: string;
  valueLabel: string;
  desc: string;
  usageText: string;
  pct: number;
  children: React.ReactNode;
}) {
  const fillCls =
    pct >= 90
      ? "bg-urgent-critical"
      : pct >= 70
        ? "bg-urgent-high"
        : "bg-brand-green";
  return (
    <div className="border-b border-light px-5 py-4">
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-bold text-dark">{title}</div>
        <div className="text-sm font-semibold text-dark">{valueLabel}</div>
      </div>
      <div className="mb-2 text-xs text-muted-d">{desc}</div>
      <div className="mb-2 flex flex-wrap items-center gap-3">{children}</div>
      <div className="h-2 overflow-hidden rounded-full bg-subtle">
        <div
          className={`h-full transition-all ${fillCls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-muted-d">{usageText}</div>
    </div>
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
        <h2 className="font-display text-[22px] font-extrabold">
          🚫 Auto-exclusión
        </h2>
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
        {error ? (
          <div className="mt-3 rounded-md bg-pred-wrong-bg px-3 py-2 text-[13px] text-pred-wrong">
            {error}
          </div>
        ) : null}
      </ModalBody>
      <ModalFooter>
        <button
          type="button"
          onClick={activar}
          disabled={!dias || cargando}
          className="w-full rounded-md bg-urgent-critical px-4 py-3 font-bold text-white disabled:opacity-50"
        >
          {cargando
            ? "Activando..."
            : `Activar ${dias ? `por ${dias} días` : ""}`}
        </button>
      </ModalFooter>
    </Modal>
  );
}
