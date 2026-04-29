// MiTicketCard — card dorada grande arriba del ranking si el usuario
// tiene una combinada en este torneo. Replica `.my-ticket` del mockup.

import type { RankingRowPayload } from "@/lib/realtime/events";
import { PredChip } from "@/components/tickets/PredChip";

interface MiTicketCardProps {
  miPosicion: {
    posicion: number;
    ticketId: string;
    puntosTotal: number;
  } | null;
  totalInscritos: number;
  row: RankingRowPayload | null;
  equipoLocal: string;
  equipoVisita: string;
  partidoEstado: "EN_VIVO" | "FINALIZADO";
}

export function MiTicketCard({
  miPosicion,
  totalInscritos,
  row,
  equipoLocal,
  equipoVisita,
  partidoEstado,
}: MiTicketCardProps) {
  if (!miPosicion || !row) return null;

  const inTop10 = miPosicion.posicion <= 10;
  const titulo =
    partidoEstado === "FINALIZADO"
      ? inTop10
        ? `🏆 Quedaste ${miPosicion.posicion}° de ${totalInscritos}`
        : `Tu combinada · ${miPosicion.posicion}° de ${totalInscritos}`
      : `Tu combinada · Posición #${miPosicion.posicion} de ${totalInscritos}`;

  const subtitulo = inTop10
    ? partidoEstado === "FINALIZADO"
      ? "Quedaste en el top 10 — ¡crack!"
      : "Estás en el top 10 — seguí así."
    : partidoEstado === "FINALIZADO"
      ? "Quedaste fuera del top 10 en este torneo."
      : "Fuera del top 10 por ahora, todavía podés remontar.";

  return (
    <section className="mb-5 overflow-hidden rounded-lg border-[2px] border-brand-gold bg-gradient-to-br from-brand-gold/10 to-brand-gold/30 p-5 shadow-gold">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
        <div
          aria-hidden
          className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gold text-[28px] shadow-gold"
        >
          🎯
        </div>
        <div className="min-w-0">
          <div className="font-display text-[12px] font-extrabold uppercase tracking-[0.06em] text-brand-gold-dark">
            {titulo}
          </div>
          <p className="mb-2 mt-0.5 text-[13px] text-body">{subtitulo}</p>
          <div className="flex flex-wrap gap-1.5">
            {chipsDeRow(row, equipoLocal, equipoVisita)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[30px] font-black leading-none text-brand-gold-dark">
            {row.puntosTotal} pts
          </div>
          <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-d">
            de 21 posibles
          </div>
          <div
            className={`mt-2 rounded-sm px-2.5 py-1 text-[12px] font-bold ${
              inTop10
                ? "bg-brand-gold text-black"
                : "bg-subtle text-muted-d"
            }`}
          >
            {inTop10 ? `Top 10 · ${miPosicion.posicion}°` : "Fuera del top 10"}
          </div>
        </div>
      </div>
    </section>
  );
}

function chipsDeRow(
  row: RankingRowPayload,
  equipoLocal: string,
  equipoVisita: string,
) {
  // Inferimos estados desde puntosDetalle: >0 → correct; partido todavía
  // en vivo = pending si 0. No es tan preciso como el adapter del
  // /mis-combinadas pero sirve para una pill visual rápida.
  const tieneResultado = row.puntosDetalle.resultado > 0;
  const tieneBtts = row.puntosDetalle.btts > 0;
  const tieneMas25 = row.puntosDetalle.mas25 > 0;
  const tieneRoja = row.puntosDetalle.tarjeta > 0;
  const tieneMarcador = row.puntosDetalle.marcador > 0;

  const label1X2 = row.predicciones.predResultado === "LOCAL"
    ? cortoNombre(equipoLocal)
    : row.predicciones.predResultado === "VISITA"
      ? cortoNombre(equipoVisita)
      : "Empate";

  return [
    <PredChip
      key="resultado"
      estado={tieneResultado ? "correct" : "pending"}
    >
      {label1X2}
    </PredChip>,
    <PredChip key="btts" estado={tieneBtts ? "correct" : "pending"}>
      {row.predicciones.predBtts ? "Ambos Sí" : "Ambos No"}
    </PredChip>,
    <PredChip key="mas25" estado={tieneMas25 ? "correct" : "pending"}>
      {row.predicciones.predMas25 ? "+2.5 Sí" : "+2.5 No"}
    </PredChip>,
    <PredChip key="roja" estado={tieneRoja ? "correct" : "pending"}>
      {row.predicciones.predTarjetaRoja ? "Roja Sí" : "Roja No"}
    </PredChip>,
    <PredChip key="marcador" estado={tieneMarcador ? "correct" : "pending"}>
      {row.predicciones.predMarcadorLocal}-
      {row.predicciones.predMarcadorVisita}
    </PredChip>,
  ];
}

function cortoNombre(nombre: string): string {
  const n = nombre.trim();
  if (n.length <= 10) return n;
  return n.split(/\s+/)[0] ?? n.slice(0, 8);
}
