// Constantes de keys de Redis
// Patron: dominio:subtipo:id

export const REDIS_KEYS = {
  ranking: (torneoId: string) => `ranking:${torneoId}`,
  partidoEstado: (externalId: string) => `partido:estado:${externalId}`,
  torneoInscritos: (torneoId: string) => `torneo:inscritos:${torneoId}`,
  sesionUsuario: (userId: string) => `session:${userId}`,
} as const;
