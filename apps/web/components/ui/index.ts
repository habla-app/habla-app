// Barrel exports — `@/components/ui` v3.1 (Lote A). Permite imports limpios:
//   import { Button, Card, Badge, Avatar } from "@/components/ui";
//
// Componentes Lotes 0-11 que ya estaban en uso productivo se reexportan
// tal cual. Componentes nuevos del Lote A (Card, Badge, Spinner, Skeleton,
// Avatar, Divider, IconButton, Input) extienden el set sin romper ningún
// caller existente — los Lotes B-J los consumen vía esta barrel o vía
// import directo.

// Lotes previos (existentes)
export {
  Button,
  buttonClassName,
  BUTTON_BASE,
  BUTTON_VARIANTS,
  BUTTON_SIZES,
} from "./Button";
export type { ButtonVariant, ButtonSize } from "./Button";

export { Chip, chipClassName, CHIP_BASE, CHIP_NEUTRAL, CHIP_ACTIVE } from "./Chip";

export { Alert } from "./Alert";

export { ToastProvider, useToast } from "./Toast";

export { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";

export { HorizontalScrollChips } from "./HorizontalScrollChips";

// Lote A v3.1 — átomos nuevos
export { Card } from "./Card";
export type { CardVariant, CardPadding } from "./Card";

export { Badge } from "./Badge";
export type { BadgeVariant, BadgeSize } from "./Badge";

export { Spinner } from "./Spinner";
export type { SpinnerSize } from "./Spinner";

export { Skeleton } from "./Skeleton";
export type { SkeletonVariant } from "./Skeleton";

export { Avatar } from "./Avatar";
export type { AvatarSize } from "./Avatar";

export { Divider } from "./Divider";
export type { DividerVariant } from "./Divider";

export { IconButton } from "./IconButton";
export type { IconButtonVariant, IconButtonSize } from "./IconButton";

export { Input } from "./Input";
export type { InputSize, InputState } from "./Input";
