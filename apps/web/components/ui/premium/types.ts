// Tipos compartidos del bloque Premium UI (Lote D).
//
// Forma minimal del pick que las vistas pasan al `<PickWrapper>`. Es un
// subset del modelo `PickPremium` (Lote E) — solo los campos que la UI
// necesita renderizar. El server component padre arma este objeto con un
// `select` específico de Prisma.

import type { EstadoUsuario } from "@/lib/services/estado-usuario.service";

export type PickWrapperMode = "card" | "section";

export type PickCopyVariant = "anonimo" | "free" | "ftd";

export interface PickWrapperData {
  /** ID del pick — usado para tracking. */
  id: string;
  /** Equipos del partido para el header del pick. */
  partido: {
    local: string;
    visitante: string;
  };
  /** Mercado normalizado humano (ej "BTTS Sí", "Más de 2.5 goles"). */
  mercadoLabel: string;
  /** Recomendación canónica corta (ej "Ambos anotan: SÍ"). */
  recomendacion: string;
  /** Cuota sugerida. */
  cuotaSugerida: number;
  /** Stake sugerido como fracción (0.03 = 3%). */
  stakeSugerido: number;
  /** EV+ como fracción (0.14 = +14%). Null si no calculado. */
  evPctSugerido: number | null;
  /** Razonamiento textual completo. Para Premium se muestra sin blur, para
   *  bloqueado se blurea un preview. */
  razonamiento: string;
  /** Casa con mejor cuota (opcional, picks pueden no tener mapping). */
  casa: {
    nombre: string;
    slug: string;
  } | null;
}

export interface PickWrapperProps {
  /** Pick ya cargado por el server component padre. Null si no hay pick
   *  aprobado para este contexto (Lote E pendiente o sin pick del día). */
  pick: PickWrapperData | null;
  /** Estado del usuario detectado server-side. */
  estadoUsuario: EstadoUsuario;
  /** Variante visual: card (compacta) o section (full). */
  mode?: PickWrapperMode;
  /** Source para tracking (`home`, `partido`, `blog`, `torneo`). */
  utmSource: string;
  /** Email del usuario (para watermark si Premium). */
  email?: string | null;
}

export function copyVariantFromEstado(
  estado: EstadoUsuario,
): PickCopyVariant {
  if (estado === "anonimo") return "anonimo";
  if (estado === "ftd") return "ftd";
  return "free";
}
