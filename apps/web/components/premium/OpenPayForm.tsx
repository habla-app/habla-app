"use client";

// OpenPayForm — form de checkout con tokenización client-side OpenPay.js
// (Lote D). Spec: docs/ux-spec/04-pista-usuario-premium/checkout.spec.md.
//
// Reglas críticas (CLAUDE.md §14):
//   - Cero datos de tarjeta tocan el servidor de Habla!. La tokenización
//     ocurre en cliente con OpenPay.js. El backend recibe solo el token.
//   - No se persiste ningún campo del form en localStorage / sessionStorage.
//
// Flujo:
//   1. Mount: carga OpenPay.js desde el CDN oficial. Setea merchant + public
//      key. Genera el deviceSessionId anti-fraude.
//   2. User llena form. Validación inline en blur con regex simple. CVV +
//      vencimiento + número se validan contra Luhn / formato MM/AA.
//   3. Submit: llama `OpenPay.token.extractFormAndCreate()` que tokeniza el
//      form sin enviar PAN/CVV al backend. Recibe `tokenTarjeta` y
//      `deviceSessionId`.
//   4. Llama el server action `procesarCheckout({ plan, tokenTarjeta, ... })`.
//   5. Si ok: redirect a `/premium/exito?suscripcionId=...`.
//   6. Si error: muestra toast/inline error con el mensaje del banco.

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import type { PlanKey } from "@/lib/premium-planes";
import { procesarCheckout } from "@/app/(public)/premium/checkout/actions";

declare global {
  interface Window {
    OpenPay?: {
      setId: (id: string) => void;
      setApiKey: (key: string) => void;
      setSandboxMode: (sandbox: boolean) => void;
      deviceData: {
        setup: (formId: string, deviceSessionFieldId?: string) => string;
      };
      token: {
        extractFormAndCreate: (
          formId: string,
          onSuccess: (response: { data: { id: string } }) => void,
          onError: (
            error: {
              data?: {
                description?: string;
                error_code?: number;
                http_code?: number;
              };
              message?: string;
            },
          ) => void,
        ) => void;
      };
    };
    OpenPay$?: typeof window.OpenPay;
  }
}

const OPENPAY_JS_URL = "https://openpay.s3.amazonaws.com/openpay.v1.min.js";
const OPENPAY_DATA_URL =
  "https://openpay.s3.amazonaws.com/openpay-data.v1.min.js";

interface Props {
  plan: { key: PlanKey; label: string; precioSoles: number };
  /** Datos prefilled del usuario logueado. */
  usuario: { nombre: string | null; email: string };
  /** OpenPay merchant + public key del server (env). */
  openpayMerchantId: string | null;
  openpayPublicKey: string | null;
  openpayProduction: boolean;
}

interface FormState {
  nombre: string;
  documentoTipo: "DNI" | "RUC" | "CE";
  documentoNumero: string;
  telefono: string;
  cardNumber: string;
  cardName: string;
  cardExp: string;
  cardCvv: string;
}

interface FormErrors {
  nombre?: string;
  documentoNumero?: string;
  telefono?: string;
  cardNumber?: string;
  cardName?: string;
  cardExp?: string;
  cardCvv?: string;
  /** Error global del submit (tarjeta rechazada, timeout, etc). */
  global?: string;
}

const INITIAL_ERRORS: FormErrors = {};

function validar(state: FormState): FormErrors {
  const errs: FormErrors = {};
  if (!state.nombre.trim()) errs.nombre = "Tu nombre es requerido";
  if (!/^\d{6,15}$/.test(state.documentoNumero.replace(/\s/g, ""))) {
    errs.documentoNumero = "Número inválido";
  }
  // Tarjeta: 13-19 dígitos sin espacios
  const pan = state.cardNumber.replace(/\s/g, "");
  if (!/^\d{13,19}$/.test(pan)) {
    errs.cardNumber = "Número de tarjeta inválido";
  } else if (!luhn(pan)) {
    errs.cardNumber = "Número de tarjeta inválido";
  }
  if (!state.cardName.trim()) errs.cardName = "Nombre como aparece en la tarjeta";
  if (!/^\d{2}\/\d{2}$/.test(state.cardExp.trim())) {
    errs.cardExp = "Formato MM/AA";
  } else {
    const [mmStr, yyStr] = state.cardExp.split("/");
    const mm = parseInt(mmStr, 10);
    const yy = parseInt(yyStr, 10);
    if (mm < 1 || mm > 12) errs.cardExp = "Mes inválido";
    else {
      const ahora = new Date();
      const anioCorto = ahora.getFullYear() % 100;
      const mesActual = ahora.getMonth() + 1;
      if (yy < anioCorto || (yy === anioCorto && mm < mesActual)) {
        errs.cardExp = "Tarjeta vencida";
      }
    }
  }
  if (!/^\d{3,4}$/.test(state.cardCvv.trim())) errs.cardCvv = "CVV inválido";
  if (state.telefono.trim() && !/^\+?\d{7,15}$/.test(state.telefono.replace(/\s/g, ""))) {
    errs.telefono = "Teléfono inválido";
  }
  return errs;
}

/** Algoritmo de Luhn para validar número de tarjeta básico. */
function luhn(pan: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = pan.length - 1; i >= 0; i--) {
    let d = parseInt(pan[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function formatCardNumber(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function formatExp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function OpenPayForm({
  plan,
  usuario,
  openpayMerchantId,
  openpayPublicKey,
  openpayProduction,
}: Props) {
  const router = useRouter();
  const formId = useId().replace(/[:]/g, "_");
  const [isPending, startTransition] = useTransition();
  const [openpayReady, setOpenpayReady] = useState(false);
  const [openpayError, setOpenpayError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const deviceSessionRef = useRef<string | null>(null);

  const noConfigurado = !openpayMerchantId || !openpayPublicKey;

  const [form, setForm] = useState<FormState>({
    nombre: usuario.nombre ?? "",
    documentoTipo: "DNI",
    documentoNumero: "",
    telefono: "",
    cardNumber: "",
    cardName: "",
    cardExp: "",
    cardCvv: "",
  });
  const [errors, setErrors] = useState<FormErrors>(INITIAL_ERRORS);

  // Cargar OpenPay.js + openpay-data.js dinámicamente.
  useEffect(() => {
    if (noConfigurado) return;
    if (typeof window === "undefined") return;

    let mounted = true;

    const loadScript = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
          `script[src="${src}"]`,
        );
        if (existing) {
          if (existing.dataset.loaded === "true") {
            resolve();
          } else {
            existing.addEventListener("load", () => resolve());
            existing.addEventListener("error", () =>
              reject(new Error(`load ${src}`)),
            );
          }
          return;
        }
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.addEventListener("load", () => {
          s.dataset.loaded = "true";
          resolve();
        });
        s.addEventListener("error", () => reject(new Error(`load ${src}`)));
        document.head.appendChild(s);
      });

    Promise.all([loadScript(OPENPAY_JS_URL), loadScript(OPENPAY_DATA_URL)])
      .then(() => {
        if (!mounted) return;
        if (!window.OpenPay) {
          setOpenpayError(
            "OpenPay.js no se cargó correctamente. Recarga la página.",
          );
          return;
        }
        try {
          window.OpenPay.setId(openpayMerchantId!);
          window.OpenPay.setApiKey(openpayPublicKey!);
          window.OpenPay.setSandboxMode(!openpayProduction);
          // Captura el deviceSessionId — IMPORTANTE para anti-fraude.
          const sessionId = window.OpenPay.deviceData.setup(formId);
          deviceSessionRef.current = sessionId;
          setOpenpayReady(true);
        } catch (err) {
          setOpenpayError(
            "OpenPay.js falló al inicializar. Recarga la página.",
          );
          // Logging client-side prohibido — analytics no debe propagar el err.
          // El error queda visible en el form como mensaje al user.
          void err;
        }
      })
      .catch(() => {
        if (!mounted) return;
        setOpenpayError(
          "No se pudo cargar OpenPay. Verifica tu conexión y recarga.",
        );
      });

    return () => {
      mounted = false;
    };
  }, [
    formId,
    noConfigurado,
    openpayMerchantId,
    openpayProduction,
    openpayPublicKey,
  ]);

  // Warning beforeunload mientras submit está en proceso.
  useEffect(() => {
    if (!submitting) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [submitting]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((s) => ({ ...s, [k]: v }));
    if (errors[k as keyof FormErrors]) {
      setErrors((e) => ({ ...e, [k]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!openpayReady || submitting) return;

    const v = validar(form);
    if (Object.keys(v).length > 0) {
      setErrors(v);
      return;
    }
    setErrors(INITIAL_ERRORS);
    setSubmitting(true);

    const op = window.OpenPay;
    if (!op) {
      setSubmitting(false);
      setErrors({
        global: "OpenPay.js no disponible. Recarga la página.",
      });
      return;
    }

    op.token.extractFormAndCreate(
      formId,
      (response) => {
        const tokenTarjeta = response.data.id;
        const deviceSessionId = deviceSessionRef.current ?? "";

        startTransition(async () => {
          try {
            const result = await procesarCheckout({
              plan: plan.key,
              tokenTarjeta,
              deviceSessionId,
              nombre: form.nombre.trim(),
              documentoTipo: form.documentoTipo,
              documentoNumero: form.documentoNumero.trim(),
              telefono: form.telefono.trim() || null,
            });
            if (result.ok) {
              track("premium_checkout_completado_cliente", {
                plan: plan.key,
                suscripcionId: result.suscripcionId,
              });
              router.push(`/premium/exito?suscripcionId=${result.suscripcionId}`);
              return;
            }
            // Error del server (ej. ya tiene suscripción activa).
            track("premium_checkout_fallido", {
              plan: plan.key,
              codigo: result.code ?? "server_error",
            });
            setSubmitting(false);
            setErrors({
              global: result.error ?? "No pudimos procesar tu pago. Intenta de nuevo.",
            });
          } catch (err) {
            track("premium_checkout_fallido", {
              plan: plan.key,
              codigo: "exception",
            });
            setSubmitting(false);
            setErrors({
              global:
                "Hubo un problema procesando tu pago. Si tu tarjeta fue cobrada, recibirás un email.",
            });
            void err;
          }
        });
      },
      (error) => {
        setSubmitting(false);
        const desc = error.data?.description ?? error.message ?? "Tarjeta rechazada";
        track("premium_checkout_fallido", {
          plan: plan.key,
          codigo: error.data?.error_code ?? "openpay_error",
        });
        setErrors({ global: desc });
      },
    );
  };

  if (noConfigurado) {
    return (
      <div className="m-4 rounded-md border border-alert-warning-border bg-alert-warning-bg p-4 text-body-sm text-alert-warning-text">
        <p className="font-bold">⚠ Pagos aún no disponibles</p>
        <p className="mt-1 text-body-xs">
          Estamos finalizando la integración con OpenPay BBVA. Avísame cuando
          esté listo:
        </p>
        <div className="mt-2">
          <Link
            href="/suscribir?fuente=premium-checkout-waitlist"
            className="touch-target inline-flex w-full items-center justify-center rounded-md bg-brand-gold px-4 py-3 font-display text-[13px] font-extrabold uppercase text-black shadow-gold-btn transition-all hover:bg-brand-gold-light"
          >
            Avísame por email
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <form id={formId} onSubmit={handleSubmit} noValidate>
        <section className="bg-card px-4 py-4">
          <h2 className="mb-2.5 font-display text-display-xs font-bold uppercase tracking-wide text-muted-d">
            Tus datos
          </h2>

          <Field
            label="Nombre completo"
            value={form.nombre}
            onChange={(v) => setField("nombre", v)}
            error={errors.nombre}
            autoComplete="name"
          />
          <Field
            label="Email"
            value={usuario.email}
            onChange={() => {}}
            readOnly
          />
          <div className="grid grid-cols-[120px_1fr] gap-2">
            <SelectField
              label="Tipo doc."
              value={form.documentoTipo}
              onChange={(v) =>
                setField("documentoTipo", v as FormState["documentoTipo"])
              }
              options={[
                { value: "DNI", label: "DNI" },
                { value: "RUC", label: "RUC" },
                { value: "CE", label: "CE" },
              ]}
            />
            <Field
              label="Número"
              value={form.documentoNumero}
              onChange={(v) => setField("documentoNumero", v)}
              error={errors.documentoNumero}
              inputMode="numeric"
              placeholder="12345678"
            />
          </div>
          <Field
            label="WhatsApp (opcional)"
            value={form.telefono}
            onChange={(v) => setField("telefono", v)}
            error={errors.telefono}
            placeholder="+51 999 999 999"
            inputMode="tel"
            autoComplete="tel"
            helper="Te enviamos los picks 1:1 con tu watermark único"
          />
        </section>

        <section className="mt-2 bg-card px-4 py-4">
          <h2 className="mb-2.5 flex items-center gap-1 font-display text-display-xs font-bold uppercase tracking-wide text-muted-d">
            <span aria-hidden>💳</span> Tarjeta
          </h2>
          <Field
            label="Número de tarjeta"
            value={form.cardNumber}
            onChange={(v) => setField("cardNumber", formatCardNumber(v))}
            error={errors.cardNumber}
            placeholder="•••• •••• •••• ••••"
            inputMode="numeric"
            autoComplete="cc-number"
            dataOpenpayCard="card_number"
          />
          <div className="mt-1 flex justify-end gap-1.5">
            <span className="rounded-sm bg-[#1A1F71] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
              VISA
            </span>
            <span className="rounded-sm bg-[#EB001B] px-1.5 py-0.5 font-mono text-[9px] font-bold text-white">
              MC
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field
              label="Vencimiento"
              value={form.cardExp}
              onChange={(v) => setField("cardExp", formatExp(v))}
              error={errors.cardExp}
              placeholder="MM/AA"
              inputMode="numeric"
              autoComplete="cc-exp"
            />
            <Field
              label="CVV"
              value={form.cardCvv}
              onChange={(v) => setField("cardCvv", v.replace(/\D/g, "").slice(0, 4))}
              error={errors.cardCvv}
              placeholder="123"
              inputMode="numeric"
              autoComplete="cc-csc"
              dataOpenpayCard="cvv2"
            />
          </div>
          <Field
            label="Nombre como aparece en la tarjeta"
            value={form.cardName}
            onChange={(v) => setField("cardName", v.toUpperCase())}
            error={errors.cardName}
            autoComplete="cc-name"
            dataOpenpayCard="holder_name"
          />
          {/* Dos campos separados para mes/año que OpenPay.js parsea (extraer del MM/AA) */}
          <input
            type="hidden"
            data-openpay-card="expiration_month"
            value={form.cardExp.split("/")[0] ?? ""}
            readOnly
          />
          <input
            type="hidden"
            data-openpay-card="expiration_year"
            value={form.cardExp.split("/")[1] ?? ""}
            readOnly
          />
        </section>

        {openpayError ? (
          <p
            role="alert"
            className="mx-4 my-2 rounded-md border border-alert-danger-border bg-alert-danger-bg px-3 py-2 text-body-xs text-alert-danger-text"
          >
            {openpayError}
          </p>
        ) : null}

        {errors.global ? (
          <p
            role="alert"
            className="mx-4 my-2 rounded-md border border-alert-danger-border bg-alert-danger-bg px-3 py-2 text-body-xs text-alert-danger-text"
          >
            {errors.global}
          </p>
        ) : null}

        <div className="px-4 pt-2 pb-4 text-center text-body-xs text-muted-d">
          Al continuar aceptas{" "}
          <Link href="/legal/terminos" className="font-bold text-brand-blue-main hover:underline">
            Términos
          </Link>{" "}
          y{" "}
          <Link href="/legal/privacidad" className="font-bold text-brand-blue-main hover:underline">
            Privacidad
          </Link>
          . Renovación automática. Cancela cuando quieras desde tu perfil.
        </div>

        <div className="sticky bottom-[64px] z-sticky border-t border-light bg-card px-3.5 py-3 shadow-nav-top lg:bottom-4">
          <button
            type="submit"
            disabled={!openpayReady || submitting || isPending}
            className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand-gold px-4 py-3.5 font-display text-[14px] font-extrabold uppercase tracking-[0.04em] text-black shadow-premium-cta transition-all hover:-translate-y-px hover:bg-brand-gold-light disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting || isPending
              ? "Procesando..."
              : `💎 Pagar S/ ${plan.precioSoles} · Activar`}
          </button>
        </div>
      </form>

      {(submitting || isPending) ? <CheckoutLoadingOverlay /> : null}
    </>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  helper?: string;
  placeholder?: string;
  readOnly?: boolean;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "text" | "email";
  dataOpenpayCard?: string;
}

function Field({
  label,
  value,
  onChange,
  error,
  helper,
  placeholder,
  readOnly,
  autoComplete,
  inputMode,
  dataOpenpayCard,
}: FieldProps) {
  const id = useId();
  const dataAttr = dataOpenpayCard
    ? { "data-openpay-card": dataOpenpayCard }
    : {};
  return (
    <div className="mb-2.5">
      <label htmlFor={id} className="mb-1 block text-body-xs font-semibold text-dark">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={!!error || undefined}
        className={`w-full rounded-md border-2 bg-card px-3.5 text-body-md font-medium text-dark placeholder:text-soft focus:outline-none focus:ring-2 focus:ring-brand-blue-main/20 h-12 ${
          readOnly
            ? "bg-subtle text-muted-d"
            : error
              ? "border-urgent-critical focus:border-urgent-critical"
              : "border-light focus:border-brand-blue-main"
        }`}
        {...dataAttr}
      />
      {(error || helper) && (
        <p
          className={`mt-1 text-body-xs ${
            error ? "text-urgent-critical" : "text-muted-d"
          }`}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}

function SelectField({ label, value, onChange, options }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="mb-2.5">
      <label htmlFor={id} className="mb-1 block text-body-xs font-semibold text-dark">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-md border-2 border-light bg-card px-3.5 text-body-md font-medium text-dark focus:border-brand-blue-main focus:outline-none focus:ring-2 focus:ring-brand-blue-main/20"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CheckoutLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-modal flex flex-col items-center justify-center gap-4 bg-brand-blue-dark/90 px-6 text-center text-white backdrop-blur-md"
    >
      <div
        aria-hidden
        className="h-12 w-12 animate-spin rounded-full border-4 border-white/20 border-t-brand-gold"
      />
      <h2 className="font-display text-display-md font-extrabold uppercase">
        Procesando tu suscripción
      </h2>
      <p className="max-w-[280px] text-body-sm text-white/70">
        Esto puede tomar unos segundos. No cierres esta pestaña.
      </p>
    </div>
  );
}
