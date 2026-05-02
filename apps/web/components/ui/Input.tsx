// Input — input de texto base. v3.1 (Lote A). Spec:
// docs/ux-spec/00-design-system/componentes-base.md §3.
//
// Tamaños:
// - lg (mobile, default):  h-12, px-4, text-body-md, rounded-md, touch-target
// - md (admin estándar):   h-10, px-3, text-admin-body, rounded-sm
// - sm (admin denso):      h-8,  px-2.5, text-admin-body, rounded-sm
//
// Estados: default (border-strong), error (border urgent-critical),
// success (border alert-success-border).
//
// Slots opcionales: leftIcon, rightIcon, label arriba, helperText/errorMessage
// debajo. Cuando hay errorMessage, override del helperText.
import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type InputSize = "lg" | "md" | "sm";
export type InputState = "default" | "error" | "success";

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  inputSize?: InputSize;
  state?: InputState;
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerClassName?: string;
}

const SIZES: Record<InputSize, string> = {
  lg: "h-12 px-4 text-body-md rounded-md touch-target",
  md: "h-10 px-3 text-admin-body rounded-sm",
  sm: "h-8 px-2.5 text-admin-body rounded-sm",
};

const STATES: Record<InputState, string> = {
  default:
    "border-strong focus:border-brand-blue-main focus:ring-brand-blue-main/20",
  error:
    "border-urgent-critical focus:border-urgent-critical focus:ring-urgent-critical/20",
  success:
    "border-alert-success-border focus:border-alert-success-text focus:ring-alert-success-border/30",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    inputSize = "lg",
    state = "default",
    label,
    helperText,
    errorMessage,
    leftIcon,
    rightIcon,
    className,
    containerClassName,
    id,
    disabled,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
  const helperId = `${inputId}-helper`;
  const finalState: InputState = errorMessage ? "error" : state;
  const message = errorMessage ?? helperText;

  return (
    <div className={cn("flex flex-col gap-1.5", containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-label-md text-dark"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span
            aria-hidden
            className="absolute inset-y-0 left-3 flex items-center text-muted-d"
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={finalState === "error" || undefined}
          aria-describedby={message ? helperId : undefined}
          disabled={disabled}
          className={cn(
            "w-full border bg-app text-dark placeholder:text-soft",
            "transition-colors duration-150",
            "focus:outline-none focus:ring-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            SIZES[inputSize],
            STATES[finalState],
            leftIcon ? "pl-10" : "",
            rightIcon ? "pr-10" : "",
            className,
          )}
          {...rest}
        />
        {rightIcon && (
          <span
            aria-hidden
            className="absolute inset-y-0 right-3 flex items-center text-muted-d"
          >
            {rightIcon}
          </span>
        )}
      </div>
      {message && (
        <p
          id={helperId}
          className={cn(
            "text-body-xs",
            finalState === "error"
              ? "text-urgent-critical"
              : finalState === "success"
                ? "text-alert-success-text"
                : "text-muted-d",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
});
