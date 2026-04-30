# Perfil público `/comunidad/[username]`

Vista pública del perfil de un tipster. Es lo que otros usuarios ven cuando hacen click en un nombre del leaderboard. Incluye stats agregadas, últimas predicciones y indicador de Premium.

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/comunidad/[username]/page.tsx` (Lote 11): lookup case-insensitive del username + 6 stats + últimas 10 predicciones + JSON-LD `Person`.
- `apps/web/lib/services/perfil-publico.service.ts` (Lote 11): `obtenerPerfilPublico(username)`.

## Cambios necesarios

Refactor visual mobile-first + agregado de badge Premium si el tipster es suscriptor + acción "Seguir tipster" (lógica básica para el modelo v3.1).

### Archivos a modificar

- `apps/web/app/(main)/comunidad/[username]/page.tsx`:
  - Mantener lookup case-insensitive y `notFound()` si username no existe o si `usuario.perfilPublico === false`.
  - Mantener JSON-LD `Person`.
  - Agregar query para detectar si el tipster es Premium activo: `prisma.suscripcion.findFirst({ usuarioId, activa: true })`.
  - Agregar query para "¿Yo (viewer) sigo a este tipster?" (depende del modelo `Seguidor`, ver más abajo).

- `apps/web/lib/services/perfil-publico.service.ts`:
  - Mantener funcionalidad existente.
  - Agregar campo `esPremium: boolean` al return.
  - Agregar `count: { seguidores: number }` al return (placeholder en Lote C, real en Lote post-launch).

### Archivos a crear

- `apps/web/components/comunidad/PerfilPublicoHero.tsx`:
  - Hero con avatar grande + username + badge Premium si aplica + nivel + ubicación opcional.
  - Botón "Seguir" (sticky) — lógica básica en Lote C, integración real con notificaciones en Lote post-launch.
  - Botón "Reportar" (overflow menu) que abre modal con form simple.

- `apps/web/components/comunidad/PerfilPublicoStats.tsx`:
  - Grid 2x3 con las 6 stats canónicas:
    1. Predicciones totales
    2. Aciertos
    3. % Acierto
    4. Mejor mes (puntos)
    5. Pos. histórica (mejor pos. lograda)
    6. Nivel actual

- `apps/web/components/comunidad/UltimasPredicciones.tsx`:
  - Lista de las últimas 10 predicciones del tipster (públicas).
  - Cada item: partido + predicción simplificada + resultado (win/lose/pending).
  - Si la cuenta tiene `perfilPublico === false`: ocultar lista o mostrar empty state.

- `apps/web/components/comunidad/SeguirButton.tsx`:
  - Botón con estado: "+ Seguir" (no sigue) o "✓ Siguiendo" (ya sigue).
  - Integración: POST/DELETE `/api/v1/seguidores/:tipsterId`.
  - Si user no auth: linkea a `/auth/signin`.

### Modelo de BD nuevo (opcional Lote C, definitivo Lote post-launch)

`Seguidor`:
- `seguidorId` (FK → Usuario.id)
- `seguidoId` (FK → Usuario.id)
- `creadoEn`

Pieza simple. Si Lote C tiene tiempo: implementar. Si no: dejar el botón "Seguir" como placeholder visual + log warn al click.

### Endpoints nuevos (opcional Lote C)

- `POST /api/v1/seguidores/:tipsterId` — crea fila en `Seguidor` o devuelve 409 si ya existe.
- `DELETE /api/v1/seguidores/:tipsterId` — elimina fila.

### Archivos a eliminar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/(main)/comunidad/[username]/page.tsx
export const dynamic = 'force-dynamic';

export default async function PerfilPublicoPage({ params }: { params: { username: string } }) {
  const session = await auth();
  const viewerId = session?.user?.id ?? null;

  const perfil = await obtenerPerfilPublico(params.username);
  if (!perfil) notFound();

  // Premium activo
  const esPremium = await prisma.suscripcion.findFirst({
    where: { usuarioId: perfil.usuarioId, activa: true },
  }).then((s) => !!s);

  // ¿Yo lo sigo?
  const yoLoSigo = viewerId
    ? await prisma.seguidor.findFirst({
        where: { seguidorId: viewerId, seguidoId: perfil.usuarioId },
      }).then((s) => !!s)
    : false;

  return (
    <PerfilPublicoView
      perfil={perfil}
      esPremium={esPremium}
      yoLoSigo={yoLoSigo}
      viewerId={viewerId}
    />
  );
}
```

## Estados de UI

### Estructura

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ <PerfilPublicoHero>              │
│   - Avatar + username + badge    │
│   - Nivel + posición histórica   │
│   - <SeguirButton>               │
├──────────────────────────────────┤
│ <PerfilPublicoStats> 6 stats     │
├──────────────────────────────────┤
│ Section "📊 Últimas predicciones"│
│   - <UltimasPredicciones>        │
├──────────────────────────────────┤
│ Section "🏆 Mejor en..."         │
│   - Top mejores ligas/mercados   │
│   - Solo si N predicciones >20   │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Estados de UI

#### Tipster con perfil público activo
- Renderiza todo lo de arriba.

#### Tipster con `perfilPublico === false`
- `notFound()` (404).

#### Tipster es el viewer mismo
- Botón "Seguir" reemplazado por botón "Editar perfil" → `/perfil`.

#### Tipster es Premium activo
- Badge `💎 PREMIUM` junto al username.
- Stats con tooltip "Suscriptor con acceso a picks Premium".

#### Sin predicciones aún (cuenta nueva)
- Stats todos en 0.
- Sección "Últimas predicciones" muestra empty state "Aún sin predicciones".

### Loading / Error

- Server component → render directo.
- Si username no existe: `notFound()`.
- Si user revoca `perfilPublico` en su `/perfil`: este recurso vuelve 404 inmediatamente.

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<Avatar>`, `<Badge>`, `<Card>`, `<Button>` del design system base.
- `<Modal>` o `<BottomSheet>` para form de reporte.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- JSON-LD `Person` se mantiene (Lote 11).
- Si modelo `Seguidor` no se implementa en Lote C: el botón es placeholder.
- Touch targets ≥44px.
- Cero hex hardcodeados.

## Mockup de referencia

Sin mockup individual. Patrón similar a `perfil.html` del Paquete 4A pero más compacto (sin secciones de configuración, sólo stats + predicciones).

## Pasos manuales para Gustavo post-deploy

**Si Claude Code agrega el modelo `Seguidor`:** se ejecuta migración Prisma automática en deploy de Railway. NO requiere acción manual de Gustavo.

**Validación post-deploy:**
1. Logueado, abrir cualquier `hablaplay.com/comunidad/[username]` desde el leaderboard.
2. Verificar hero con avatar + stats + botón seguir.
3. Verificar las 6 stats con números reales.
4. Verificar últimas predicciones públicas.
5. Si el usuario tiene Premium: verificar badge `💎 PREMIUM`.
6. Click "+ Seguir" → debe registrar (verificar en BD si hay query directa).
7. Refresh → botón debe mostrar "✓ Siguiendo".

---

*Versión 1 · Abril 2026 · Perfil público para Lote C*
