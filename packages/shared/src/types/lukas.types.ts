// Tipos compartidos de Lukas (moneda virtual)

export type TipoTransaccion =
  | "COMPRA"
  | "ENTRADA_TORNEO"
  | "PREMIO_TORNEO"
  | "CANJE"
  | "BONUS"
  | "VENCIMIENTO";

export interface TransaccionResumen {
  id: string;
  tipo: TipoTransaccion;
  monto: number;
  descripcion: string;
  creadoEn: string;
}

export interface WalletInfo {
  balanceLukas: number;
  transacciones: TransaccionResumen[];
}
