# Perfil `/perfil`

Perfil del usuario autenticado. Vista compleja con múltiples secciones (stats, accesos rápidos, datos, notificaciones, configuración, eliminar cuenta). En v3.1 incorpora estado Premium y casas conectadas.

## Lote responsable

**Lote C** — Reauditoría móvil de la capa autenticada.

## Estado actual del repo

- `apps/web/app/(main)/perfil/page.tsx` (Lote 11): rediseño con 8 secciones (Header, ProfileHero, StatsGrid 6 stats, QuickAccessGrid 4 cards, VerificacionSection, DatosSection, NotificacionesSection, FooterSections).
- `apps/web/components/perfil/*` (Lote 11): todos los components que componen las secciones.

## Cambios necesarios

Refactor mobile-first + dos secciones nuevas: **Estado Premium** y **Mis casas conectadas** (cross-sell). El resto se conserva con refinamiento visual.

### Archivos a modificar

- `apps/web/app/(main)/perfil/page.tsx`:
  - Mantener estructura de carga de datos.
  - Agregar 2 queries nuevas:
    - `obtenerEstadoPremium(userId)` → devuelve `{ activa, plan, proximoCobro, channelLink }` o `null`.
    - `obtenerCasasConectadas(userId)` → devuelve lista de casas con FTD reportado.
  - Pasar al componente `<PerfilPage>` para renderizar nuevas secciones.

- `apps/web/components/perfil/ProfileHero.tsx`:
  - Refactor visual: avatar más grande (80px), nivel con barra de progreso visible, posición histórica destacada.
  - Si Premium: badge "💎 Premium" junto al username.
  - Touch target del avatar ≥44px (es clickeable para cambiar foto).

- `apps/web/components/perfil/StatsGrid.tsx`:
  - Mantener los 6 stats: Predicciones · Aciertos · % Acierto · Mejor mes · Pos. histórica · Nivel.
  - Refactor visual: cards más limpias, números grandes con Barlow Condensed.
  - Agregar tendencia (↗ +3% esta semana) en `% Acierto` si hay data suficiente.

- `apps/web/components/perfil/QuickAccessGrid.tsx`:
  - Refactor a 4 cards principales:
    1. Mis predicciones → `/mis-predicciones`
    2. Mi link de referido → modal con copy del link único (NUEVO en Lote C, lógica básica)
    3. Newsletter → anchor a `#notificaciones`
    4. Soporte → `/ayuda/faq`
  - Si Premium: agregar 5ta card "Mi suscripción" → `/premium/mi-suscripcion`.
  - Si NO Premium: card grande "Probar Premium 7 días" abajo (CTA destacado).

- `apps/web/components/perfil/NotificacionesSection.tsx`:
  - Mantener los 4 toggles canónicos del Lote 11: notifInicioTorneo, notifResultados, notifSemanal, notifPromos.
  - Mantener el toggle "Perfil público".
  - **Agregar 2 toggles nuevos para Premium:**
    - `notifPremiumPicks`: "Recibir alertas de picks Premium" (default true para Premium, oculto para no-Premium).
    - `notifPremiumAlerts`: "Recibir alertas en vivo" (default true para Premium, oculto para no-Premium).
  - Agregar campo a `PreferenciasNotif` model en Prisma (Lote E hace la migración real; en Lote C solo agregar UI condicional al modelo si ya existe).

- `apps/web/components/perfil/FooterSections.tsx`:
  - Mantener Seguridad, Ayuda, Legal, Danger zone.
  - Si Premium activo: agregar sub-link en sección Ayuda "Cancelar mi suscripción → /premium/mi-suscripcion".

### Archivos a crear

- `apps/web/components/perfil/PremiumStatusCard.tsx`:
  - Card prominente con estado Premium del usuario:
    - Si NO suscriptor: card oscura tipo Premium con CTA "Probar 7 días gratis".
    - Si suscriptor activo: card con info "💎 Plan [mensual/anual] · Próximo cobro [fecha] · [Gestionar →]".
    - Si suscriptor cancelando: card con warn "Tu suscripción termina el [fecha]. [Reactivar →]".
  - Aparece arriba de `<NotificacionesSection>`.

- `apps/web/components/perfil/MisCasasConectadas.tsx`:
  - Sección con lista de casas donde tiene FTD reportado.
  - Cada casa: logo + nombre + chip "Activa" + "X apuestas este mes" (si tracking disponible).
  - Footer CTA "➕ Conecta una nueva casa (bono S/100)" → `/casas`.
  - Si no tiene casas conectadas: empty state "Aún no tienes casas conectadas. Empieza con [Casa Top] → [Bono S/100]".

- `apps/web/components/perfil/NivelProgressBar.tsx`:
  - Barra horizontal con fill dorado mostrando progreso al siguiente nivel.
  - Label: "Nivel 4 · 312 / 500 puntos · +47 para Nivel 5".

- `apps/web/components/perfil/ReferidoModal.tsx`:
  - Modal/BottomSheet con el link único de referido del usuario.
  - Botón "Copiar link" + "Compartir por WhatsApp" + "Compartir por Twitter".
  - Stats: "X referidos exitosos este mes".
  - Lógica de referidos en Lote C básica (link único = `/?ref=[username]`); tracking real en Lote E.

### Servicios nuevos

- `obtenerEstadoPremium(userId)`:
  - Lee `prisma.suscripcion.findFirst({ usuarioId: userId, activa: true })`.
  - Devuelve null si no es suscriptor.
  - Vivir en `apps/web/lib/services/suscripciones.service.ts` (nuevo, Lote D crea, Lote C consume).
  - Si en Lote C aún no existe el service: devolver `null` siempre con TODO claro.

- `obtenerCasasConectadas(userId)`:
  - Lee `prisma.usuarioCasa.findMany({ usuarioId: userId, primerFtd: { not: null } })` con join a `Afiliado`.
  - Devuelve lista de `{ slug, nombre, logoUrl, primerFtd, apuestasMes }`.
  - Vivir en `apps/web/lib/services/usuarios.service.ts`.
  - Si modelo `UsuarioCasa` aún no existe (depende de Lote C/D/E): devolver array vacío.

### Archivos a eliminar

Ninguno. Solo refactor.

## Datos requeridos

```typescript
// apps/web/app/(main)/perfil/page.tsx
export const dynamic = 'force-dynamic';

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=/perfil');

  const userId = session.user.id;

  const [perfil, prefs, statsMensuales, estadoPremium, casasConectadas] = await Promise.all([
    obtenerMiPerfil(userId),
    obtenerPreferencias(userId),
    obtenerMisStatsMensuales(userId),
    obtenerEstadoPremium(userId),
    obtenerCasasConectadas(userId),
  ]);

  return (
    <PerfilView
      perfil={perfil}
      prefs={prefs}
      statsMensuales={statsMensuales}
      estadoPremium={estadoPremium}
      casasConectadas={casasConectadas}
    />
  );
}
```

## Estados de UI

### Estructura completa

```
┌──────────────────────────────────┐
│ <MobileHeader variant="main">    │
├──────────────────────────────────┤
│ Header título "Mi perfil"        │
│   - Sub: "Hola, Juan"            │
├──────────────────────────────────┤
│ <ProfileHero>                    │
│   - Avatar + username            │
│   - Badge Premium (si aplica)    │
│   - <NivelProgressBar>           │
├──────────────────────────────────┤
│ <StatsGrid> 6 stats              │
├──────────────────────────────────┤
│ <PremiumStatusCard>              │
├──────────────────────────────────┤
│ <QuickAccessGrid>                │
├──────────────────────────────────┤
│ <MisCasasConectadas>             │
├──────────────────────────────────┤
│ <VerificacionSection> (email)    │
├──────────────────────────────────┤
│ <DatosSection> (nombre, etc)     │
├──────────────────────────────────┤
│ <NotificacionesSection>          │  ← anchor #notificaciones
├──────────────────────────────────┤
│ <FooterSections>                 │
│   - Seguridad                    │
│   - Ayuda                        │
│   - Legal                        │
│   - Danger zone (eliminar)       │
├──────────────────────────────────┤
│ <BottomNav>                      │
└──────────────────────────────────┘
```

### Variantes según estado Premium

| Estado | `<PremiumStatusCard>` | `<QuickAccessGrid>` |
|---|---|---|
| No suscriptor (free/FTD) | Card oscura "Probar Premium 7 días" | 4 cards: Predicciones, Referidos, Newsletter, Soporte |
| Suscriptor activo | Card normal con info de plan + próximo cobro + CTA "Gestionar →" | 5 cards: + "Mi suscripción" |
| Suscriptor cancelando | Card warn con fecha de fin + CTA "Reactivar" | 5 cards igual |

### Sub-página: `/perfil/eliminar/confirmar`

Vista existente del Lote 0. Cambios mínimos:
- Aplicar layout pista autenticada (header + bottom nav).
- Refactor visual del form de confirmación.
- Si usuario es Premium activo: alert warn "Tu suscripción Premium se cancelará automáticamente. Pagos previos no se reembolsan."

### Loading / Error

- Server component → render directo.
- Si `obtenerMiPerfil` devuelve null: redirect a `/auth/completar-perfil` (caso edge: usuario logueado sin perfil completo).
- Errores en queries de Premium o casas: graceful — secciones se ocultan, log warn.

## Componentes que reutiliza

- `<MobileHeader variant="main">` (Lote A).
- `<BottomNav>` (Lote A).
- `<Avatar>`, `<Button>`, `<Card>`, `<Toggle>`, `<Modal>` del design system base.
- `<BottomSheet>` (Lote A) para `<ReferidoModal>` en mobile.
- Components existentes del Lote 11 con refactor visual.

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- Si modelos nuevos (Suscripcion, UsuarioCasa) no existen aún (Lote C corre antes de D/E): graceful degradation. Las secciones se ocultan, no rompen el render.
- Touch targets ≥44px.
- Eventos analíticos:
  - No hay eventos nuevos en perfil.
  - `referido_invitacion_compartida` cuando click en "Compartir por WhatsApp/Twitter" del modal de referidos (NUEVO en Lote C).

## Mockup de referencia

`perfil.html` en este mismo folder.

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Estar logueado en `hablaplay.com/perfil`.
2. Verificar las 6 stats con números reales.
3. Verificar `<PremiumStatusCard>` muestra el estado correcto (no suscriptor → CTA promocional).
4. Click en `<QuickAccessGrid>` → "Mi link de referido" abre modal con link copyable.
5. Verificar `<MisCasasConectadas>` muestra empty state si no hay casas.
6. Ir a `/perfil/eliminar/confirmar` y verificar que muestra warning sobre Premium si aplica.
7. Verificar que toggles de notificaciones guardan correctamente (refresh y verificar persistencia).

---

*Versión 1 · Abril 2026 · Perfil para Lote C*
