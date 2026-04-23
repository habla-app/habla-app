"use client";
// AutoOpenComboFromQuery — abre el ComboModal automáticamente cuando la
// URL trae `?openCombo=<torneoId>`. Patrón del Bug #2 fix:
//
//   1. Usuario sin sesión clickea "Crear combinada" en un MatchCard.
//   2. MatchCardCTA lo manda a
//      /auth/signin?callbackUrl=/matches?openCombo=<torneoId>
//   3. Al volver post-login, Next.js renderiza /matches con el query
//      param intacto.
//   4. Este componente (montado en MatchesPageContent) lo detecta y
//      dispara el fetch + abre el modal automáticamente.
//   5. Al cerrar el modal, limpia el query param con router.replace para
//      dejar la URL limpia y no re-disparar el modal en refresh.
//
// También sirve para deep-linking legítimo (compartir
// `/matches?openCombo=<id>` abre el modal directo si el usuario está
// logueado).

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ComboModal } from "./ComboModal";
import { useComboOpener } from "@/hooks/useComboOpener";

interface Props {
  hasSession: boolean;
}

export function AutoOpenComboFromQuery({ hasSession }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const torneoId = searchParams.get("openCombo");

  const { modalProps, openFor } = useComboOpener();
  const disparadoRef = useRef<string | null>(null);

  // Auto-disparo: al montar con ?openCombo=<id> y sesión viva, corre
  // openFor una sola vez. Si no hay sesión, dejamos el query param
  // tranquilo — el flow asume que el usuario está volviendo de login y
  // la sesión ya debería estar hidratada. Si no está, el usuario queda
  // en /matches con el param pero sin modal (no-op seguro).
  useEffect(() => {
    if (!torneoId || !hasSession) return;
    if (disparadoRef.current === torneoId) return;
    disparadoRef.current = torneoId;
    void openFor(torneoId);
  }, [torneoId, hasSession, openFor]);

  const handleClose = () => {
    modalProps.onClose();
    // Limpia ?openCombo de la URL preservando otros filtros
    // (?liga=, ?dia=, etc.) — sin reload, solo reemplaza la entrada
    // del history.
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openCombo");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Si no hay torneoId en la URL, no montamos nada. Evita renderizar un
  // Modal cerrado en todas las vistas de /matches.
  if (!torneoId) return null;

  return <ComboModal {...modalProps} onClose={handleClose} />;
}
