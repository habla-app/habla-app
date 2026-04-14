// Sistema de puntuacion por prediccion
// Estos valores son INAMOVIBLES segun las reglas de negocio

export const PUNTOS = {
  RESULTADO: 3, // Acertar Local/Empate/Visita
  BTTS: 2, // Acertar si ambos equipos anotan
  MAS_25_GOLES: 2, // Acertar mas de 2.5 goles
  TARJETA_ROJA: 6, // Acertar si habra tarjeta roja
  MARCADOR_EXACTO: 8, // Acertar marcador exacto
} as const;

export const MAX_PUNTOS_TICKET = 21; // Suma de todos los puntos posibles
