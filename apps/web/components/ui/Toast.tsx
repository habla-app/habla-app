"use client";

// Toast — traducido de `.toast` del mockup. Notificación flotante que aparece
// arriba-centro 80px y se auto-descarta a los 3.5s. API minimalista: un
// provider con un hook `useToast()`.
//
//   const toast = useToast();
//   toast.show("Combinada enviada ✔");
//
// El provider se monta en el root layout.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

interface ToastItem {
  id: number;
  message: string;
}

interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider />");
  }
  return ctx;
}

interface ToastProviderProps {
  children: ReactNode;
  /** Tiempo en ms antes de auto-descartar. Default 3500 del mockup. */
  durationMs?: number;
}

export function ToastProvider({
  children,
  durationMs = 3500,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const show = useCallback(
    (message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    [durationMs],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none fixed left-1/2 top-[80px] z-[700] flex -translate-x-1/2 flex-col items-center gap-2"
        >
          {toasts.map((t) => (
            <ToastBanner key={t.id} message={t.message} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

function ToastBanner({ message }: { message: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Mount: fade/slide in en el siguiente frame para que la transición corra
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2.5 rounded-md bg-brand-green px-6 py-3.5 text-[14px] font-bold text-black shadow-lg transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-6 opacity-0"
      }`}
    >
      {message}
    </div>
  );
}
