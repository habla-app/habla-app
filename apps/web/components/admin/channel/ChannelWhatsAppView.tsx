"use client";

// ChannelWhatsAppView — composición de stats + alertas + picks recientes
// + acciones admin para `/admin/channel-whatsapp`. Lote F (May 2026).
import { useState } from "react";
import Link from "next/link";

import { authedFetch } from "@/lib/api-client";
import { AdminCard } from "@/components/ui/admin/AdminCard";
import { AdminTable } from "@/components/ui/admin/AdminTable";
import { Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils/cn";
import type {
  AlertaLeak,
  EngagementDia,
  InfoUltimoSync,
  PickEnviadoFila,
  StatsMembresia,
} from "@/lib/services/channel-whatsapp.service";

interface Props {
  stats: StatsMembresia;
  engagement: EngagementDia[];
  picksRecientes: PickEnviadoFila[];
  ultimoSync: InfoUltimoSync;
  alertasLeak: AlertaLeak[];
}

export function ChannelWhatsAppView({
  stats,
  engagement,
  picksRecientes,
  ultimoSync,
  alertasLeak,
}: Props) {
  const toast = useToast();
  const [forzandoSync, setForzandoSync] = useState(false);

  async function forzarSync() {
    setForzandoSync(true);
    try {
      const res = await authedFetch("/api/v1/admin/channel-whatsapp/forzar-sync", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Falló el sync forzado");
      toast.show("Sync de membresía iniciado en background");
    } catch (err) {
      toast.show(`Error: ${err instanceof Error ? err.message : "desconocido"}`);
    } finally {
      setForzandoSync(false);
    }
  }

  const totalEnviosUlt30d = engagement.reduce((acc, d) => acc + d.envios, 0);

  return (
    <div className="space-y-6">
      {alertasLeak.length > 0 && (
        <AlertasLeakBanner alertas={alertasLeak} />
      )}

      <section className="grid grid-cols-4 gap-3">
        <StatCard label="Suscriptores activos" value={stats.suscriptoresActivos} tone="brand" />
        <StatCard label="Miembros unidos" value={stats.miembrosUnidos} tone="good" />
        <StatCard
          label="Pendientes (>24h)"
          value={stats.pendientesUnirse}
          tone={stats.pendientesUnirse > 0 ? "amber" : "neutral"}
        />
        <StatCard label="Removidos último mes" value={stats.removidosUltMes} tone="neutral" />
      </section>

      <AdminCard
        title="Envíos al Channel · últimos 30 días"
        description={`${totalEnviosUlt30d} picks enviados en total`}
      >
        <EngagementBars dias={engagement} />
      </AdminCard>

      <AdminCard
        title="Últimos picks enviados"
        actions={
          <Link
            href="/admin/picks-premium?estado=APROBADO"
            className="text-admin-meta font-bold text-brand-blue-main hover:underline"
          >
            Ver todos →
          </Link>
        }
        bodyPadding="none"
      >
        <AdminTable
          columns={[
            {
              key: "enviadoEn",
              label: "Enviado",
              render: (r) => (
                <span className="text-admin-meta text-muted-d">
                  {r.enviadoEn ? formatLima(r.enviadoEn) : "—"}
                </span>
              ),
            },
            {
              key: "partido",
              label: "Partido",
              render: (r) => (
                <Link
                  href={`/admin/picks-premium?id=${r.id}`}
                  className="text-dark hover:underline"
                >
                  {r.equipoLocal} vs {r.equipoVisita}
                  <div className="text-admin-meta text-muted-d">{r.liga}</div>
                </Link>
              ),
            },
            {
              key: "mercado",
              label: "Mercado",
              render: (r) => `${r.mercado} · ${r.outcome}`,
            },
            {
              key: "cuota",
              label: "Cuota",
              align: "right",
              render: (r) => (
                <span className="font-display font-bold tabular-nums">
                  {r.cuotaSugerida.toFixed(2)}
                </span>
              ),
            },
            {
              key: "resultado",
              label: "Resultado",
              align: "center",
              render: (r) =>
                r.resultadoFinal ? (
                  <ResultadoBadge resultado={r.resultadoFinal} />
                ) : (
                  <span className="text-admin-meta text-muted-d">Pendiente</span>
                ),
            },
          ]}
          data={picksRecientes}
          rowKey={(r) => r.id}
          empty="Sin picks enviados todavía."
        />
      </AdminCard>

      <div className="grid grid-cols-2 gap-4">
        <AdminCard
          title="Rotación de invite link"
          description="Recomendado cada 6 meses para mitigar leaks"
        >
          <div className="space-y-3">
            <p className="text-admin-body text-dark">
              Próxima rotación recomendada: <strong>30 octubre 2026</strong> (180 días desde el último).
            </p>
            <ol className="ml-5 list-decimal space-y-1 text-admin-meta text-muted-d">
              <li>Crear nuevo Channel &ldquo;Habla! Picks v2&rdquo; desde la app móvil.</li>
              <li>Copiar 3-5 picks históricos al Channel nuevo.</li>
              <li>Pegar el nuevo invite link en Railway → variable WHATSAPP_CHANNEL_PREMIUM_INVITE_LINK.</li>
              <li>El cron Q reinvitará a todos los miembros con el link nuevo en su próximo tick.</li>
              <li>Eliminar el Channel viejo cuando ya no haya actividad (esperar 7-14 días).</li>
            </ol>
          </div>
        </AdminCard>

        <AdminCard title="Estado del cron de sync">
          <dl className="space-y-2 text-admin-body text-dark">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-d">Última invitación enviada</dt>
              <dd>
                {ultimoSync.ultimaActualizacion
                  ? formatLima(ultimoSync.ultimaActualizacion)
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-d">Miembros tracked</dt>
              <dd className="tabular-nums">{ultimoSync.miembrosTracked}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-d">Frecuencia cron Q</dt>
              <dd>cada 1h (in-process)</dd>
            </div>
          </dl>
          <div className="mt-4 border-t border-light pt-3">
            <Button
              variant="ghost"
              type="button"
              onClick={forzarSync}
              disabled={forzandoSync}
            >
              {forzandoSync ? "Ejecutando…" : "Forzar sync ahora"}
            </Button>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "good" | "amber" | "neutral";
}) {
  const valueClass = {
    brand: "text-brand-blue-main",
    good: "text-status-green-text",
    amber: "text-status-amber-text",
    neutral: "text-dark",
  }[tone];
  return (
    <div className="rounded-md border border-admin-table-border bg-admin-card-bg p-4">
      <div className="text-admin-label text-muted-d">{label}</div>
      <div className={cn("mt-2 text-kpi-value-lg tabular-nums", valueClass)}>
        {value.toLocaleString("es-PE")}
      </div>
    </div>
  );
}

function EngagementBars({ dias }: { dias: EngagementDia[] }) {
  const max = Math.max(1, ...dias.map((d) => d.envios));
  return (
    <div className="flex h-32 items-end gap-0.5">
      {dias.map((d) => {
        const heightPct = (d.envios / max) * 100;
        return (
          <div
            key={d.fecha.toISOString()}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${d.fecha.toLocaleDateString("es-PE", {
              timeZone: "America/Lima",
              day: "2-digit",
              month: "short",
            })} · ${d.envios} envíos`}
          >
            <div
              className={cn(
                "w-full rounded-t-sm bg-whatsapp-green transition-colors group-hover:bg-whatsapp-green-dark",
                d.envios === 0 && "bg-subtle",
              )}
              style={{ height: `${Math.max(heightPct, 2)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}

function AlertasLeakBanner({ alertas }: { alertas: AlertaLeak[] }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-status-amber bg-status-amber-bg p-4"
    >
      <div className="text-admin-card-title text-status-amber-text">
        ⚠ {alertas.length === 1 ? "Alerta de leak" : `${alertas.length} alertas de leak`}
      </div>
      <ul className="mt-2 ml-5 list-disc space-y-1 text-admin-body text-dark">
        {alertas.map((a) => (
          <li key={a.tipo}>
            <strong>{a.descripcion}</strong> · {a.count} casos
            {a.detalles && a.detalles.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-admin-meta text-muted-d">
                  Ver lista
                </summary>
                <ul className="ml-5 mt-1 list-disc text-admin-meta">
                  {a.detalles.map((d) => (
                    <li key={d.email}>
                      {d.nombre} ({d.email})
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-admin-meta text-muted-d">
        Acción manual: abrí WhatsApp → Channel &ldquo;Habla! Picks&rdquo; → tap nombre → Remove.
      </p>
    </div>
  );
}

function ResultadoBadge({ resultado }: { resultado: string }) {
  const cfg = (() => {
    if (resultado === "GANADO")
      return {
        label: "Ganó",
        cls: "bg-status-green-bg text-status-green-text",
      };
    if (resultado === "PERDIDO")
      return {
        label: "Perdió",
        cls: "bg-status-red-bg text-status-red-text",
      };
    if (resultado === "NULO")
      return { label: "Nulo", cls: "bg-status-neutral-bg text-status-neutral-text" };
    if (resultado === "PUSH")
      return { label: "Push", cls: "bg-subtle text-muted-d" };
    return { label: resultado, cls: "bg-subtle text-muted-d" };
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
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
