"use client";
// Modal de edición manual de cuotas para una casa (Lote V.14.1).
//
// Permite al admin completar/corregir cuotas que el motor de captura no
// pudo extraer. Inputs por mercado (1X2, Doble Op, ±2.5, BTTS) con valores
// actuales pre-cargados. Solo se mandan los mercados que el admin tocó.
//
// Cero clases Tailwind utility — usa createPortal + estilos inline con
// tokens var(--*) (regla 10 + 30 del CLAUDE.md).

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { authedFetch } from "@/lib/api-client";

type CasaSlug =
  | "doradobet"
  | "apuesta_total"
  | "betano"
  | "inkabet"
  | "te_apuesto";

interface CuotasActuales {
  cuotaLocal: number | null;
  cuotaEmpate: number | null;
  cuotaVisita: number | null;
  cuota1X: number | null;
  cuota12: number | null;
  cuotaX2: number | null;
  cuotaOver25: number | null;
  cuotaUnder25: number | null;
  cuotaBttsSi: number | null;
  cuotaBttsNo: number | null;
}

interface Props {
  partidoId: string;
  casa: CasaSlug;
  casaLabel: string;
  cuotasActuales: CuotasActuales;
}

interface FormState {
  // 1X2
  local: string;
  empate: string;
  visita: string;
  // Doble Op
  x1: string;
  x12: string;
  xx2: string;
  // ±2.5
  over: string;
  under: string;
  // BTTS
  si: string;
  no: string;
}

function n(v: number | null): string {
  return v === null ? "" : String(v);
}

function parseNum(s: string): number | null {
  const v = parseFloat(s.replace(",", "."));
  return Number.isFinite(v) && v > 1 ? v : null;
}

export function EditarCuotasManualModal({
  partidoId,
  casa,
  casaLabel,
  cuotasActuales,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    local: n(cuotasActuales.cuotaLocal),
    empate: n(cuotasActuales.cuotaEmpate),
    visita: n(cuotasActuales.cuotaVisita),
    x1: n(cuotasActuales.cuota1X),
    x12: n(cuotasActuales.cuota12),
    xx2: n(cuotasActuales.cuotaX2),
    over: n(cuotasActuales.cuotaOver25),
    under: n(cuotasActuales.cuotaUnder25),
    si: n(cuotasActuales.cuotaBttsSi),
    no: n(cuotasActuales.cuotaBttsNo),
  });

  function abrir() {
    setForm({
      local: n(cuotasActuales.cuotaLocal),
      empate: n(cuotasActuales.cuotaEmpate),
      visita: n(cuotasActuales.cuotaVisita),
      x1: n(cuotasActuales.cuota1X),
      x12: n(cuotasActuales.cuota12),
      xx2: n(cuotasActuales.cuotaX2),
      over: n(cuotasActuales.cuotaOver25),
      under: n(cuotasActuales.cuotaUnder25),
      si: n(cuotasActuales.cuotaBttsSi),
      no: n(cuotasActuales.cuotaBttsNo),
    });
    setErrorMsg(null);
    setOpen(true);
  }
  function cerrar() {
    setOpen(false);
    setErrorMsg(null);
  }

  async function guardar() {
    setEnviando(true);
    setErrorMsg(null);
    const cuotas: Record<string, unknown> = {};

    const local = parseNum(form.local);
    const empate = parseNum(form.empate);
    const visita = parseNum(form.visita);
    if (local && empate && visita) {
      cuotas["1x2"] = { local, empate, visita };
    } else if (form.local || form.empate || form.visita) {
      setErrorMsg("Para guardar 1X2, necesitás los 3 valores (local + empate + visita).");
      setEnviando(false);
      return;
    }

    const x1 = parseNum(form.x1);
    const x12 = parseNum(form.x12);
    const xx2 = parseNum(form.xx2);
    if (x1 && x12 && xx2) {
      cuotas.doble_op = { x1, x12, xx2 };
    } else if (form.x1 || form.x12 || form.xx2) {
      setErrorMsg("Para guardar Doble Op, necesitás los 3 valores (1X + 12 + X2).");
      setEnviando(false);
      return;
    }

    const over = parseNum(form.over);
    const under = parseNum(form.under);
    if (over && under) {
      cuotas.mas_menos_25 = { over, under };
    } else if (form.over || form.under) {
      setErrorMsg("Para guardar ±2.5, necesitás los 2 valores (Más + Menos).");
      setEnviando(false);
      return;
    }

    const si = parseNum(form.si);
    const no = parseNum(form.no);
    if (si && no) {
      cuotas.btts = { si, no };
    } else if (form.si || form.no) {
      setErrorMsg("Para guardar BTTS, necesitás los 2 valores (Sí + No).");
      setEnviando(false);
      return;
    }

    if (Object.keys(cuotas).length === 0) {
      setErrorMsg("No hay cuotas válidas para guardar.");
      setEnviando(false);
      return;
    }

    try {
      const res = await authedFetch(
        `/api/v1/admin/partidos/${partidoId}/cuotas/manual`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ casa, cuotas }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message ?? `HTTP ${res.status}`);
      }
      cerrar();
      router.refresh();
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-ghost btn-xs"
        onClick={abrir}
        title={`Editar cuotas manualmente de ${casaLabel}`}
        style={{ whiteSpace: "nowrap", fontSize: 10, padding: "2px 6px" }}
      >
        ✏ manual
      </button>
    );
  }

  // Renderizado del modal vía portal
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) cerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "var(--bg-card, #fff)",
          borderRadius: 12,
          padding: 22,
          width: "92%",
          maxWidth: 540,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,.18)",
        }}
      >
        <h3
          style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18,
            fontWeight: 800,
            color: "var(--text-dark, #001050)",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Editar cuotas manualmente
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-muted-d, rgba(0,16,80,.58))", marginBottom: 16 }}>
          Casa: <strong>{casaLabel}</strong>. Editá solo los mercados que necesites
          completar; los vacíos quedan como están. Cada mercado pide TODOS sus
          valores (no parciales).
        </p>

        {/* 1X2 */}
        <fieldset style={{ border: "1px solid var(--border-soft, rgba(0,16,80,.08))", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <legend style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dark)", padding: "0 6px" }}>
            1X2 — Resultado del partido
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Input label="Local (1)" value={form.local} onChange={(v) => setForm({ ...form, local: v })} />
            <Input label="Empate (X)" value={form.empate} onChange={(v) => setForm({ ...form, empate: v })} />
            <Input label="Visita (2)" value={form.visita} onChange={(v) => setForm({ ...form, visita: v })} />
          </div>
        </fieldset>

        {/* Doble Op */}
        <fieldset style={{ border: "1px solid var(--border-soft, rgba(0,16,80,.08))", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <legend style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dark)", padding: "0 6px" }}>
            Doble Oportunidad
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Input label="1X" value={form.x1} onChange={(v) => setForm({ ...form, x1: v })} />
            <Input label="12" value={form.x12} onChange={(v) => setForm({ ...form, x12: v })} />
            <Input label="X2" value={form.xx2} onChange={(v) => setForm({ ...form, xx2: v })} />
          </div>
        </fieldset>

        {/* ±2.5 */}
        <fieldset style={{ border: "1px solid var(--border-soft, rgba(0,16,80,.08))", borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <legend style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dark)", padding: "0 6px" }}>
            ±2.5 Goles
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Input label="Más de 2.5" value={form.over} onChange={(v) => setForm({ ...form, over: v })} />
            <Input label="Menos de 2.5" value={form.under} onChange={(v) => setForm({ ...form, under: v })} />
          </div>
        </fieldset>

        {/* BTTS */}
        <fieldset style={{ border: "1px solid var(--border-soft, rgba(0,16,80,.08))", borderRadius: 8, padding: 12, marginBottom: 16 }}>
          <legend style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dark)", padding: "0 6px" }}>
            BTTS (Ambos anotan)
          </legend>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Input label="Sí" value={form.si} onChange={(v) => setForm({ ...form, si: v })} />
            <Input label="No" value={form.no} onChange={(v) => setForm({ ...form, no: v })} />
          </div>
        </fieldset>

        {errorMsg && (
          <div
            style={{
              fontSize: 12,
              color: "var(--pred-wrong, #dc2626)",
              marginBottom: 12,
              padding: 8,
              background: "rgba(220,38,38,.06)",
              borderRadius: 6,
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={cerrar}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-aprobar btn-xs"
            onClick={guardar}
            disabled={enviando}
          >
            {enviando ? "Guardando..." : "Guardar cuotas"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Input({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted-d, rgba(0,16,80,.58))",
          textTransform: "uppercase",
          letterSpacing: 0.04,
        }}
      >
        {label}
      </span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="—"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "6px 8px",
          border: "1px solid var(--border-soft, rgba(0,16,80,.16))",
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "'Roboto Mono', monospace",
          textAlign: "center",
        }}
      />
    </label>
  );
}
