# Componentes Base — Habla! v3.1

Átomos compartidos entre pista usuario (mobile) y pista admin (desktop). Cada átomo tiene variantes para los dos contextos.

## Ubicación en el repo

```
apps/web/components/ui/
├── Button.tsx           ← Compartido, con variantes
├── IconButton.tsx       ← Compartido
├── Input.tsx            ← Compartido
├── Textarea.tsx         ← Compartido
├── Select.tsx           ← Compartido
├── Checkbox.tsx         ← Compartido
├── RadioGroup.tsx       ← Compartido
├── Toggle.tsx           ← Compartido (switch)
├── Badge.tsx            ← Compartido
├── Card.tsx             ← Compartido, con variantes
├── Modal.tsx            ← Existe (Lote 0). Conservar.
├── Toast.tsx            ← Compartido
├── Skeleton.tsx         ← Compartido
├── Spinner.tsx          ← Compartido
├── Avatar.tsx           ← Compartido
├── Divider.tsx          ← Compartido
└── Tooltip.tsx          ← Solo desktop (admin)
```

## 1. `<Button>` — Botón base

Variantes: `gold`, `blue`, `dark`, `outline`, `ghost`, `whatsapp`, `danger`.
Tamaños: `xl` (mobile sticky CTA), `lg`, `md`, `sm` (admin denso).

```tsx
// apps/web/components/ui/Button.tsx
import { cn } from '@/lib/utils/cn';
import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'gold' | 'blue' | 'dark' | 'outline' | 'ghost' | 'whatsapp' | 'danger';
type ButtonSize = 'xl' | 'lg' | 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  gold: 'bg-brand-gold text-brand-blue-dark shadow-gold-cta active:shadow-gold-btn hover:brightness-105',
  blue: 'bg-brand-blue-main text-white hover:bg-brand-blue-light',
  dark: 'bg-brand-blue-dark text-brand-gold hover:bg-brand-blue-pale',
  outline: 'bg-transparent text-brand-blue-dark border-1.5 border-strong hover:bg-hover',
  ghost: 'bg-subtle text-brand-blue-dark hover:bg-hover',
  whatsapp: 'bg-whatsapp-green text-white hover:bg-whatsapp-green-dark',
  danger: 'bg-status-red text-white hover:brightness-95',
};

const sizeClasses: Record<ButtonSize, string> = {
  xl: 'h-14 px-6 text-display-xs touch-target rounded-md',
  lg: 'h-12 px-5 text-body-md font-bold rounded-md',
  md: 'h-11 px-4 text-body-md font-semibold rounded-sm touch-target',  // ≥44px en mobile
  sm: 'h-8 px-3 text-body-sm font-semibold rounded-sm',                 // Admin denso
};

export function Button({
  variant = 'blue',
  size = 'md',
  fullWidth = false,
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-all duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}
```

**Variantes en uso por contexto:**

| Variante | Pista usuario | Pista admin |
|---|---|---|
| `gold` | CTA principal (Liga, Premium, Apostar) | Acción primaria del flujo (Aprobar pick, Enviar newsletter) |
| `blue` | CTA secundario | Acción secundaria |
| `dark` | CTA en sticky bar dorado/oscuro | Raro |
| `outline` | Acción opcional | Cancelar, secundario |
| `ghost` | Mini-CTAs en cards | Filtros, acciones de tabla |
| `whatsapp` | Solo en flujos Premium | Solo en flujos de gestión Channel |
| `danger` | Eliminar cuenta, cancelar suscripción | Eliminar registro, rechazar pick |

## 2. `<IconButton>` — Botón solo ícono

Para acciones secundarias en mobile (compartir, bookmark) y filas densas en admin (editar, eliminar).

```tsx
interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'solid';
  ariaLabel: string;  // Obligatorio para accesibilidad
  icon: ReactNode;
}
```

Tamaños: `sm` (32px, admin), `md` (40px, ambos), `lg` (48px, mobile sticky).

## 3. `<Input>` — Input de texto

Variantes: default, error, success.
Tamaños: `lg` (mobile), `md` (admin estándar), `sm` (admin denso).

```tsx
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  size?: 'lg' | 'md' | 'sm';
  state?: 'default' | 'error' | 'success';
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}
```

**Estilos por tamaño:**

```
lg (mobile): h-12, px-4, text-body-md, rounded-md, touch-target
md (admin):  h-10, px-3, text-admin-body, rounded-sm
sm (admin):  h-8,  px-2.5, text-admin-body, rounded-sm
```

## 4. `<Textarea>`

Similar a `<Input>` pero con `min-h` configurable. En mobile usa `rows={4}` por defecto, en admin `rows={3}`.

## 5. `<Select>` — Select nativo estilizado

En mobile usa `<select>` nativo (mejor UX en celular: muestra picker del SO).
En admin (desktop) puede usar select custom con dropdown propio para casos avanzados (búsqueda, multi-select), pero el default es nativo también.

## 6. `<Checkbox>` y `<RadioGroup>`

Touch target 44px en mobile (incluye padding clickeable alrededor del input). En admin 24px sin padding extra.

## 7. `<Toggle>` (switch on/off)

```tsx
interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}
```

Estilo: pista de fondo gris al off, dorado al on. Animación con `transition-all duration-200`.

## 8. `<Badge>` — Píldora de estado

Variantes:
- `gold`: ★ MEJOR CUOTA, ⭐ DESTACADO
- `urgent-critical`: Cierra en 8 min
- `urgent-high`: Mañana 3pm
- `info`: Verificada MINCETUR
- `success`: Activa, Pagado
- `warning`: Pendiente
- `danger`: Cancelada
- `live`: ● EN VIVO (con `animate-pulse`)
- `premium`: 💎 PREMIUM (gradiente dorado)

Tamaños: `sm` (10px, mobile chip mini), `md` (12px, admin estándar), `lg` (14px, mobile prominente).

```tsx
<Badge variant="gold" size="md">★ Mejor cuota</Badge>
<Badge variant="live" size="sm">● EN VIVO</Badge>
<Badge variant="premium" size="md">💎 Premium</Badge>
```

## 9. `<Card>` — Contenedor base

Variantes:
- `default`: bg-card + border-light + shadow-sm
- `elevated`: bg-card + shadow-md (sin border)
- `urgent-critical`: bg-mcard-critical (gradiente) + border-urgent-critical
- `urgent-high`: bg-mcard-high + border-urgent-high
- `premium`: bg-premium-card-gradient + border-premium-border (oscuro con dorado)
- `outline`: bg-transparent + border-strong (admin)
- `flat`: bg-subtle + sin border (admin secciones)

Padding por defecto: `p-4` mobile, `p-3` admin denso, `p-6` admin spacious.

## 10. `<Modal>` (existe — Lote 0)

Conservar. Renderiza con `createPortal(document.body)`. Mobile bottom-sheet, desktop centered.

## 11. `<Toast>` — Notificación temporal

Aparece desde el top con `animate-toast-in`. Duración default 4s. Variantes según `<Badge>`.

```tsx
toast.success('Predicción enviada');
toast.error('No pudimos cargar las cuotas');
toast.warning('Tu sesión expira en 5 min');
toast.info('Pick Premium nuevo en el Channel');
```

## 12. `<Skeleton>` — Placeholder durante loading

Animación `shimmer`. Variantes:
- `text`: 1 línea horizontal
- `lines`: N líneas (prop `count`)
- `circle`: avatar
- `rect`: rectángulo (card, image)

```tsx
<Skeleton variant="text" />
<Skeleton variant="lines" count={3} />
<Skeleton variant="rect" className="h-32 w-full" />
```

## 13. `<Spinner>` — Indicador de carga

Tamaños: `xs` (12px), `sm` (16px), `md` (24px), `lg` (32px). Color heredado de contexto.

## 14. `<Avatar>` — Foto/iniciales del usuario

Tamaños: `xs` (24px), `sm` (32px), `md` (40px), `lg` (56px), `xl` (80px, perfil hero).
Si no hay foto, render con iniciales sobre `bg-gold-diagonal`.

```tsx
<Avatar name="Juan Martínez" size="md" />  // → "JM" en dorado
<Avatar src="/avatar.jpg" size="lg" />
```

## 15. `<Divider>` — Separador

Variantes:
- `solid`: línea simple `border-t border-light`
- `dashed`: línea punteada
- `decorative`: con texto centrado (✂ Línea de premio)

## 16. `<Tooltip>` — Solo admin desktop

```tsx
<Tooltip content="Aprueba el pick para distribuirlo al Channel" side="top">
  <IconButton icon={<CheckIcon />} ariaLabel="Aprobar" />
</Tooltip>
```

Mobile NO usa tooltips (no hay hover). En su lugar, los componentes mobile usan `helperText` o un `<HelpSheet>` desplegable.

---

## Reglas de exportación

Todos los componentes de `ui/` se exportan desde `apps/web/components/ui/index.ts`:

```ts
export * from './Button';
export * from './IconButton';
export * from './Input';
// ... etc.
```

Esto permite imports limpios:

```tsx
import { Button, Input, Card, Badge } from '@/components/ui';
```

## Reglas de testing visual

Cada componente debe tener variantes representativas en `mockup-actualizado.html` para validación visual rápida. Si Claude Code crea o modifica un componente, debe agregar/actualizar la sección correspondiente en el mockup.

## Migración desde el repo actual

| Componente actual | Acción en Lote A |
|---|---|
| `apps/web/components/ui/*` actual | Auditar uno por uno. Si cumple con esta spec, mantener. Si no, refactor con migración hacia atrás. |
| Estilos `<button className="bg-...">` dispersos | Reemplazar por `<Button variant>` cuando sea seguro. Cambios riesgosos quedan para Lotes B+. |
| `<Modal>` existente (Lote 0) | Conservar tal cual. |

El Lote A se enfoca en **agregar** componentes nuevos y **alinear** los existentes con tipografía nueva. Reescritura masiva de uso ocurre cuando los Lotes B-J reescriben las vistas.

---

*Versión 1 · Abril 2026 · Componentes base para Lote A*
