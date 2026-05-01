"use client";

// SuscripcionDetalleView — vista de detalle con stats + historial pagos
// + acciones admin (cancelar inmediato, reembolsar). Lote F (May 2026).
// Spec: docs/ux-spec/05-pista-admin-operacion/suscripciones.spec.md.
//
// Reglas críticas:
// - Cancelación inmediata = override del flow normal (Lote E mantiene acceso
//   hasta vencimiento). Confirmación obligatoria + motivo.
// - Reembolso fuera de garantía = override admin con confirmación adicional.
//   Si está en garantía, el flow normal aplica sin warnings extra.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { authedFetch } from "@/lib/api-client";
import { Button, useToast } from "@/components/ui";
import { Modal, ModalBody, ModalFooter, ModalHeader } from "@/components/ui/Modal";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { cn } from "@/lib/utils/cn";
import type { SuscripcionAdminDetalle } from "@/lib/services/suscripciones.service";

interface Props {
  detalle: SuscripcionAdminDetalle;
}

export function SuscripcionDetalleView({ detalle }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [reembolsarOpen, setReembolsarOpen] = useState(false);

  const totalPagado = detalle.pagos
    .filter((p) => p.estado === "PAGADO")
    .reduce((acc, p) => acc + p.monto, 0);
  const numPagos = detalle.pagos.filter((p) => p.estado === "PAGADO").length;
  const diasActiva = Math.round(
    (Date.now() - detalle.iniciada.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-4 gap-3">
        <StatCard
          label="Estado"
          value={detalle.estado}
          tone={
            detalle.estado === "ACTIVA"
              ? "good"
              : detalle.estado === "CANCELANDO"
                ? "amber"
                : "neutral"
          }
        />
        <StatCard label="Plan" value={detalle.plan} tone="brand" />
        <StatCard
          label="Días activa"
          value={diasActiva.toString()}
          tone="neutral"
        />
        <StatCard
          label="Total pagado"
          value={`S/ ${(totalPagado / 100).toLocaleString("es-PE")}`}
          tone="good"
        />
      </section>

      <AdminCard title="Información de suscripción">
        <dl className="grid grid-cols-3 gap-x-6 gap-y-3 text-admin-body text-dark">
          <DD label="ID Habla">
            <code className="font-mono text-[12px]">{detalle.id}</code>
          </DD>
          <DD label="Iniciada">{formatLima(detalle.iniciada)}</DD>
          <DD label="Próximo cobro">
            {detalle.proximoCobro && !detalle.cancelada
              ? formatLima(detalle.proximoCobro)
              : "—"}
          </DD>
          <DD label="Vencimiento">
            {detalle.vencimiento ? formatLima(detalle.vencimiento) : "—"}
          </DD>
          <DD label="OpenPay Sub ID">
            <code className="font-mono text-[11px]">
              {detalle.openpaySuscripcionId ?? "—"}
            </code>
          </DD>
          <DD label="OpenPay Customer">
            <code className="font-mono text-[11px]">
              {detalle.openpayCustomerId ?? "—"}
            </code>
          </DD>
          <DD label="Garantía 7d">{detalle.enGarantia ? "Vigente" : "Expirada"}</DD>
          <DD label="Cancelada en">
            {detalle.canceladaEn ? formatLima(detalle.canceladaEn) : "—"}
          </DD>
          <DD label="Reembolso">
            {detalle.reembolsoEn
              ? `Procesado · ${formatLima(detalle.reembolsoEn)}`
              : "—"}
          </DD>
          {detalle.motivoCancela && (
            <div className="col-span-3">
              <dt className="text-admin-label text-muted-d">Motivo cancelación</dt>
              <dd className="mt-0.5 text-dark">{detalle.motivoCancela}</dd>
            </div>
          )}
        </dl>
      </AdminCard>

      <AdminCard title="Historial de pagos" bodyPadding="none">
        <AdminTable
          columns={[
            {
              key: "fecha",
              label: "Fecha",
              render: (p) => formatLima(p.fecha),
            },
            {
              key: "monto",
              label: "Monto",
              align: "right",
              render: (p) => (
                <span className="tabular-nums">
                  S/ {(p.monto / 100).toLocaleString("es-PE", { maximumFractionDigits: 2 })}
                </span>
              ),
            },
            {
              key: "estado",
              label: "Estado",
              render: (p) => <PagoEstadoBadge estado={p.estado} />,
            },
            {
              key: "intentos",
              label: "Intentos",
              align: "right",
              render: (p) => p.intentos,
            },
            {
              key: "tarjeta",
              label: "Tarjeta",
              render: (p) =>
                p.ultimosCuatro
                  ? `${p.marcaTarjeta ?? ""} •••• ${p.ultimosCuatro}`
                  : "—",
            },
            {
              key: "error",
              label: "Error",
              render: (p) =>
                p.codigoError || p.mensajeError ? (
                  <div>
                    <code className="font-mono text-[11px] text-status-red-text">
                      {p.codigoError ?? "—"}
                    </code>
                    {p.mensajeError && (
                      <div className="text-admin-meta text-muted-d">
                        {p.mensajeError}
                      </div>
                    )}
                  </div>
                ) : (
                  "—"
                ),
            },
          ]}
          data={detalle.pagos}
          rowKey={(p) => p.id}
          empty="Sin pagos registrados."
        />
      </AdminCard>

      <AdminCard title="Acciones admin">
        <p className="mb-3 text-admin-meta text-muted-d">
          {numPagos} pago{numPagos === 1 ? "" : "s"} acreditado{numPagos === 1 ? "" : "s"} · todas las acciones quedan registradas en auditoría.
        </p>
        <div className="flex flex-wrap gap-2">
          {detalle.activa && (
            <Button
              variant="danger"
              type="button"
              onClick={() => setCancelarOpen(true)}
            >
              Cancelar inmediato
            </Button>
          )}
          {detalle.estado !== "REEMBOLSADA" && numPagos > 0 && (
            <Button
              variant="ghost"
              type="button"
              onClick={() => setReembolsarOpen(true)}
            >
              Reembolsar último pago
            </Button>
          )}
        </div>
      </AdminCard>

      <CancelarModal
        isOpen={cancelarOpen}
        onClose={() => setCancelarOpen(false)}
        suscripcionId={detalle.id}
        onCancelado={() => {
          setCancelarOpen(false);
          toast.show("Suscripción cancelada inmediatamente");
          router.refresh();
        }}
      />

      <ReembolsarModal
        isOpen={reembolsarOpen}
        onClose={() => setReembolsarOpen(false)}
        suscripcionId={detalle.id}
        enGarantia={detalle.enGarantia}
        onReembolsado={() => {
          setReembolsarOpen(false);
          toast.show("Reembolso procesado en OpenPay");
          router.refresh();
        }}
      />
    </div>
  );
}

function CancelarModal({
  isOpen,
  onClose,
  suscripcionId,
  onCancelado,
}: {
  isOpen: boolean;
  onClose: () => void;
  suscripcionId: string;
  onCancelado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (isOpen) setMotivo("");
  }, [isOpen]);

  async function confirmar() {
    if (motivo.trim().length < 1) return;
    setEnviando(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/suscripciones/${suscripcionId}/cancelar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivo.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Falló la cancelación");
      }
      onCancelado();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Cancelar inmediato">
      <ModalHeader onClose={onClose} eyebrow="Acción admin destructiva">
        <h2 className="font-display text-[22px] font-extrabold text-white">
          Cancelar inmediato
        </h2>
      </ModalHeader>
      <ModalBody>
        <div className="rounded-md border border-status-amber bg-status-amber-bg p-3 text-admin-body text-status-amber-text">
          ⚠ Esto cancela en OpenPay <strong>y remueve el acceso al Channel ahora</strong>. Distinto al flow normal del usuario (que mantiene acceso hasta vencimiento).
        </div>
        <label
          htmlFor="motivo-cancel"
          className="mt-4 block text-admin-body text-dark"
        >
          Motivo (obligatorio)
        </label>
        <textarea
          id="motivo-cancel"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
          className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark focus:border-brand-blue-main focus:outline-none"
          placeholder="Ej: usuario reportó cobro duplicado, fraude detectado, solicitud de equipo legal…"
        />
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Volver
          </Button>
          <Button
            variant="danger"
            onClick={confirmar}
            disabled={enviando || motivo.trim().length < 1}
          >
            {enviando ? "Cancelando…" : "Cancelar ahora"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

function ReembolsarModal({
  isOpen,
  onClose,
  suscripcionId,
  enGarantia,
  onReembolsado,
}: {
  isOpen: boolean;
  onClose: () => void;
  suscripcionId: string;
  enGarantia: boolean;
  onReembolsado: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [confirmadoFueraGarantia, setConfirmadoFueraGarantia] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMotivo("");
      setConfirmadoFueraGarantia(false);
    }
  }, [isOpen]);

  async function confirmar() {
    if (motivo.trim().length < 1) return;
    if (!enGarantia && !confirmadoFueraGarantia) return;
    setEnviando(true);
    try {
      const res = await authedFetch(
        `/api/v1/admin/suscripciones/${suscripcionId}/reembolsar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivo: motivo.trim() }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? "Falló el reembolso");
      }
      onReembolsado();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} label="Reembolsar pago">
      <ModalHeader onClose={onClose} eyebrow="Acción admin destructiva">
        <h2 className="font-display text-[22px] font-extrabold text-white">
          Reembolsar último pago
        </h2>
      </ModalHeader>
      <ModalBody>
        {enGarantia ? (
          <div className="rounded-md border border-status-green bg-status-green-bg p-3 text-admin-body text-status-green-text">
            ✓ Suscripción dentro de garantía 7 días. El reembolso se procesa sin overrides.
          </div>
        ) : (
          <div className="rounded-md border border-status-red bg-status-red-bg p-3 text-admin-body text-status-red-text">
            ⚠ <strong>FUERA de garantía 7 días.</strong> Esto es un override admin. El reembolso se ejecutará igual.
          </div>
        )}
        <label
          htmlFor="motivo-reemb"
          className="mt-4 block text-admin-body text-dark"
        >
          Motivo (obligatorio)
        </label>
        <textarea
          id="motivo-reemb"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value.slice(0, 500))}
          className="mt-2 w-full rounded-sm border border-strong bg-card px-3 py-2 text-admin-body text-dark focus:border-brand-blue-main focus:outline-none"
          placeholder="Ej: cobro duplicado, error de OpenPay, decisión por reclamo legal, …"
        />
        {!enGarantia && (
          <label className="mt-3 flex items-start gap-2 text-admin-body text-dark">
            <input
              type="checkbox"
              checked={confirmadoFueraGarantia}
              onChange={(e) => setConfirmadoFueraGarantia(e.target.checked)}
              className="mt-1"
            />
            <span>
              Confirmo que entiendo este reembolso está fuera de garantía y será un override admin.
            </span>
          </label>
        )}
      </ModalBody>
      <ModalFooter>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Volver
          </Button>
          <Button
            variant="danger"
            onClick={confirmar}
            disabled={
              enviando ||
              motivo.trim().length < 1 ||
              (!enGarantia && !confirmadoFueraGarantia)
            }
          >
            {enviando ? "Reembolsando…" : "Confirmar reembolso"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DD({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-admin-label text-muted-d">{label}</dt>
      <dd className="mt-0.5 text-dark">{children}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "brand" | "good" | "amber" | "red" | "neutral";
}) {
  const cls = {
    brand: "text-brand-blue-main",
    good: "text-status-green-text",
    amber: "text-status-amber-text",
    red: "text-status-red-text",
    neutral: "text-dark",
  }[tone];
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4">
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className={cn("mt-2 text-kpi-value-md tabular-nums", cls)}>{value}</div>
    </div>
  );
}

function PagoEstadoBadge({ estado }: { estado: string }) {
  const cfg = (() => {
    switch (estado) {
      case "PAGADO":
        return { label: "Pagado", cls: "bg-status-green-bg text-status-green-text" };
      case "RECHAZADO":
        return { label: "Rechazado", cls: "bg-status-red-bg text-status-red-text" };
      case "REEMBOLSADO":
        return { label: "Reembolsado", cls: "bg-status-neutral-bg text-status-neutral-text" };
      case "PENDIENTE":
        return { label: "Pendiente", cls: "bg-status-amber-bg text-status-amber-text" };
      case "TIMEOUT":
        return { label: "Timeout", cls: "bg-status-red-bg text-status-red-text" };
      default:
        return { label: estado, cls: "bg-subtle text-muted-d" };
    }
  })();
  return (
    <span
      className={cn(
        "rounded-sm px-2 py-0.5 text-admin-meta font-bold uppercase",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function formatLima(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
