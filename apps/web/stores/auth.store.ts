// Store auxiliar para auth — complementa NextAuth guardando el torneo
// que activo el modal de login, de modo que al volver tras el magic link
// el usuario aterrice directamente en la pantalla de combinada.
import { create } from "zustand";

interface AuthStore {
  pendingTorneoId: string | null;
  setPendingTorneoId: (id: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  pendingTorneoId: null,
  setPendingTorneoId: (id) => set({ pendingTorneoId: id }),
}));
