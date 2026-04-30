# Design System v3.1 — Habla!

Sistema de diseño de Habla! v3.1. Reemplaza la regla "alinear con `docs/habla-mockup-completo.html`" del CLAUDE.md actual: a partir del Lote A, esta carpeta es la fuente de verdad visual.

## Principio rector: dos pistas, un sistema

Habla! v3.1 sirve a dos audiencias en dispositivos distintos:

```
PISTA USUARIO (mobile-first)         PISTA ADMIN (desktop)
       /  /blog  /casas                  /admin/*
       /partidos /comunidad
       /perfil   /premium
       
   ▸ Optimizado para 375px         ▸ Optimizado para 1280px+
   ▸ Touch targets ≥44px           ▸ Hover states + atajos teclado
   ▸ Sticky CTAs zona pulgar       ▸ Tablas densas, filtros avanzados
   ▸ One-handed use                ▸ Sidebar fijo, multi-pane
   ▸ Carga <3.5s en 4G             ▸ Preferencia por fluidez interactiva
   ▸ PWA instalable                ▸ Atajos teclado A/R/E/Esc
```

**Lo común a ambas pistas:**
- Tokens de color (paleta brand-* con azules y dorado)
- Tipografías (Barlow Condensed para títulos, DM Sans para body)
- Espaciado base (sistema 4px/8px/12px/16px/24px/32px)
- Componentes "átomos" (Button, Input, Card, Badge, Modal)
- Tono de voz peruano y cercano

**Lo divergente:**
- Densidad de información (admin condensa más)
- Navegación (mobile = bottom nav 5 ítems / desktop = sidebar jerárquico)
- Tamaños de touch targets (mobile 44px / desktop 32px)
- Animaciones (mobile: discretas / admin: prácticamente cero, prioridad funcional)
- Layouts (mobile: stack vertical / desktop: grid multi-columna)

## Estructura del folder

```
00-design-system/
├── README.md                  ← Este archivo
├── tokens.md                  ← Variables CSS, mapeo Tailwind, tokens nuevos v3.1
├── tipografia.md              ← Escalas mobile y admin con clases utilitarias
├── componentes-base.md        ← Átomos: Button, Input, Badge, Card (compartidos)
├── componentes-mobile.md      ← Patrones mobile-first específicos
├── componentes-admin.md       ← Patrones admin desktop específicos
└── mockup-actualizado.html    ← Showcase visual de alta fidelidad (FUENTE DE VERDAD)
```

## Cómo lee este folder Claude Code

Cuando Claude Code ejecute el **Lote A** (Design system v3.1 + tokens nuevos):

1. Lee `tokens.md` → actualiza `apps/web/tailwind.config.ts` y `apps/web/app/globals.css`.
2. Lee `tipografia.md` → agrega clases utilitarias de tipografía si faltan.
3. Lee `componentes-base.md` → revisa/actualiza `apps/web/components/ui/`.
4. Lee `componentes-mobile.md` → crea componentes mobile-only nuevos en `apps/web/components/ui/mobile/` (carpeta nueva).
5. Lee `componentes-admin.md` → crea componentes admin-only nuevos en `apps/web/components/ui/admin/` (carpeta nueva).
6. Abre `mockup-actualizado.html` en cada decisión visual ambigua.

Para los **Lotes B-J**, cada vista referenciará componentes de este sistema sin volver a definirlos. Si aparece una necesidad de componente nuevo no cubierto aquí, se agrega a este folder con un commit separado antes de implementarlo.

## Reglas duras del design system

Estas reglas extienden las reglas duras de CLAUDE.md (especialmente la regla 7):

1. **Cero hex hardcodeados en JSX/TSX.** Siempre usar tokens Tailwind o vars CSS.
2. **Cero estilos inline excepto cuando dependan de runtime** (ej: `style={{ width: progress + '%' }}`). Para todo lo demás, clases Tailwind.
3. **Touch targets en pista usuario son ≥44px** (incluye padding, no solo el elemento visible). En pista admin pueden bajar a 32px.
4. **Bordes y sombras siguen la escala oficial:** `rounded-sm/md/lg/xl` y `shadow-sm/md/lg/xl/gold/urgent`. Nada custom sin tokens.
5. **Animaciones declaradas en `tailwind.config.ts`.** Cero animaciones inline o `<style jsx>` en componentes.
6. **Pista usuario: animaciones discretas.** Pista admin: cero animaciones decorativas, solo feedback funcional.
7. **Tipografía respeta la escala del archivo `tipografia.md`.** No usar tamaños arbitrarios. Si un caso no está cubierto, ampliar la escala global.
8. **Cada componente nuevo se documenta** en el archivo correspondiente en el mismo commit que lo crea.

## Migración desde el sistema actual

El repo actual (Lotes 1-11) ya tiene un sistema de tokens funcional y bien organizado en `tailwind.config.ts` + `globals.css`. El Lote A **conserva ese sistema y lo extiende**. No hay rompimiento.

| Categoría de tokens | Estado actual | Cambio en Lote A |
|---|---|---|
| Paleta brand-* (azules + dorado) | ✅ Completa | Sin cambios |
| Urgent-* (countdown badges) | ✅ Completa | Sin cambios |
| Accent-* (tipos de torneo) | ✅ Completa | Sin cambios |
| Dark-* (superficies oscuras) | ✅ Completa | Sin cambios |
| Pred-* (chips de predicciones) | ✅ Completa | Sin cambios |
| Alert-* (info/success) | ✅ Completa | Agregar `alert-warning-*` y `alert-danger-*` |
| Medal-* | ✅ Completa | Sin cambios |
| **Premium-*** ⭐ | ⏳ No existe | **NUEVO**: gradientes oscuros + dorado, lock-overlay, watermark |
| **Admin-*** ⭐ | ⏳ No existe | **NUEVO**: tokens densidad, sidebar, status verde/ámbar/rojo |
| **WhatsApp-*** ⭐ | ⏳ No existe | **NUEVO**: verde de marca, gris de fondo del chat |
| **Mobile-vitals-*** ⭐ | ⏳ No existe | **NUEVO**: tokens semáforo Lighthouse |

Detalle completo en `tokens.md`.

## Tipografías

El repo ya carga **Barlow Condensed** y **DM Sans** vía `next/font` (configurado en `apps/web/app/layout.tsx`). Sin cambios en Lote A.

Lo que sí cambia: las **escalas tipográficas** se documentan explícitamente en `tipografia.md` con clases utilitarias compartidas, una para pista usuario (mobile-first) y otra para pista admin (desktop).

## Mockup de referencia v3.1

`mockup-actualizado.html` es un único archivo HTML autocontenido que muestra todos los patrones visuales del sistema v3.1: home mobile, vista de partido (B), vista de torneo (C), Premium landing, perfil, sidebar admin, dashboard admin, validación de picks, KPI cards.

Es el **showcase visual exhaustivo** que las entregas 3-7 referenciarán. Cuando una spec de vista en `02-pista-usuario-publica/` o `05-pista-admin-operacion/` (etc.) diga "ver mockup-actualizado.html sección X", está apuntando aquí.

Reemplaza al `docs/habla-mockup-completo.html` legacy como fuente de verdad. El legacy se mantiene en el repo como referencia histórica pero no se actualiza más.

---

*Versión 1 · Abril 2026 · Design System v3.1 — base para Lote A*
