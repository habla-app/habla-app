# Auth — 5 vistas `/auth/*`

Spec consolidada de las 5 vistas de autenticación. Las 5 son simples y comparten patrones, por lo que se documentan en un único archivo.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Vistas cubiertas

| Vista | Ruta | Función |
|---|---|---|
| Sign in | `/auth/signin` | Login con Google OAuth o magic link de email |
| Sign up | `/auth/signup` | Registro nuevo con email (Google va por sign in directamente) |
| Verificar | `/auth/verificar` | Pantalla de "revisa tu email" después de magic link |
| Error | `/auth/error` | Display de errores de auth (token inválido, etc.) |
| Completar perfil | `/auth/completar-perfil` | Form post-Google OAuth para capturar username + datos faltantes |

## Estado actual del repo

- `apps/web/app/auth/layout.tsx` (Lote 0): layout aislado para auth (sin BottomNav, sin Footer global, hero centrado).
- `apps/web/app/auth/signin/page.tsx` (Lote 0): server-action `enviarMagicLink` + `<GoogleButton>`. Usa `signIn` de NextAuth.
- `apps/web/app/auth/signup/page.tsx` (Lote 0): registro con email (crea usuario antes de mandar magic link).
- `apps/web/app/auth/verificar/page.tsx` (Lote 0): pantalla "revisa tu email".
- `apps/web/app/auth/error/page.tsx` (Lote 0): error genérico con mensaje según query param.
- `apps/web/app/auth/completar-perfil/page.tsx` (Lote 0): post-Google OAuth, captura username único + acepta términos.
- `apps/web/components/auth/GoogleButton.tsx` (Lote 0): botón con icono de Google.

## Cambios necesarios

Refinamientos visuales mobile-first + agregado de motivadores conversionales según el modelo v3.1.

### Decisiones de copy y motivación

**Sign up es la conversión más importante de la pista pública** (visitante → free). El copy debe motivar registro con valor concreto:

- **Hero del signup:** *"Únete gratis a la Liga Habla! Compite por S/ 1,250 al mes"*.
- **Sub:** *"2,847 tipsters compiten gratis. Top 10 gana premios reales en efectivo cada mes."*.
- **CTAs:** "Crear cuenta con Google" (primario) y "Crear cuenta con email" (secundario).
- **Bottom note:** "Al registrarte aceptas nuestros [Términos] y [Privacidad]."

**Sign in es para usuarios que ya conocen Habla!**, copy más sobrio:

- **Hero:** *"Bienvenido de vuelta"*.
- **Sub:** *"Continúa donde lo dejaste."*.
- **CTAs:** "Ingresar con Google" (primario) y "Ingresar con email" (secundario).
- Link al pie: "¿No tienes cuenta? [Crear una gratis →]".

### Archivos a modificar

- `apps/web/app/auth/layout.tsx`:
  - Refactor visual mobile-first.
  - Background: gradient sutil navy con dorado en esquina superior derecha (no full-screen oscuro, ahora hero-style más invitador).
  - Logo Habla! centrado arriba.
  - Container del form max-width 400px centrado.
  - Padding lateral generoso en mobile.

- `apps/web/app/auth/signin/page.tsx`:
  - Mantener server-actions y lógica de NextAuth.
  - Aplicar copy de "sign in" definido arriba.
  - Reorganizar visualmente: Google button arriba (primario), separador "O", form de email abajo.
  - Si `searchParams.hint === 'no-account'`: mostrar alert info "Este email no tiene cuenta aún. [Crear cuenta →]".

- `apps/web/app/auth/signup/page.tsx`:
  - Aplicar copy motivacional de "sign up".
  - Agregar el "social proof" arriba del form (count de tipsters compitiendo este mes — query a `obtenerLeaderboardMesActual().length`).
  - Mantener server-action existente que crea usuario.

- `apps/web/app/auth/verificar/page.tsx`:
  - Hero icono email + copy "📧 Revisa tu email".
  - Sub: "Te enviamos un link mágico a [email]. Click en el botón del email para entrar."
  - Botón "Reenviar email" (después de 60s, con countdown visual).
  - Link "Cambiar de email" → vuelve a `/auth/signin`.

- `apps/web/app/auth/error/page.tsx`:
  - Mapeo de error codes a mensajes humanos:
    - `OAuthCallback` → "Hubo un problema al ingresar con Google. Inténtalo de nuevo."
    - `Verification` → "El link mágico expiró o ya fue usado. Solicita uno nuevo."
    - `AccessDenied` → "Acceso denegado. ¿Email correcto?"
    - Default → "Algo salió mal. Inténtalo de nuevo."
  - CTA "Volver a [Iniciar sesión]" → `/auth/signin`.

- `apps/web/app/auth/completar-perfil/page.tsx`:
  - Form simplificado: solo username (validación: 3-20 chars, alfanumérico + guión, único).
  - Validación inline server-side.
  - Sub copy: "Casi listo. Elige cómo te van a ver otros tipsters en el ranking."
  - CTA "Continuar →".

- `apps/web/components/auth/GoogleButton.tsx`:
  - Refactor visual al estilo design system v3.1.
  - Touch target ≥44px.
  - Icono Google oficial (svg).

### Archivos a crear

- `apps/web/components/auth/AuthHero.tsx`:
  - Hero compartido entre las 5 vistas con logo + título + subtítulo.
  - Props: `title`, `subtitle`, `icon?`.

- `apps/web/components/auth/SocialProof.tsx`:
  - Componente que muestra "X tipsters compitiendo" (número actualizado del leaderboard del mes actual).
  - Solo se renderiza en `/auth/signup`.
  - Server component, query directa a BD.

- `apps/web/components/auth/AuthFormSeparator.tsx`:
  - Separador "O" con líneas a los lados, entre el Google button y el form de email.

- `apps/web/components/auth/ResendMagicLinkButton.tsx`:
  - Botón con countdown 60s antes de poder reenviar.
  - Usa `useState` + `useEffect` para countdown.
  - Disabled mientras countdown > 0.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/auth/signup/page.tsx
import { obtenerCountTipstersMesActual } from '@/lib/services/leaderboard.service';

export default async function SignUpPage() {
  const tipstersCount = await obtenerCountTipstersMesActual();

  return (
    <SignUpView
      tipstersCount={tipstersCount}
      // ...resto de props server-action existentes
    />
  );
}
```

### Servicio nuevo

`obtenerCountTipstersMesActual()`:
- Cuenta usuarios únicos que tienen al menos 1 ticket finalizado en el mes calendario actual.
- Cachear en Redis con TTL 1h.
- Vivir en `apps/web/lib/services/leaderboard.service.ts` como función exportada adicional.
- Si Redis no disponible: query directa a BD (graceful degradation).

## Estados de UI

### Estructura común (todas las vistas auth)

```
┌──────────────────────────────────┐
│ Background gradient              │
│                                  │
│  ┌────────────────────────────┐  │
│  │      [Logo Habla!]         │  │
│  │                            │  │
│  │  <AuthHero>                │  │
│  │   - Title                  │  │
│  │   - Subtitle               │  │
│  │                            │  │
│  │  <SocialProof>             │  │  ← solo signup
│  │                            │  │
│  │  Form / Content            │  │
│  │                            │  │
│  │  Footer text/link          │  │
│  └────────────────────────────┘  │
│                                  │
└──────────────────────────────────┘
```

NO hay BottomNav ni MobileHeader en estas vistas. El layout `auth/layout.tsx` está aislado.

### Variaciones por vista

#### Sign in
- Title: "Bienvenido de vuelta"
- Sub: "Continúa donde lo dejaste."
- Content: GoogleButton → Separator "O" → Form email + button "Enviar magic link".
- Footer link: "¿No tienes cuenta? [Crear una gratis →]"

#### Sign up
- Title: "Únete gratis a la Liga Habla!"
- Sub: "Compite por S/ 1,250 al mes en premios reales"
- `<SocialProof>` arriba del form: "🔥 2,847 tipsters compitiendo este mes"
- Content: GoogleButton → Separator → Form email + button "Crear cuenta".
- Footer note: "Al registrarte aceptas [Términos] y [Privacidad]."
- Footer link: "¿Ya tienes cuenta? [Iniciar sesión →]"

#### Verificar
- Icon hero: 📧 (grande, dorado)
- Title: "Revisa tu email"
- Sub: "Te enviamos un link a [email del usuario]. Click ahí para entrar."
- `<ResendMagicLinkButton>` con countdown.
- Footer link: "[Cambiar de email →]"

#### Error
- Icon hero: ⚠️ (rojo)
- Title: "Algo salió mal"
- Sub: mensaje según error code.
- CTA: "Volver a [Iniciar sesión →]"

#### Completar perfil
- Title: "Casi listo, [nombre del Google]"
- Sub: "Elige cómo te van a ver otros tipsters en el ranking."
- Form: input "Username" (validación inline), checkbox "Aceptar términos".
- CTA: "Continuar →"

### Loading

- Forms con server-actions: button con loading state durante submit.
- Después de submit exitoso: redirect (no hay loading visible para el usuario).

### Error

- Validation errors inline bajo cada input (rojo, font-size 12).
- Errores generales: alert top del form.

### Estados según usuario

Estas vistas NO se acceden si el usuario ya está autenticado (NextAuth redirige automáticamente). No hay variantes por estado.

Excepción: `/auth/completar-perfil` solo se accede si `session && !usuario.username` (caso post-Google OAuth).

## Componentes que reutiliza

- `<Button>` (Lote A): variantes `gold`, `blue`, `outline`.
- `<Input>` (Lote A) con label, helper, error states.
- `<GoogleButton>` (Lote 0, refactor visual).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- Touch targets ≥44px en todos los botones e inputs.
- Server-actions de NextAuth se mantienen tal cual (Lote 0).
- Eventos analíticos:
  - `signup_started` en mount de `/auth/signup` (ya existe Lote 6).
  - `signup_completed` en POST exitoso (ya existe).
  - `email_verified` en sign in con magic link verificado (ya existe).
  - `profile_completed` en POST exitoso de `/auth/completar-perfil` (ya existe).
- Cero hex hardcodeados.
- Layout auth aislado (sin BottomNav ni Footer global).

## Mockup de referencia

Sin mockup individual. Los patrones visuales están bien establecidos por convenciones generales de auth (Google button, separator OR, form de email). Claude Code referencia el design system para colores y tipografía.

Si surge ambigüedad, Claude Code documenta la decisión en el reporte de cierre y mantiene consistencia con el resto del Lote B.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Abrir `hablaplay.com/auth/signin` en mobile y desktop. Verificar layout.
2. Probar Google OAuth en signin (si está logueado, debe redirigir).
3. Probar magic link en signin (si funciona en `hablaplay.com`).
4. Abrir `/auth/signup` y verificar el `<SocialProof>` con count real.
5. Forzar URL `/auth/error?error=Verification` y verificar mensaje custom.

---

*Versión 1 · Abril 2026 · Auth para Lote B*
