"use client";
// SuscribirForm — Lote 10. Form principal de la page /suscribir.
//
// POST a /api/v1/newsletter/suscribir con `fuente: "page-suscribir"`.
// Estados: idle | enviando | ok | error. Toast de éxito vía useToast.

import { useState } from "react";
import { Button, useToast } from "@/components/ui";

export function SuscribirForm() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [estado, setEstado] = useState<"idle" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!acepta) {
      setErrorMsg("Tenés que aceptar los Términos y la Política de Privacidad.");
      return;
    }

    setEnviando(true);
    setEstado("idle");
    try {
      const res = await fetch("/api/v1/newsletter/suscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fuente: "page-suscribir" }),
      });
      const payload = await res.json();
      if (!res.ok) {
        const msg = payload?.error?.message ?? "Error al suscribirte.";
        setErrorMsg(msg);
        setEstado("error");
        return;
      }
      setEstado("ok");
      toast.show("✅ Revisá tu email para confirmar la suscripción.");
      setEmail("");
      setAcepta(false);
    } catch (err) {
      setErrorMsg((err as Error).message);
      setEstado("error");
    } finally {
      setEnviando(false);
    }
  }

  if (estado === "ok") {
    return (
      <div className="rounded-md border-[1.5px] border-brand-green/50 bg-brand-green/[0.06] p-5 text-center">
        <div className="mb-2 text-[28px]" aria-hidden>
          📬
        </div>
        <h2 className="mb-1 font-display text-[18px] font-black text-dark">
          ¡Casi listo!
        </h2>
        <p className="text-[14px] text-body">
          Te mandamos un email de confirmación. Hacé click en el botón
          adentro y empezamos a mandarte el resumen los sábados.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="suscribir-email"
          className="mb-1.5 block font-display text-[12px] font-bold uppercase tracking-[0.04em] text-muted-d"
        >
          Email
        </label>
        <input
          id="suscribir-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@email.com"
          className="block w-full rounded-sm border-[1.5px] border-light bg-card px-3.5 py-2.5 text-[15px] text-dark outline-none transition-colors focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
        />
      </div>

      <label className="flex items-start gap-2 text-[13px] text-body">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-light"
        />
        <span>
          Acepto recibir el newsletter editorial de Habla! y los{" "}
          <a
            href="/legal/terminos"
            className="font-bold text-brand-blue-main hover:underline"
          >
            Términos y Condiciones
          </a>
          .
        </span>
      </label>

      {errorMsg ? (
        <p className="rounded-sm border-[1.5px] border-urgent-crit-fg/30 bg-urgent-crit-fg/5 px-3 py-2 text-[13px] font-bold text-urgent-crit-fg">
          {errorMsg}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={enviando || !email || !acepta}
        className="w-full"
      >
        {enviando ? "Suscribiendo…" : "Suscribirme gratis"}
      </Button>
    </form>
  );
}
