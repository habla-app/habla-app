// showToast — helper canónico v3.1 para notificaciones efímeras (Lote H).
//
// Wrapper sobre `sonner` con 4 severidades + auto-dismiss según severidad
// (regla del Lote H):
//   success  3s
//   info     4s
//   warning  5s
//   error    6s
//
// Los mensajes deben ser cortos (max 60 chars en línea principal, max 100
// chars total). Usar `description` para texto de soporte que NO es crítico.
//
// Uso:
//   import { showToast } from "@/lib/toast";
//   showToast.success("Predicción guardada");
//   showToast.error("Tu tarjeta fue rechazada", { duration: 8000 });
//   showToast.success("Pick aprobado", {
//     action: { label: "Ver pick", onClick: () => router.push(...) }
//   });
//
// Backward-compat: el hook legacy `useToast()` (en components/ui/Toast.tsx)
// sigue funcionando y delega acá — mismo bus de toasts. Los nuevos call
// sites deberían usar `showToast` directamente.

import { toast as sonnerToast, type ExternalToast } from "sonner";
import { track } from "@/lib/analytics";

const DURATIONS = {
  success: 3000,
  info: 4000,
  warning: 5000,
  error: 6000,
} as const;

export interface ToastOpts {
  description?: string;
  duration?: number;
  /** Botón de acción opcional (ej: "Ver", "Reintentar"). */
  action?: { label: string; onClick: () => void };
  /** Id estable — sonner reusa el mismo toast si llega un mismo id. Útil
   *  para evitar duplicados en double-click. */
  id?: string | number;
  /** Se invoca al cerrar (manualmente o por timeout). */
  onDismiss?: () => void;
}

function toExternal(
  severidad: keyof typeof DURATIONS,
  opts?: ToastOpts,
): ExternalToast {
  const ext: ExternalToast = {
    duration: opts?.duration ?? DURATIONS[severidad],
    description: opts?.description,
    id: opts?.id,
    onDismiss: opts?.onDismiss,
  };
  if (opts?.action) {
    ext.action = {
      label: opts.action.label,
      onClick: () => {
        try {
          opts.action!.onClick();
        } finally {
          // Fire-and-forget: trackear que el usuario clickeó la acción.
          // Se descarta si el cliente no consintió analítica.
          void track("toast_accion_clickeada", {
            label: opts.action!.label,
            severidad,
          });
        }
      },
    };
  }
  return ext;
}

function trackVisto(severidad: keyof typeof DURATIONS, mensaje: string) {
  // Trim del mensaje en analytics — texto literal sólo si es corto, para
  // poder agrupar en el dashboard sin filtrar por substring.
  const triggerKey = mensaje.length > 60 ? mensaje.slice(0, 60) : mensaje;
  void track("toast_visto", { severidad, trigger: triggerKey });
}

export const showToast = {
  success(mensaje: string, opts?: ToastOpts): string | number {
    trackVisto("success", mensaje);
    return sonnerToast.success(mensaje, toExternal("success", opts));
  },
  info(mensaje: string, opts?: ToastOpts): string | number {
    trackVisto("info", mensaje);
    return sonnerToast.info(mensaje, toExternal("info", opts));
  },
  warning(mensaje: string, opts?: ToastOpts): string | number {
    trackVisto("warning", mensaje);
    return sonnerToast.warning(mensaje, toExternal("warning", opts));
  },
  error(mensaje: string, opts?: ToastOpts): string | number {
    trackVisto("error", mensaje);
    return sonnerToast.error(mensaje, toExternal("error", opts));
  },
  /** Toast persistente — duración Infinity, requiere acción manual. */
  persistent(
    mensaje: string,
    severidad: keyof typeof DURATIONS = "info",
    opts?: ToastOpts,
  ): string | number {
    trackVisto(severidad, mensaje);
    const ext = toExternal(severidad, { ...opts, duration: Infinity });
    return sonnerToast[severidad](mensaje, ext);
  },
  /** Cancela un toast por id. */
  dismiss(id?: string | number): void {
    sonnerToast.dismiss(id);
  },
  /** Toast de promesa — actualiza solo cuando el promise resuelve. */
  promise: sonnerToast.promise,
} as const;

export type ShowToast = typeof showToast;
