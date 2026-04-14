// Tipos compartidos de torneos entre frontend y backend

export type TipoTorneo = "EXPRESS" | "ESTANDAR" | "PREMIUM" | "GRAN_TORNEO";

export type EstadoTorneo =
  | "ABIERTO"
  | "CERRADO"
  | "EN_JUEGO"
  | "FINALIZADO"
  | "CANCELADO";

export interface TorneoResumen {
  id: string;
  nombre: string;
  tipo: TipoTorneo;
  entradaLukas: number;
  estado: EstadoTorneo;
  totalInscritos: number;
  pozoBruto: number;
  pozoNeto: number;
  cierreAt: string;
  partido: {
    equipoLocal: string;
    equipoVisita: string;
    liga: string;
    fechaInicio: string;
  };
}
