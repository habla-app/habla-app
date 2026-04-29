"use client";
// Panel admin para forzar el cierre de un leaderboard mensual (Lote 5).
//
// Permite tipear cualquier mes en formato YYYY-MM (default: mes en curso)
// y opcionalmente pedir un dummy + saltar emails. Útil para validar el
// pipeline post-deploy sin esperar al cron.

import { useState } from "react";
import { Button, useToast } from "@/components/ui";
import { authedFetch } from "@/lib/api-client";
import { useRouter } from "next/navigation";

interface Props {
  mesActual: string;
}

interface CerrarResult {
  leaderboardId: string;
  mes: string;
  totalUsuarios: number;
  premiosCreados: number;
  dummyCreado: boolean;
  alreadyClosed: boolean;
  emailsEnviados: boolean;
}

export function CerrarLeaderboardPanel({ mesActual }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [mes, setMes] = useState(mesActual);
  const [dummy, setDummy] = useState(false);
  const [enviarEmails, setEnviarEmails] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<CerrarResult | null>(
    null,
  );

  async function handleCerrar() {
    setEnviando(true);
    try {
      const res = await authedFetch("/api/v1/admin/leaderboard/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, dummy, enviarEmails }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(
          payload?.error?.message ?? "Error al cerrar leaderboard.",
        );
      }
      const data = payload.data as CerrarResult;
      setUltimoResultado(data);
      if (data.alreadyClosed) {
        toast.show(`ℹ️ ${mes} ya estaba cerrado — no se hizo nada.`);
      } else {
        toast.show(
          `✅ ${mes} cerrado · ${data.totalUsuarios} tipsters · ${data.premiosCreados} premios${
            data.dummyCreado ? " (dummy)" : ""
          }`,
        );
      }
      router.refresh();
    } catch (err) {
      toast.show(`❌ ${(err as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mt-4 rounded-md border-[1.5px] border-dashed border-brand-blue-main bg-brand-blue-main/[0.04] p-4">
      <h3 className="mb-2 font-display text-[14px] font-black uppercase tracking-[0.04em] text-brand-blue-main">
        Forzar cierre manual
      </h3>
      <p className="mb-3 text-[12px] text-muted-d">
        Acción idempotente: si el mes ya está cerrado, no hace nada. Si no
        hay actividad real y marcás <strong>dummy</strong>, se crea un
        PremioMensual de inspección con monto S/ 0.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
          Mes (YYYY-MM)
          <input
            type="text"
            value={mes}
            onChange={(e) => setMes(e.target.value.trim())}
            placeholder="2026-04"
            className="w-32 rounded-sm border-[1.5px] border-light bg-card px-3 py-2 font-body text-[13px] text-dark outline-none focus:border-brand-blue-main focus:ring-2 focus:ring-brand-blue-main/10"
          />
        </label>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-dark">
          <input
            type="checkbox"
            checked={dummy}
            onChange={(e) => setDummy(e.target.checked)}
          />
          Crear dummy si no hay actividad
        </label>

        <label className="flex items-center gap-2 text-[12px] font-semibold text-dark">
          <input
            type="checkbox"
            checked={enviarEmails}
            onChange={(e) => setEnviarEmails(e.target.checked)}
          />
          Enviar emails al Top 10
        </label>

        <Button
          variant="primary"
          size="md"
          onClick={handleCerrar}
          disabled={enviando || !/^\d{4}-\d{2}$/.test(mes)}
        >
          {enviando ? "Cerrando…" : "Cerrar leaderboard"}
        </Button>
      </div>

      {ultimoResultado ? (
        <div className="mt-3 rounded-sm border border-light bg-card p-3 text-[12px] text-dark">
          <strong>Último resultado:</strong> mes {ultimoResultado.mes} ·{" "}
          {ultimoResultado.totalUsuarios} tipsters · {" "}
          {ultimoResultado.premiosCreados} premios creados
          {ultimoResultado.dummyCreado ? " (dummy)" : ""}
          {ultimoResultado.alreadyClosed ? " · YA ESTABA CERRADO" : ""}
          {ultimoResultado.emailsEnviados ? " · emails enviados" : ""}
        </div>
      ) : null}
    </div>
  );
}
