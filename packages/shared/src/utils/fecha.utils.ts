// Utilidades de fecha para torneos

/**
 * Calcula la hora de cierre de un torneo (5 min antes del partido)
 */
export function calcularCierre(fechaPartido: Date): Date {
  const cierre = new Date(fechaPartido);
  cierre.setMinutes(cierre.getMinutes() - 5);
  return cierre;
}

/**
 * Verifica si un torneo aun acepta inscripciones
 */
export function torneoAbierto(cierreAt: Date): boolean {
  return new Date() < cierreAt;
}
