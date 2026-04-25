// Barrel export para los primitivos UI base.
// Se importan como: `import { Button, Chip, Alert, Toast, Modal } from "@/components/ui";`
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
