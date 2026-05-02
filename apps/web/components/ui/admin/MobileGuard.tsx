"use client";

// MobileGuard — bloquea pista admin en pantallas < 1024px. v3.1 (Lote A).
// Spec: docs/ux-spec/00-design-system/componentes-admin.md §1
// (AdminScreenTooSmall) + regla dura 13 del CLAUDE.md ("Desktop-only para
// pista admin (1280px+, mobile bloqueado con <MobileGuard>)").
//
// Comportamiento:
// - Detecta innerWidth con un effect + listener de resize.
// - Si width < breakpoint (default 1024px), oculta children y muestra
//   pantalla de "Pantalla muy pequeña" con instrucciones.
// - SSR: render inicial muestra children (asume desktop) hasta que el
//   effect mida. Esto evita flash de "muy pequeña" en redirects desde
//   desktop. Trade-off: dispositivos mobile real ven 1 frame de admin
//   antes del block — aceptable porque el operador admin opera siempre
//   desde desktop según restricción del proyecto.
//
// El uso completo se cablea en el Lote F: `app/admin/layout.tsx` envuelve
// los children con <MobileGuard>. En Lote A queda creado y exportado pero
// no se conecta para no romper UX actual del admin.
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

// Lote F (May 2026): el spec del v3.1 fija el breakpoint en 1280px
// (regla 13 del CLAUDE.md). Aceptamos override por prop para tests o
// usos donde 1024px sea suficiente (admin pages livianas).
const DEFAULT_BREAKPOINT = 1280;

interface MobileGuardProps {
  children: ReactNode;
  /** Breakpoint en px. Default 1024 (Tailwind `lg`). */
  minWidth?: number;
}

export function MobileGuard({
  children,
  minWidth = DEFAULT_BREAKPOINT,
}: MobileGuardProps) {
  const [tooSmall, setTooSmall] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    function check() {
      setTooSmall(window.innerWidth < minWidth);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [minWidth]);

  if (!hydrated || !tooSmall) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page p-6 text-center">
      <span aria-hidden className="mb-4 text-[48px]">
        🖥️
      </span>
      <h1 className="text-display-lg text-dark">Pantalla muy pequeña</h1>
      <p className="mt-2 max-w-sm text-body-md text-muted-d">
        El panel administrativo de Habla! está optimizado para escritorio.
        Resolución mínima: <strong>1280×768 píxeles</strong>.
      </p>
      <p className="mt-3 max-w-sm text-body-sm text-soft">
        Abrí esta página desde una laptop o monitor para continuar.
      </p>
    </div>
  );
}
