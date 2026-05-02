"use client";

// PicksPremiumView — vista 2 paneles + atajos de teclado. Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/picks-premium.spec.md.
//
// Layout: tabs de filtro arriba / cola izquierda 320px + detalle derecho.
// Atajos A/R/E/↑↓/Esc — supresión cuando hay input/textarea con focus.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { authedFetch } from "@/lib/api-client";
import { Button, useToast } from "@/components/ui";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/Modal";
import { KbdHint } from "@/components/ui/admin/KbdHint";
import { cn } from "@/lib/utils/cn";
import type {
  ContadoresColaPicks,
  FiltroEstadoPick,
  PickColaFila,
  PickDetalleAdmin,
  StatsEditor,
} from "@/lib/services/picks-premium-admin.service";
import { PickDetalleView } from "./PickDetalleView";

const TABS: ReadonlyArray<{ value: FiltroEstadoPick; label: string }> = [
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "APROBADO", label: "Aprobados" },
  { value: "RECHAZADO", label: "Rechazados" },
  { value: "TODOS", label: "Todos" },
];

interface Props {
  cola: PickColaFila[];
  pickActivo: PickDetalleAdmin | null;
  contadores: ContadoresColaPicks;
  statsEditor: StatsEditor;
  filtroEstado: FiltroEstadoPick;
  editorEmail: string;
}

export function PicksPremiumView({
  cola,
  pickActivo,
  contadores,
  filtroEstado,
  editorEmail,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [aprobando, setAprobando] = useState(false);
  const [rechazoOpen, setRechazoOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  const pickActivoId = pickActivo?.id ?? cola[0]?.id ?? null;
  const indiceActivo = pickActivoId
    ? cola.findIndex((c) => c.id === pickActivoId)
    : -1;

  const navegarA = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("id", id);
      router.push(`/admin/picks-premium?${params.toString()}`);
    },
    [router, searchParams],
  );

  const navegarRelativo = useCallback(
    (delta: number) => {
      if (cola.length === 0) return;
      const next = Math.max(
        0,
        Math.min(cola.length - 1, indiceActivo + delta),
      );
      navegarA(cola[next].id);
    },
    [cola, indiceActivo, navegarA],
  );

  const aprobar = useCallback(async () => {
    if (!pickActivo || pickActivo.aprobado || aprobando) return;
    setAprobando(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/picks-premium/${pickActivo.id}/aprobar`,
        { method: "POST", headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Falló la aprobación");
      }
      toast.show("✓ Pick aprobado y enviado al Channel");
      router.refresh();
    } catch (err) {
      toast.show(
        `Error: ${err instanceof Error ? err.message : "desconocido"}`,
      );
    } finally {
      setAprobando(false);
    }
  }, [pickActivo, aprobando, toast, router]);

  // Atajos de teclado. Supresión cuando hay input/textarea/select con focus.
  useEffect(() => {
    function isFormElement(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      return false;
    }

    function onKey(e: KeyboardEvent) {
      if (rechazoOpen || editorOpen) {
        if (e.key === "Escape") {
          if (rechazoOpen) setRechazoOpen(false);
          if (editorOpen) setEditorOpen(false);
        }
        return;
      }
      if (isFormElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "a") {
        e.preventDefault();
        void aprobar();
      } else if (key === "r") {
        e.preventDefault();
        if (pickActivo && !pickActivo.aprobado) setRechazoOpen(true);
      } else if (key === "e") {
        e.preventDefault();
        if (pickActivo && pickActivo.estado !== "RECHAZADO") setEditorOpen(true);
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        navegarRelativo(1);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        navegarRelativo(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aprobar, navegarRelativo, pickActivo, rechazoOpen, editorOpen]);

  return (
    <div className="flex flex-col gap-4">
      {/* Tabs de filtro */}
      <div className="flex items-center gap-1 border-b border-admin-table-border">
        {TABS.map((t) => {
          const active = t.value === filtroEstado;
          const count =
            t.value === "PENDIENTE"
              ? contadores.pendientes
              : t.value === "APROBADO"
                ? contadores.aprobados
                : t.value === "RECHAZADO"
                  ? contadores.rechazados
                  : null;
          return (
            <Link
              key={t.value}
              href={`/admin/picks-premium?estado=${t.value}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-b-2 px-3 py-2 text-admin-body font-bold transition-colors",
                active
                  ? "border-brand-gold text-dark"
                  : "border-transparent text-muted-d hover:text-dark",
              )}
            >
              {t.label}
              {count !== null && (
                <span
                  className={cn(
                    "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold",
                    active
                      ? "bg-brand-gold text-brand-blue-dark"
                      : "bg-subtle text-muted-d",
                  )}
                >
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* 2 paneles */}
      <div className="grid grid-cols-[320px_1fr] gap-4">
        <PicksColaSidebar cola={cola} pickActivoId={pickActivoId} navegarA={navegarA} />

        <div className="min-w-0">
          {pickActivo ? (
            <PickDetalleView
              pick={pickActivo}
              editorEmail={editorEmail}
              onAprobar={aprobar}
              onAbrirRechazo={() => setRechazoOpen(true)}
              onAbrirEditor={() => setEditorOpen(true)}
              aprobando={aprobando}
            />
          ) : (
            <ColaVaciaPlaceholder filtro={filtroEstado} />
          )}
        </div>
      </div>

      {pickActivo && (
        <PickRechazoModal
          isOpen={rechazoOpen}
          onClose={() => setRechazoOpen(false)}
          pickId={pickActivo.id}
          onRechazado={() => {
            setRechazoOpen(false);
            toast.show("Pick rechazado");
            router.refresh();
          }}
        />
      )}

      {pickActivo && (
        <PickEditModal
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          pick={pickActivo}
          onGuardado={() => {
            setEditorOpen(false);
            toast.show("Pick editado y aprobado · enviando al Channel");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cola izquierda
// ---------------------------------------------------------------------------

function PicksColaSidebar({
  cola,
  pickActivoId,
  navegarA,
}: {
  cola: PickColaFila[];
  pickActivoId: string | null;
  navegarA: (id: string) => void;
}) {
  if (cola.length === 0) {
    return (
      <aside className="rounded-md border border-admin-table-border bg-admin-card-bg p-4 text-admin-meta text-muted-d">
        Cola vacía. Próxima generación: cron cada 4h.
      </aside>
    );
  }
  return (
    <aside className="overflow-hidden rounded-md border border-admin-table-border bg-admin-card-bg">
      <ul className="max-h-[calc(100vh-220px)] overflow-y-auto">
        {cola.map((p) => {
          const active = p.id === pickActivoId;
          const tiempoGen = formatHaceCuanto(p.generadoEn);
          return (
            <li
              key={p.id}
              className={cn(
                "border-b border-admin-table-border last:border-b-0",
                active && "bg-subtle",
              )}
            >
              <button
                type="button"
                onClick={() => navegarA(p.id)}
                className={cn(
                  "relative w-full px-3 py-3 text-left transition-colors hover:bg-admin-table-row-hover",
                  active && "bg-subtle",
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-[3px] bg-brand-gold"
                  />
                )}
                <div className="flex items-center justify-between gap-2 text-admin-meta text-muted-d">
                  <span>{tiempoGen}</span>
                  <EstadoBadge estado={p.estado} resultado={p.resultadoFinal} />
                </div>
                <div className="mt-1 text-admin-body text-dark line-clamp-1">
                  {p.equipoLocal} vs {p.equipoVisita}
                </div>
                <div className="mt-0.5 text-admin-meta text-muted-d line-clamp-1">
                  {labelMercado(p.mercado, p.outcome)} @ {p.cuotaSugerida.toFixed(2)}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

function EstadoBadge({
  estado,
  resultado,
}: {
  estado: string;
  resultado: string | null;
}) {
  if (resultado === "GANADO") {
    return (
      <span className="rounded-sm bg-status-green-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-green-text">
        GANÓ
      </span>
    );
  }
  if (resultado === "PERDIDO") {
    return (
      <span className="rounded-sm bg-status-red-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-red-text">
        PERDIÓ
      </span>
    );
  }
  if (estado === "PENDIENTE") {
    return (
      <span className="rounded-sm bg-status-amber-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-amber-text">
        PEN
      </span>
    );
  }
  if (estado === "APROBADO" || estado === "EDITADO_Y_APROBADO") {
    return (
      <span className="rounded-sm bg-status-green-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-green-text">
        APR
      </span>
    );
  }
  if (estado === "RECHAZADO") {
    return (
      <span className="rounded-sm bg-status-neutral-bg px-1.5 py-0.5 text-[10px] font-bold uppercase text-status-neutral-text">
        RCH
      </span>
    );
  }
  return null;
}

function ColaVaciaPlaceholder({ filtro }: { filtro: FiltroEstadoPick }) {
  return (
    <div className="flex h-[calc(100vh-260px)] flex-col items-center justify-center rounded-md border border-dashed border-admin-table-border bg-admin-card-bg p-10 text-center">
      <span aria-hidden className="mb-3 text-[40px]">
        ✓
      </span>
      <div className="text-admin-card-title text-dark">
        {filtro === "PENDIENTE"
          ? "Todo al día"
          : "Sin picks que coincidan con el filtro"}
      </div>
      {filtro === "PENDIENTE" && (
        <p className="mt-2 text-admin-body text-muted-d">
          Próxima generación: cron cada 4h.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modales
// ---------------------------------------------------------------------------

function PickRechazoModal({
  isOpen,
  onClose,
  pickId,
  onRechazado,
}: {
  isOpen: boolean;
  onClose: () => void;
  pickId: string;
  onRechazado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMotivo("");
      // Focus al abrir, pequeño delay para que el modal monte
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  async function confirmar() {
    const motivoTrimmed = motivo.trim();
    if (motivoTrimmed.length < 1) return;
    setEnviando(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/picks-premium/${pickId}/rechazar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivoTrimmed }),
        },
      );
      if (!res.ok) throw new Error("Falló el rechazo");
      onRechazado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Rechazar pick">
      <ModalHeader onClose={onClose} eyebrow="Picks Premium">
        <h2 className="font-display text-[22px] font-extrabold text-white">
          Rechazar pick
        </h2>
      </ModalHeader>
      <ModalBody>
        <label className="block text-admin-body text-dark" htmlFor="motivo-rechazo">
          Motivo del rechazo <span className="text-status-red">*</span>
        </label>
        <textarea
          id="motivo-rechazo"
          ref={textareaRef}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
          rows={5}
          className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark focus:border-brand-blue-main focus:outline-none"
          placeholder="Ej: cuota fuera de rango razonable, razonamiento débil, factor clave incorrecto…"
        />
        <p className="mt-1 text-admin-meta text-muted-d">{motivo.length}/500</p>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={confirmar}
            disabled={enviando || motivo.trim().length < 1}
          >
            {enviando ? "Enviando…" : "Confirmar rechazo"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

function PickEditModal({
  isOpen,
  onClose,
  pick,
  onGuardado,
}: {
  isOpen: boolean;
  onClose: () => void;
  pick: PickDetalleAdmin;
  onGuardado: () => void;
}) {
  const [razonamiento, setRazonamiento] = useState(pick.razonamiento);
  const [stake, setStake] = useState(pick.stakeSugerido);
  const [cuota, setCuota] = useState(pick.cuotaSugerida);
  const [evPct, setEvPct] = useState<number | null>(pick.evPctSugerido);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRazonamiento(pick.razonamiento);
      setStake(pick.stakeSugerido);
      setCuota(pick.cuotaSugerida);
      setEvPct(pick.evPctSugerido);
    }
  }, [isOpen, pick]);

  async function guardarYAprobar() {
    setEnviando(true);
    try {
      const body: Record<string, unknown> = {
        razonamiento,
        stakeSugerido: stake,
        cuotaSugerida: cuota,
        evPctSugerido: evPct,
        aprobar: true,
      };
      const res = await authedFetch(`/api/v1/admin/picks-premium/${pick.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Falló la edición");
      }
      onGuardado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Editar pick" maxWidth="720px">
      <ModalHeader onClose={onClose} eyebrow="Picks Premium">
        <h2 className="font-display text-[22px] font-extrabold text-white">
          Editar pick
        </h2>
      </ModalHeader>
      <ModalBody>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="ed-razonamiento"
              className="block text-admin-body text-dark"
            >
              Razonamiento estadístico
            </label>
            <textarea
              id="ed-razonamiento"
              value={razonamiento}
              onChange={(e) => setRazonamiento(e.target.value.slice(0, 4000))}
              rows={8}
              className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark focus:border-brand-blue-main focus:outline-none"
            />
            <p className="mt-1 text-admin-meta text-muted-d">
              {razonamiento.length}/4000
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="ed-cuota" className="block text-admin-body text-dark">
                Cuota
              </label>
              <input
                id="ed-cuota"
                type="number"
                step="0.01"
                value={cuota}
                onChange={(e) => setCuota(Number(e.target.value))}
                className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark tabular-nums focus:border-brand-blue-main focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="ed-stake" className="block text-admin-body text-dark">
                Stake (%)
              </label>
              <input
                id="ed-stake"
                type="number"
                step="0.005"
                value={stake}
                onChange={(e) => setStake(Number(e.target.value))}
                className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark tabular-nums focus:border-brand-blue-main focus:outline-none"
              />
              <p className="mt-1 text-admin-meta text-muted-d">
                {(stake * 100).toFixed(1)}% del bankroll
              </p>
            </div>
            <div>
              <label htmlFor="ed-ev" className="block text-admin-body text-dark">
                EV+ (%)
              </label>
              <input
                id="ed-ev"
                type="number"
                step="0.01"
                value={evPct ?? ""}
                onChange={(e) =>
                  setEvPct(e.target.value === "" ? null : Number(e.target.value))
                }
                className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark tabular-nums focus:border-brand-blue-main focus:outline-none"
              />
              <p className="mt-1 text-admin-meta text-muted-d">
                {evPct !== null ? `${(evPct * 100).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={guardarYAprobar}
            disabled={enviando || razonamiento.trim().length < 20}
          >
            {enviando ? "Guardando…" : "Guardar y aprobar"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHaceCuanto(d: Date): string {
  const ms = Date.now() - d.getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h}h`;
  const dias = Math.round(h / 24);
  return `hace ${dias}d`;
}

const MERCADO_LABEL: Record<string, (o: string) => string> = {
  RESULTADO_1X2: (o) =>
    o === "home"
      ? "Gana local"
      : o === "draw"
        ? "Empate"
        : o === "away"
          ? "Gana visitante"
          : `1X2: ${o}`,
  BTTS: (o) => (o === "btts_si" ? "BTTS Sí" : o === "btts_no" ? "BTTS No" : `BTTS: ${o}`),
  OVER_UNDER_25: (o) =>
    o === "over"
      ? "Más de 2.5"
      : o === "under"
        ? "Menos de 2.5"
        : `2.5: ${o}`,
  TARJETA_ROJA: (o) =>
    o === "roja_si" ? "Roja sí" : o === "roja_no" ? "Roja no" : `Roja: ${o}`,
  MARCADOR_EXACTO: (o) => `Marcador: ${o}`,
};

function labelMercado(mercado: string, outcome: string): string {
  const fn = MERCADO_LABEL[mercado];
  return fn ? fn(outcome) : `${mercado}: ${outcome}`;
}

export { labelMercado };
