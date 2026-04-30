"use client";
// Panel admin del newsletter — Lote 10.
//
// Muestra el draft de la semana actual (preview + JSON editable) y permite:
//   - Generar el draft si todavía no existe (POST /admin/newsletter/draft).
//   - Editar el JSON del contenido (PUT /admin/newsletter/draft).
//   - Aprobar y enviar (POST /admin/newsletter/aprobar).
// Debajo: tabla histórica de digests.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import type {
  DigestSemanal,
  DraftSemanalFila,
} from "@/lib/services/newsletter.service";

interface Props {
  semanaActual: string;
  draftActual: DraftSemanalFila | null;
  historico: DraftSemanalFila[];
}

export function NewsletterAdminPanel({
  semanaActual,
  draftActual,
  historico,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [json, setJson] = useState(
    draftActual ? JSON.stringify(draftActual.contenido, null, 2) : "",
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  async function handleGenerarDraft() {
    setGenerando(true);
    try {
      const res = await authedFetch("/api/v1/admin/newsletter/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semana: semanaActual }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Error al generar draft.");
      }
      toast.show(
        payload.data.created
          ? `✅ Draft generado para ${semanaActual}`
          : `ℹ️ Draft de ${semanaActual} ya existía — sin cambios.`,
      );
      router.refresh();
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setGenerando(false);
    }
  }

  async function handleGuardarJson() {
    setJsonError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch (err) {
      setJsonError(`JSON inválido: ${(err as Error).message}`);
      return;
    }
    setGuardando(true);
    try {
      const res = await authedFetch("/api/v1/admin/newsletter/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semana: semanaActual, contenido: parsed }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Error al guardar JSON.");
      }
      toast.show(`✅ Contenido del draft actualizado.`);
      router.refresh();
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }

  async function handleAprobar() {
    if (!confirm("¿Aprobar y enviar el digest? Esta acción no se puede deshacer.")) {
      return;
    }
    setEnviando(true);
    try {
      const res = await authedFetch("/api/v1/admin/newsletter/aprobar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semana: semanaActual }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error?.message ?? "Error al aprobar digest.");
      }
      const r = payload.data as {
        destinatarios: number;
        enviados: number;
        fallidos: number;
      };
      toast.show(
        `✅ Digest enviado: ${r.enviados}/${r.destinatarios} ok · ${r.fallidos} fallidos.`,
      );
      router.refresh();
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }

  const yaEnviado = draftActual?.enviadoEn != null;

  return (
    <div className="space-y-8">
      {/* Sección — semana actual */}
      <section className="rounded-md border border-light bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
              Semana en curso
            </h2>
            <p className="mt-0.5 font-mono text-[13px] text-muted-d">
              {semanaActual}
              {yaEnviado ? (
                <span className="ml-2 inline-block rounded-sm bg-brand-green/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-brand-green">
                  Enviado el {fmtDate(draftActual!.enviadoEn!)}
                </span>
              ) : null}
            </p>
          </div>
          {!draftActual ? (
            <Button
              variant="primary"
              size="md"
              onClick={handleGenerarDraft}
              disabled={generando}
            >
              {generando ? "Generando…" : "Generar draft ahora"}
            </Button>
          ) : !yaEnviado ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleAprobar}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : "✅ Aprobar y enviar"}
            </Button>
          ) : null}
        </div>

        {!draftActual ? (
          <p className="text-[14px] text-muted-d">
            Todavía no hay un draft generado para esta semana. El cron L lo
            crea los sábados ≥09:00 PET, pero podés disparar la generación a
            mano arriba.
          </p>
        ) : (
          <>
            <DigestPreview digest={draftActual.contenido} />
            {!yaEnviado ? (
              <div className="mt-6">
                <h3 className="mb-2 font-display text-[14px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Editar JSON crudo
                </h3>
                <textarea
                  className="block h-72 w-full resize-y rounded-sm border-[1.5px] border-light bg-subtle px-3 py-2 font-mono text-[12px] leading-snug text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
                  value={json}
                  onChange={(e) => {
                    setJson(e.target.value);
                    setJsonError(null);
                  }}
                  spellCheck={false}
                />
                {jsonError ? (
                  <p className="mt-2 text-[12px] font-bold text-urgent-crit-fg">
                    {jsonError}
                  </p>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleGuardarJson}
                    disabled={guardando}
                  >
                    {guardando ? "Guardando…" : "Guardar JSON"}
                  </Button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Sección — histórico */}
      <section>
        <h2 className="mb-3 font-display text-[20px] font-black uppercase tracking-[0.02em] text-dark">
          Histórico de digests
        </h2>
        <div className="overflow-x-auto rounded-md border border-light bg-card shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-light bg-subtle">
              <tr>
                <th className="px-4 py-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Semana
                </th>
                <th className="px-4 py-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Estado
                </th>
                <th className="px-4 py-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Destinatarios
                </th>
                <th className="px-4 py-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Enviado en
                </th>
                <th className="px-4 py-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Aprobado por
                </th>
                <th className="px-4 py-3 font-display text-[11px] font-bold uppercase tracking-[0.04em] text-muted-d">
                  Métricas Resend
                </th>
              </tr>
            </thead>
            <tbody>
              {historico.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-muted-d"
                  >
                    Todavía no hay digests registrados.
                  </td>
                </tr>
              ) : (
                historico.map((d) => (
                  <tr key={d.id} className="border-b border-light last:border-b-0">
                    <td className="px-4 py-3 font-mono text-[13px] text-dark">
                      {d.semana}
                    </td>
                    <td className="px-4 py-3">
                      {d.enviadoEn ? (
                        <span className="rounded-sm bg-brand-green/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-brand-green">
                          Enviado
                        </span>
                      ) : (
                        <span className="rounded-sm bg-brand-gold/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] text-brand-gold">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-dark">{d.destinatarios}</td>
                    <td className="px-4 py-3 text-muted-d">
                      {d.enviadoEn ? fmtDate(d.enviadoEn) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-d">
                      {d.aprobadoPor ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-d">
                      {/*
                        TODO: Métricas opens/clicks de Resend.
                        Requiere endpoint /emails/{id}/stats que la API de
                        Resend no expone públicamente al momento — se
                        sumará cuando publiquen la API o vía webhook
                        events. Lote 14+.
                      */}
                      —
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DigestPreview({ digest }: { digest: DigestSemanal }) {
  return (
    <div className="rounded-md border border-light bg-subtle p-4">
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-brand-gold">
        Preview · {digest.semana}
      </div>
      <h3 className="mb-1 font-display text-[18px] font-black text-dark">
        {digest.titulo}
      </h3>
      <p className="mb-4 text-[13px] italic text-muted-d">
        {digest.secciones.frase}
      </p>

      {digest.secciones.topTipsters.length > 0 ? (
        <Block titulo="🏆 Top tipsters">
          <ul className="space-y-1 text-[13px] text-dark">
            {digest.secciones.topTipsters.map((t) => (
              <li key={t.username}>
                <strong>#{t.posicion}</strong> @{t.username} —{" "}
                <span className="text-muted-d">{t.puntos} pts</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {digest.secciones.partidosTop.length > 0 ? (
        <Block titulo="⚽ Partidos top">
          <ul className="space-y-1 text-[13px] text-dark">
            {digest.secciones.partidosTop.map((p) => (
              <li key={p.partidoId}>
                <span className="text-muted-d">[{p.liga}]</span> {p.equipos}
                {p.mejorCuota ? (
                  <span className="text-muted-d">
                    {" — mejor: "}
                    <strong>
                      {p.mejorCuota.outcome} {p.mejorCuota.odd.toFixed(2)}
                    </strong>{" "}
                    @ {p.mejorCuota.casa}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {digest.secciones.articulosNuevos.length > 0 ? (
        <Block titulo="📰 Nuevo en el blog">
          <ul className="space-y-1 text-[13px] text-dark">
            {digest.secciones.articulosNuevos.map((a) => (
              <li key={a.slug}>
                <strong>{a.titulo}</strong>
                <p className="text-[12px] text-muted-d">{a.excerpt}</p>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}

      {digest.secciones.destacadoSemanaAnterior ? (
        <Block titulo="⚡ Destacado">
          <p className="text-[13px] text-dark">
            {digest.secciones.destacadoSemanaAnterior.acerto ? "✅" : "❌"}{" "}
            {digest.secciones.destacadoSemanaAnterior.pronostico}
          </p>
        </Block>
      ) : null}

      {digest.secciones.ctas.length > 0 ? (
        <Block titulo="CTAs">
          <ul className="space-y-1 text-[13px] text-brand-blue-main">
            {digest.secciones.ctas.map((c, idx) => (
              <li key={idx}>
                · {c.texto} <span className="text-muted-d">→ {c.url}</span>
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </div>
  );
}

function Block({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 font-display text-[12px] font-bold uppercase tracking-[0.04em] text-muted-d">
        {titulo}
      </div>
      {children}
    </div>
  );
}

function fmtDate(d: Date): string {
  try {
    return new Date(d).toLocaleString("es-PE", {
      timeZone: "America/Lima",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return String(d);
  }
}
