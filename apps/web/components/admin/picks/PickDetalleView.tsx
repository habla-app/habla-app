"use client";

// PickDetalleView — panel derecho con detalle completo del pick. Lote F.
// Spec: docs/ux-spec/05-pista-admin-operacion/picks-premium.spec.md.
//
// Sections: header partido + recomendación + razonamiento + datos clave
// + preview del mensaje WhatsApp (real, formato del Lote E) + botones de
// acción sticky en bottom.

import { useMemo } from "react";
import { Button } from "@/components/ui";
import { KbdHint } from "@/components/ui/admin/KbdHint";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { cn } from "@/lib/utils/cn";
import type { PickDetalleAdmin } from "@/lib/services/picks-premium-admin.service";
import { labelMercado } from "./PicksPremiumView";
import { formatearPickPremiumPreview } from "./formato-preview";

interface PickDetalleViewProps {
  pick: PickDetalleAdmin;
  editorEmail: string;
  onAprobar: () => void | Promise<void>;
  onAbrirRechazo: () => void;
  onAbrirEditor: () => void;
  aprobando: boolean;
}

export function PickDetalleView({
  pick,
  editorEmail,
  onAprobar,
  onAbrirRechazo,
  onAbrirEditor,
  aprobando,
}: PickDetalleViewProps) {
  const yaProcesado =
    pick.aprobado || pick.estado === "RECHAZADO" || pick.estado === "EDITADO_Y_APROBADO";

  const previewMensaje = useMemo(
    () => formatearPickPremiumPreview(pick, editorEmail),
    [pick, editorEmail],
  );

  const fechaPartido = formatLima(pick.fechaInicio);

  return (
    <div className="space-y-4 pb-20">
      <AdminCard
        title={`${pick.equipoLocal} vs ${pick.equipoVisita}`}
        description={`${pick.liga} · ${fechaPartido}`}
        actions={<EstadoBadgeGrande estado={pick.estado} resultado={pick.resultadoFinal} />}
      >
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-admin-body">
          <DD label="ID">
            <code className="font-mono text-[12px]">{pick.id}</code>
          </DD>
          <DD label="Generado">
            {pick.generadoPor === "CLAUDE_API" ? "Claude API" : "Editor manual"}{" "}
            · {formatLima(pick.generadoEn)}
          </DD>
          {pick.aprobadoEn && (
            <DD label="Aprobado">
              {formatLima(pick.aprobadoEn)} por {pick.aprobadoPor ?? "—"}
            </DD>
          )}
          {pick.enviadoEn && (
            <DD label="Enviado al Channel">
              {formatLima(pick.enviadoEn)}
            </DD>
          )}
        </dl>
      </AdminCard>

      <AdminCard title="Recomendación generada">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-admin-body text-dark">
          <DD label="Mercado">{labelMercado(pick.mercado, pick.outcome)}</DD>
          <DD label="Cuota sugerida">
            <span className="font-display font-extrabold tabular-nums">
              {pick.cuotaSugerida.toFixed(2)}
            </span>
          </DD>
          <DD label="Stake sugerido">
            {(pick.stakeSugerido * 100).toFixed(1)}% del bankroll
          </DD>
          <DD label="EV+ estimado">
            {pick.evPctSugerido !== null
              ? `${(pick.evPctSugerido * 100).toFixed(1)}%`
              : "—"}
          </DD>
          {pick.casaRecomendada && (
            <DD label="Mejor cuota">
              {pick.casaRecomendada.nombre}{" "}
              <code className="font-mono text-admin-meta text-muted-d">
                /go/{pick.casaRecomendada.slug}
              </code>
            </DD>
          )}
        </div>
      </AdminCard>

      <AdminCard title="Razonamiento estadístico">
        <p className="whitespace-pre-line text-admin-body text-dark">
          {pick.razonamiento}
        </p>
      </AdminCard>

      {pick.estadisticas &&
        (pick.estadisticas.h2h ||
          pick.estadisticas.formaReciente ||
          pick.estadisticas.factorClave) && (
          <AdminCard title="Datos clave">
            <ul className="space-y-2 text-admin-body text-dark">
              {pick.estadisticas.h2h && (
                <li>
                  <strong className="text-muted-d">H2H:</strong>{" "}
                  {pick.estadisticas.h2h}
                </li>
              )}
              {pick.estadisticas.formaReciente && (
                <li>
                  <strong className="text-muted-d">Forma:</strong>{" "}
                  {pick.estadisticas.formaReciente}
                </li>
              )}
              {pick.estadisticas.factorClave && (
                <li>
                  <strong className="text-muted-d">Factor clave:</strong>{" "}
                  {pick.estadisticas.factorClave}
                </li>
              )}
            </ul>
          </AdminCard>
        )}

      <AdminCard title="Preview WhatsApp" description="Cómo se verá el mensaje 1:1 al suscriptor">
        <pre className="whitespace-pre-wrap rounded-md bg-whatsapp-chat-bubble border border-light p-3 text-[12px] leading-relaxed text-dark font-mono max-h-[260px] overflow-y-auto">
          {previewMensaje}
        </pre>
        <p className="mt-2 text-admin-meta text-muted-d">
          Watermark: {editorEmail} · {previewMensaje.length}/1024 chars
        </p>
      </AdminCard>

      {pick.rechazadoMotivo && (
        <AdminCard title="Motivo de rechazo" className="border-status-red">
          <p className="text-admin-body text-status-red-text">
            {pick.rechazadoMotivo}
          </p>
        </AdminCard>
      )}

      {/* Acciones sticky bottom */}
      {!yaProcesado && (
        <div className="fixed bottom-0 right-0 z-sticky w-[calc(100%-240px)] border-t border-admin-table-border bg-admin-card-bg px-6 py-3">
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              onClick={onAbrirEditor}
              disabled={aprobando}
            >
              <KbdHint>E</KbdHint>
              <span className="ml-2">Editar</span>
            </Button>
            <Button
              variant="danger"
              type="button"
              onClick={onAbrirRechazo}
              disabled={aprobando}
            >
              <KbdHint>R</KbdHint>
              <span className="ml-2">Rechazar</span>
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={() => void onAprobar()}
              disabled={aprobando}
            >
              <KbdHint>A</KbdHint>
              <span className="ml-2">{aprobando ? "Aprobando…" : "Aprobar y enviar"}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DD({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-admin-label text-muted-d">{label}</dt>
      <dd className="mt-0.5 text-dark">{children}</dd>
    </div>
  );
}

function EstadoBadgeGrande({
  estado,
  resultado,
}: {
  estado: string;
  resultado: string | null;
}) {
  const cfg: { label: string; cls: string } = (() => {
    if (resultado === "GANADO")
      return {
        label: "GANADO",
        cls: "bg-status-green-bg text-status-green-text",
      };
    if (resultado === "PERDIDO")
      return {
        label: "PERDIDO",
        cls: "bg-status-red-bg text-status-red-text",
      };
    if (estado === "PENDIENTE")
      return {
        label: "PENDIENTE",
        cls: "bg-status-amber-bg text-status-amber-text",
      };
    if (estado === "APROBADO" || estado === "EDITADO_Y_APROBADO")
      return {
        label: "APROBADO",
        cls: "bg-status-green-bg text-status-green-text",
      };
    if (estado === "RECHAZADO")
      return {
        label: "RECHAZADO",
        cls: "bg-status-neutral-bg text-status-neutral-text",
      };
    return { label: estado, cls: "bg-subtle text-muted-d" };
  })();
  return (
    <span
      className={cn(
        "rounded-sm px-2.5 py-1 text-admin-meta font-bold uppercase",
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function formatLima(d: Date): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}
