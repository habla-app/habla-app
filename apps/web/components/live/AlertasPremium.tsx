// AlertasPremium — alertas en vivo del editor para suscriptores Premium
// (Lote C v3.1). Spec:
// docs/ux-spec/03-pista-usuario-autenticada/live-match.spec.md.
//
// Se monta en /live-match cuando el usuario tiene suscripción activa. La
// fuente real de alertas (canal interno o webhook WhatsApp Business) se
// implementa en Lote E. Mientras tanto, el componente acepta una lista
// estática y muestra el empty state si está vacía.
//
// Variante para usuarios NO Premium: teaser con CTA "Probar 7 días gratis"
// que ocupa el slot — aprovecha el momento de máxima atención (live).

import Link from "next/link";

interface AlertaItem {
  id: string;
  emoji: string;
  titulo: string;
  detalle: string;
  hora: string;
}

interface AlertasPremiumProps {
  esPremium: boolean;
  alertas?: AlertaItem[];
}

export function AlertasPremium({
  esPremium,
  alertas = [],
}: AlertasPremiumProps) {
  if (!esPremium) {
    return (
      <Link
        href="/premium"
        className="group mx-4 flex items-center gap-3 rounded-md border border-premium-border bg-premium-card-gradient px-4 py-3.5 text-premium-text-on-dark shadow-premium-card transition-all hover:border-brand-gold/60 active:scale-[0.99]"
      >
        <span
          aria-hidden
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-brand-gold text-[20px] text-brand-blue-dark"
        >
          ⚡
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-display-xs font-bold uppercase">
            Recibe alertas en vivo con Premium
          </p>
          <p className="text-body-xs text-premium-text-muted-on-dark">
            El editor publica oportunidades minuto a minuto
          </p>
        </div>
        <span className="rounded-full bg-brand-gold px-3 py-1 text-label-md font-bold text-brand-blue-dark group-hover:translate-x-0.5">
          Probar →
        </span>
      </Link>
    );
  }

  if (alertas.length === 0) {
    return (
      <section className="mx-4 rounded-md border border-light bg-card px-4 py-3.5">
        <h3 className="flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
          <span aria-hidden>⚡</span>
          Alertas Premium
        </h3>
        <p className="mt-1.5 text-body-sm text-muted-d">
          Sin alertas activas. El editor publicará si surge una oportunidad.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-4 rounded-md border border-brand-gold bg-card px-4 py-3.5 shadow-sm">
      <h3 className="mb-2 flex items-center gap-2 font-display text-display-xs font-bold uppercase tracking-[0.04em] text-dark">
        <span aria-hidden>⚡</span>
        Alertas Premium
      </h3>
      <ul className="space-y-2">
        {alertas.map((a) => (
          <li
            key={a.id}
            className="flex items-start gap-2 rounded-sm bg-brand-gold-dim px-3 py-2"
          >
            <span aria-hidden className="text-[18px]">
              {a.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-sm font-bold text-dark">{a.titulo}</p>
              <p className="text-label-md text-muted-d">{a.detalle}</p>
            </div>
            <span className="text-label-sm text-muted-d">{a.hora}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
