"use client";
// useComboOpener — hook compartido por los 3 puntos que abren el
// ComboModal desde un click (MatchCardCTA, ComboLauncher, AutoOpenComboFromQuery).
//
// Centraliza: fetch del torneo + mapping a ComboTorneoInfo + state del
// modal (loading/error/open). Cada consumer rendera su propio botón y el
// ComboModal, usando los props que devuelve este hook.

import { useCallback, useState } from "react";
import {
  buildComboTorneoInfo,
  type TorneoApiResponse,
} from "@/components/combo/combo-info.mapper";
import { authedFetch } from "@/lib/api-client";
import type { ComboTorneoInfo } from "@/components/combo/ComboModal";

interface State {
  open: boolean;
  loading: boolean;
  torneoInfo: ComboTorneoInfo | null;
  error: string | null;
}

const INITIAL: State = {
  open: false,
  loading: false,
  torneoInfo: null,
  error: null,
};

export interface ComboOpener {
  /** Props directos para `<ComboModal {...modalProps} />`. */
  modalProps: {
    isOpen: boolean;
    torneo: ComboTorneoInfo | null;
    onClose: () => void;
  };
  /** Dispara fetch + abre el modal. Resuelve cuando el modal quedó listo. */
  openFor: (torneoId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function useComboOpener(): ComboOpener {
  const [state, setState] = useState<State>(INITIAL);

  const openFor = useCallback(async (torneoId: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await authedFetch(`/api/v1/torneos/${torneoId}`);
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: "No se pudo cargar el torneo.",
        }));
        return;
      }
      const payload = (await res.json()) as TorneoApiResponse;
      const info = buildComboTorneoInfo(payload);
      if (!info) {
        setState((s) => ({
          ...s,
          loading: false,
          error: "Torneo no encontrado.",
        }));
        return;
      }
      setState({ open: true, loading: false, torneoInfo: info, error: null });
    } catch {
      setState((s) => ({ ...s, loading: false, error: "Error de red." }));
    }
  }, []);

  const onClose = useCallback(() => {
    setState((s) => ({ ...s, open: false }));
  }, []);

  return {
    modalProps: {
      isOpen: state.open,
      torneo: state.torneoInfo,
      onClose,
    },
    openFor,
    loading: state.loading,
    error: state.error,
  };
}
