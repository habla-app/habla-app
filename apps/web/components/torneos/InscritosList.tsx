// InscritosList — lista de jugadores inscritos en un torneo. Hotfix #5
// Bug #13.
//
// Comportamiento según estado del torneo (se decide en el server):
//   - ABIERTO: muestra @handle + nivel + cantidad de tickets. NO
//     muestra predicciones (privacidad competitiva).
//   - CERRADO/EN_JUEGO: muestra @handle + nivel + tickets + 5 chips
//     por cada ticket (acierto/fallo según puntosDetalle) + puntos.
//   - FINALIZADO: igual que CERRADO pero ordenado por posicionFinal ASC.
//
// Server Component — recibe ya la lista paginada; no hace fetch. La UI
// muestra "Ver todos" si total > limit.

import Link from "next/link";
import type { InscritoInfo } from "@/lib/services/torneos.service";
import { calcularNivel } from "@/lib/utils/nivel";

interface Props {
  inscritos: InscritoInfo[];
  total: number;
  /** Controla si se muestran las chips de predicciones + puntos. */
  mostrarPredicciones: boolean;
  /** Nombres de los equipos para el label del chip 1X2. */
  equipoLocal: string;
  equipoVisita: string;
  /** Para el link "Ver todos" preservando filtros. */
  torneoId: string;
  /** ¿Ya estamos mostrando todos? (sin paginación activa). */
  showingAll: boolean;
}

export function InscritosList({
  inscritos,
  total,
  mostrarPredicciones,
  equipoLocal,
  equipoVisita,
  torneoId,
  showingAll,
}: Props) {
  if (inscritos.length === 0) {
    return (
      <section className="rounded-md border border-light bg-card px-5 py-8 text-center shadow-sm">
        <div aria-hidden className="mb-2 text-3xl">
          🎯
        </div>
        <p className="text-sm font-semibold text-dark">
          Sé el primero en inscribirte
        </p>
        <p className="mt-1 text-[13px] text-muted-d">
          Armá tu combinada de 5 predicciones y ganá si quedás top 10.
        </p>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-md border border-light bg-card shadow-sm"
      data-testid="torneo-inscritos-list"
    >
      <header className="flex items-center justify-between border-b border-light bg-subtle px-4 py-3">
        <h3 className="font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-dark">
          {mostrarPredicciones
            ? "Combinadas enviadas"
            : "Jugadores inscritos"}
        </h3>
        <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-muted-d">
          {total} {total === 1 ? "jugador" : "jugadores"}
        </span>
      </header>

      <ul className="divide-y divide-light">
        {inscritos.map((i) => (
          <InscritoRow
            key={i.usuarioId}
            inscrito={i}
            mostrarPredicciones={mostrarPredicciones}
            equipoLocal={equipoLocal}
            equipoVisita={equipoVisita}
          />
        ))}
      </ul>

      {!showingAll && total > inscritos.length && (
        <div className="border-t border-light bg-card px-4 py-3 text-center">
          <Link
            href={`/torneo/${torneoId}?inscritosPage=all`}
            className="text-[13px] font-bold text-brand-blue-main hover:underline"
          >
            Ver todos los {total} jugadores →
          </Link>
        </div>
      )}
    </section>
  );
}

function InscritoRow({
  inscrito,
  mostrarPredicciones,
  equipoLocal,
  equipoVisita,
}: {
  inscrito: InscritoInfo;
  mostrarPredicciones: boolean;
  equipoLocal: string;
  equipoVisita: string;
}) {
  const nivel = calcularNivel(inscrito.torneosJugados);
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar handle={inscrito.handle} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-dark">
            <span>@{inscrito.handle}</span>
            <span
              aria-label={`Nivel ${nivel.label}`}
              title={`Nivel ${nivel.label}`}
              className="inline-flex items-center gap-0.5 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-muted-d"
            >
              <span aria-hidden>{nivel.emoji}</span> {nivel.label}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-d">
            {inscrito.tickets.length}{" "}
            {inscrito.tickets.length === 1 ? "combinada" : "combinadas"} ·{" "}
            {inscrito.torneosJugados}{" "}
            {inscrito.torneosJugados === 1 ? "torneo jugado" : "torneos jugados"}
          </div>
        </div>
        {mostrarPredicciones && (
          <div className="flex-shrink-0 text-right">
            <div className="font-display text-[16px] font-black text-dark">
              {inscrito.tickets.reduce((acc, t) => acc + t.puntosTotal, 0)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
              Puntos
            </div>
          </div>
        )}
      </div>

      {mostrarPredicciones && (
        <div className="mt-2.5 space-y-1.5" data-testid="inscrito-predicciones">
          {inscrito.tickets.map((t, idx) => (
            <TicketChipsRow
              key={t.ticketId}
              ticket={t}
              equipoLocal={equipoLocal}
              equipoVisita={equipoVisita}
              index={idx + 1}
              totalTickets={inscrito.tickets.length}
            />
          ))}
        </div>
      )}
    </li>
  );
}

function TicketChipsRow({
  ticket,
  equipoLocal,
  equipoVisita,
  index,
  totalTickets,
}: {
  ticket: InscritoInfo["tickets"][number];
  equipoLocal: string;
  equipoVisita: string;
  index: number;
  totalTickets: number;
}) {
  const p = ticket.predicciones;
  const d = ticket.puntosDetalle;
  if (!p) return null;

  const label1x2 =
    p.predResultado === "LOCAL"
      ? cortoNombre(equipoLocal)
      : p.predResultado === "VISITA"
        ? cortoNombre(equipoVisita)
        : "Empate";

  const chips: Array<{ label: string; correcto: boolean }> = [
    { label: label1x2, correcto: d.resultado > 0 },
    { label: `Ambos ${p.predBtts ? "Sí" : "No"}`, correcto: d.btts > 0 },
    { label: `+2.5 ${p.predMas25 ? "Sí" : "No"}`, correcto: d.mas25 > 0 },
    { label: `Roja ${p.predTarjetaRoja ? "Sí" : "No"}`, correcto: d.tarjeta > 0 },
    {
      label: `${p.predMarcadorLocal}-${p.predMarcadorVisita}`,
      correcto: d.marcador > 0,
    },
  ];

  return (
    <div className="rounded-sm bg-subtle px-2.5 py-2">
      <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.06em] text-muted-d">
        <span>
          Ticket {index} de {totalTickets}
        </span>
        <span className="font-display text-[11px] font-black text-dark">
          {ticket.puntosTotal} pts
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c, i) => (
          <span
            key={i}
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              c.correcto
                ? "bg-pred-correct-bg text-pred-correct"
                : "bg-pred-wrong-bg text-pred-wrong"
            }`}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Avatar({ handle }: { handle: string }) {
  const initials = handle.slice(0, 2).toUpperCase();
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-hero-blue font-display text-[13px] font-black text-white shadow-sm"
    >
      {initials}
    </div>
  );
}

function cortoNombre(nombre: string): string {
  const n = nombre.trim();
  if (n.length <= 10) return n;
  return n.split(/\s+/)[0] ?? n.slice(0, 8);
}
