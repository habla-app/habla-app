// Tipos compartidos de tickets (predicciones)

export type ResultadoPred = "LOCAL" | "EMPATE" | "VISITA";

export interface TicketInput {
  predResultado: ResultadoPred;
  predBtts: boolean;
  predMas25: boolean;
  predTarjetaRoja: boolean;
  predMarcadorLocal: number;
  predMarcadorVisita: number;
}

export interface TicketConPuntos extends TicketInput {
  id: string;
  puntosTotal: number;
  puntosResultado: number;
  puntosBtts: number;
  puntosMas25: number;
  puntosTarjeta: number;
  puntosMarcador: number;
  posicionFinal: number | null;
  premioLukas: number;
}
