# Validar Picks Premium `/admin/picks-premium`

Vista crítica del flujo Premium. Permite al admin (editor) revisar los picks generados por Claude API, aprobar/rechazar/editar, y disparar el envío al WhatsApp Channel + bot 1:1. Diseño optimizado para velocidad: layout 2 paneles + atajos de teclado.

## Lote responsable

**Lote F** — Admin desktop operación.

## Estado actual del repo

NUEVA — esta vista no existe. Depende de modelo `PickPremium` creado en Lote E.

## Cambios necesarios

### Archivos a crear

- `apps/web/app/admin/picks-premium/page.tsx`:
  - Server component que carga la cola de picks PENDIENTES + el detalle del seleccionado por URL param.
  - URL: `/admin/picks-premium` o `/admin/picks-premium?id=...`.

- `apps/web/components/admin/picks/PicksColaSidebar.tsx`:
  - Panel izquierdo (280px) con lista de picks pendientes ordenados por proximidad de partido.
  - Cada item: timestamp generación + partido (equipos) + recomendación corta + botón estado.
  - Item activo destacado con borde dorado izquierdo + bg-gold-dim.
  - Click en item → navega a `?id=<picId>`.

- `apps/web/components/admin/picks/PickDetalle.tsx`:
  - Panel derecho (resto del ancho) con detalle completo:
    - Header: partido + meta (liga, fecha, ID, hace cuánto se generó)
    - Sección "Recomendación generada": mercado + outcome + cuota + casa con mejor cuota + EV+ + stake
    - Sección "Razonamiento estadístico": texto del razonamiento (editable inline)
    - Sección "Estadísticas clave": las stats H2H/forma/factor en formato bullet
    - Sección "Cuotas comparadas top 4": preview del comparador con la mejor destacada
    - Sección "Mensaje WhatsApp preview": cómo se verá el mensaje formateado (preview real con `formatearPickPremium`)
    - Footer con 3 botones: Aprobar (verde) / Editar (outline) / Rechazar (rojo) + atajos visibles.

- `apps/web/components/admin/picks/PickEditModal.tsx`:
  - Modal que aparece al click en "Editar" (atajo `E`).
  - Campos editables: razonamiento, stake sugerido, EV+, casa recomendada (dropdown).
  - Botón "Guardar y aprobar" → cambia estado a EDITADO_Y_APROBADO + dispara envío.

- `apps/web/components/admin/picks/PickRechazoModal.tsx`:
  - Modal al click en "Rechazar" (atajo `R`).
  - Textarea para motivo (max 500 chars).
  - Botón "Confirmar rechazo" → cambia estado a RECHAZADO.

- `apps/web/components/admin/picks/AtajosTeclado.tsx`:
  - Hook `useEffect` que escucha keydown:
    - `A` → aprobar pick activo
    - `R` → abrir modal rechazar
    - `E` → abrir modal editar
    - `↑/↓` → navegar entre picks de la cola
    - `Esc` → cerrar modal
  - Solo activos cuando NO hay input/textarea con focus (preview del comparador no debe interferir).

- `apps/web/components/admin/picks/PickStatsHistorico.tsx`:
  - Sidebar derecho colapsable (300px) con stats históricos del editor:
    - Picks aprobados últimos 30d: N
    - % acierto: X%
    - ROI promedio: Y%
    - Picks rechazados: N
  - Útil para auto-evaluación.

### Server actions / endpoints

- `apps/web/app/api/v1/admin/picks-premium/[id]/aprobar/route.ts`:
  - POST. Cambia estado a APROBADO + `aprobado=true` + `aprobadoPor=admin.id` + `aprobadoEn=now()`.
  - Dispara `distribuirPickAprobado(id)` en background (ver `whatsapp-channel-flow.spec.md` Paquete 5B).
  - Retorna `{ ok: true }`.

- `apps/web/app/api/v1/admin/picks-premium/[id]/rechazar/route.ts`:
  - POST con `{ motivo: string }`.
  - Cambia estado a RECHAZADO + `rechazadoMotivo`.

- `apps/web/app/api/v1/admin/picks-premium/[id]/route.ts`:
  - PATCH con campos editables (`razonamiento`, `stakeSugerido`, etc.).
  - Cambia estado a EDITADO_Y_APROBADO + `aprobado=true` + `aprobadoPor` + `aprobadoEn` + dispara envío.

### Archivos a modificar

Ninguno — todo nuevo.

## Datos requeridos

```typescript
// apps/web/app/admin/picks-premium/page.tsx
export const dynamic = 'force-dynamic';

interface Props {
  searchParams?: { id?: string; estado?: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' };
}

export default async function PicksPremiumAdminPage({ searchParams }: Props) {
  const filtroEstado = searchParams?.estado ?? 'PENDIENTE';

  // Cola de picks pendientes
  const cola = await prisma.pickPremium.findMany({
    where: { estado: filtroEstado },
    include: { partido: true },
    orderBy: { partido: { fechaInicio: 'asc' } },
  });

  // Pick activo (default: el primero de la cola)
  const pickActivoId = searchParams?.id ?? cola[0]?.id ?? null;
  const pickActivo = pickActivoId
    ? await prisma.pickPremium.findUnique({
        where: { id: pickActivoId },
        include: {
          partido: true,
          casaRecomendada: true,
        },
      })
    : null;

  // Cuotas top 4 para el partido del pick activo
  const cuotas = pickActivo?.partido
    ? await obtenerOddsCacheadas(pickActivo.partido.id)
    : null;

  // Stats del editor (Gustavo)
  const session = await auth();
  const statsEditor = await obtenerStatsEditor(session.user.id);

  return (
    <PicksPremiumView
      cola={cola}
      pickActivo={pickActivo}
      cuotas={cuotas}
      statsEditor={statsEditor}
      filtroEstado={filtroEstado}
    />
  );
}
```

### Servicios

- `prisma.pickPremium` (Lote E).
- `obtenerOddsCacheadas` (Lote 9).
- `obtenerStatsEditor(userId)` — NUEVO. Calcula stats agregadas de todos los picks aprobados por este editor.

## Estados de UI

### Layout principal

```
┌────────────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Operación · Picks Premium)  [A]Aprobar [R]Rechaz [E]│
├─────────┼──────────────────────┬────────────────────────────────────────┤
│         │ <PicksColaSidebar>   │ <PickDetalle>                          │
│         │ ──────────────────   │ ─────────────────────────────────────  │
│         │ Cola (3 pendientes)  │ Alianza Lima vs Universitario          │
│         │                      │ Liga 1 Apertura · Sáb 9:00 PM          │
│ NAV     │ ▸ Hace 12 min  [PEN] │                                        │
│         │   Alianza vs Univ.   │ ┌─Recomendación generada──────────┐    │
│         │   BTTS Sí @ 1.85     │ │ BTTS · Sí @ 1.85                │    │
│         │ ────────────────────  │ │ Mejor cuota: Betano · EV+ 14%   │    │
│         │   Hace 28 min        │ │ Stake: 3% del bankroll           │    │
│         │   Real M vs Man C    │ └──────────────────────────────────┘    │
│         │   Más 2.5 @ 1.95     │                                        │
│         │ ────────────────────  │ Razonamiento estadístico:              │
│         │   Hace 45 min        │ Universitario anotó en 8/10            │
│         │   Boca vs Racing     │ últimos partidos como visitante...     │
│         │   Gana Boca @ 2.10   │ (~150 palabras)                        │
│         │                      │                                        │
│         │                      │ Stats clave:                           │
│         │                      │  • H2H: 4 de últimos 5 con BTTS sí    │
│         │                      │  • Forma: U 8/10 visit · A 7/10 local │
│         │                      │  • Factor: defensa frágil ante 9      │
│         │                      │                                        │
│         │                      │ Cuotas top 4:                          │
│         │                      │  Betano: 1.85 ★                        │
│         │                      │  Betsson: 1.82                         │
│         │                      │  Stake: 1.80                           │
│         │                      │  1xBet: 1.78                           │
│         │                      │                                        │
│         │                      │ Preview WhatsApp:                      │
│         │                      │ ┌──────────────────────────────────┐   │
│         │                      │ │ 🎯 *PICK PREMIUM #47 · 30/04*    │   │
│         │                      │ │ ⚽ Alianza vs Universitario      │   │
│         │                      │ │ ...                              │   │
│         │                      │ └──────────────────────────────────┘   │
│         │                      │                                        │
│         │                      │ ┌─Acciones──────────────────────┐      │
│         │                      │ │ [A] Aprobar y enviar          │      │
│         │                      │ │ [E] Editar  [R] Rechazar      │      │
│         │                      │ └──────────────────────────────┘      │
└─────────┴──────────────────────┴────────────────────────────────────────┘
```

### Estados según pick

#### Pick PENDIENTE (cola)
- Cola izquierda muestra picks ordenados por proximidad de partido.
- Detalle derecho muestra el pick activo con todos los datos.
- 3 botones de acción habilitados.

#### Pick APROBADO (filtro)
- Cola muestra picks aprobados con timestamp de envío al Channel.
- Detalle muestra estado: "Enviado al Channel hace X horas a Y suscriptores".
- Si el partido finalizó: muestra resultado del pick (GANADO/PERDIDO/etc).
- Botones: solo "Ver mensaje enviado" + "Editar evaluación post-partido si aplica".

#### Pick RECHAZADO (filtro)
- Cola muestra rechazados con motivo.
- Detalle muestra motivo + opción "Generar nuevo pick para este partido" (si aplica).

### Filtros tabs

```
[ Pendientes (3) ] [ Aprobados (47) ] [ Rechazados (12) ] [ Todos ]
```

### Loading

- Server component → render directo.
- Después de aprobar/rechazar/editar: optimistic update en la cola + fetch en background para sync.

### Empty states

- Cola vacía (sin pendientes): mensaje "✓ Todo al día. Sin picks pendientes." + sugerencia "Próxima generación: en X minutos (cron cada 4h)".
- Sin pick activo: mensaje "Selecciona un pick de la cola izquierda."

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>` (Lote F · 00-layout).
- `<AdminTable>` (Lote F).
- `<AdminCard>` (Lote F).
- `<KbdHint>` (Lote F).
- `<Modal>` del design system.
- `formatearPickPremium` (Lote E pick-formato).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Atajos de teclado** son crítico para velocidad: A/R/E/↑↓/Esc.
- Los inputs activos (textarea de razonamiento, modal de rechazo) deben **suprimir** los atajos para no interferir.
- **Confirmación visual instantánea** al aprobar (toast verde "Pick enviado a 847 suscriptores"). Si el envío falla, toast rojo + retry button.
- **Envío en background.** El admin no espera el envío completo (puede tardar 30s+ con muchos suscriptores).
- Eventos analíticos:
  - `admin_pick_aprobado` (NUEVO Lote F)
  - `admin_pick_rechazado` (NUEVO Lote F)
  - `admin_pick_editado` (NUEVO Lote F)
  - `admin_pick_visto_detalle` (NUEVO Lote F)

## Mockup de referencia

`picks-premium.html` en este mismo folder.

También ver `00-design-system/mockup-actualizado.html` sección "09 · Pista admin · Validar picks Premium".

## Pasos manuales para Gustavo post-deploy

Ninguno.

**Validación post-deploy:**
1. Esperar a que el cron genere picks (cada 4h) o disparar manualmente.
2. Logueado como ADMIN, abrir `hablaplay.com/admin/picks-premium` desde laptop.
3. Verificar cola con 1-3 picks pendientes.
4. Click en un pick → cargar detalle.
5. Probar atajos: presionar `A` → debe aprobar.
6. Verificar que `prisma.pickPremium.aprobado=true` en BD.
7. Verificar Railway logs: `distribuirPickAprobado` invocado, mensajes enviados.
8. Verificar en tu WhatsApp (con teléfono de testing): debe llegar el pick.
9. Probar `R` → modal de rechazo → confirmar → estado RECHAZADO.
10. Probar `E` → modal de edición → cambiar razonamiento → "Guardar y aprobar" → estado EDITADO_Y_APROBADO.
11. Probar tabs de filtro: Aprobados, Rechazados, Todos.

---

*Versión 1 · Abril 2026 · Picks Premium admin para Lote F*
