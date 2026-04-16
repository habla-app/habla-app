// Store global de balance de Lukas.
// Se hidrata desde la sesion al cargar la app y se mantiene sincronizado
// al descontar (entrada de torneo) o sumar (compra / premio).
import { create } from "zustand";

interface LukasStore {
  balance: number;
  setBalance: (balance: number) => void;
  decrementar: (monto: number) => void;
  incrementar: (monto: number) => void;
}

export const useLukasStore = create<LukasStore>((set) => ({
  balance: 0,
  setBalance: (balance) => set({ balance }),
  decrementar: (monto) =>
    set((state) => ({ balance: Math.max(0, state.balance - monto) })),
  incrementar: (monto) =>
    set((state) => ({ balance: state.balance + monto })),
}));
