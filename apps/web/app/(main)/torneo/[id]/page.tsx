// Detalle de torneo: inscripcion, envio de tickets, ranking en vivo
// TODO: Sprint 3/4/5 - Implementar vista completa del torneo
export default function TorneoDetallePage({
  params,
}: {
  params: { id: string };
}) {
  return <h1>Torneo {params.id}</h1>;
}
