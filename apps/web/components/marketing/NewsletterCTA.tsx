"use client";
// NewsletterCTA — Lote 10. Card compacta inline para meter en footers de
// /blog/[slug], /guias/[slug], /pronosticos/[liga].
//
// Form con email + botón. POST a /api/v1/newsletter/suscribir. La prop
// `fuente` permite distinguir el origen para reporting.

import { useState } from "react";
import { Button, useToast } from "@/components/ui";

interface Props {
  fuente?: string;
  /** Estilo: "default" para card grande con titular, "compact" para tira
   *  inline más estrecha. Por ahora usamos sólo "default". */
  variant?: "default" | "compact";
}

export function NewsletterCTA({ fuente = "footer", variant = "default" }: Props) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/v1/newsletter/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fuente }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setErrorMsg(payload?.error?.message ?? "Error al suscribirte.");
        setEstado("error");
        return;
      }
      setEstado("ok");
      toast.show("✅ Revisá tu email para confirmar la suscripción.");
      setEmail("");
    } catch (err) {
      setErrorMsg((err as Error).message);
      setEstado("error");
    } finally {
      setEnviando(false);
    }
  }

  if (estado === "ok") {
    return (
      <aside className="my-10 rounded-md border-[1.5px] border-brand-green/40 bg-brand-green/[0.06] p-6 text-center">
        <p className="font-display text-[14px] font-bold text-brand-green">
          📬 ¡Casi listo! Revisá tu inbox para confirmar la suscripción.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className={`my-10 rounded-md border border-light bg-card p-6 shadow-sm ${
        variant === "compact" ? "md:p-5" : "md:p-8"
      }`}
    >
      <div className="mb-1 font-display text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gold">
        Newsletter Habla!
      </div>
      <h3 className="mb-2 font-display text-[22px] font-black leading-tight text-dark md:text-[24px]">
        Tu resumen semanal de Habla!
      </h3>
      <p className="mb-4 text-[14px] leading-[1.6] text-body">
        Top tipsters del mes, partidos top con mejores cuotas y artículos
        nuevos. Cada sábado, gratis.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 md:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="min-w-0 flex-1 rounded-sm border-[1.5px] border-light bg-card px-3.5 py-2.5 text-[14px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
        />
        <Button
          type="submit"
          variant="primary"
          size="md"
          disabled={enviando || !email}
        >
          {enviando ? "Suscribiendo…" : "Suscribirme"}
        </Button>
      </form>
      {errorMsg ? (
        <p className="mt-3 text-[13px] font-bold text-urgent-crit-fg">
          {errorMsg}
        </p>
      ) : (
        <p className="mt-2 text-[11.5px] text-muted-d">
          Sin spam. Podés darte de baja en un click.
        </p>
      )}
    </aside>
  );
}
