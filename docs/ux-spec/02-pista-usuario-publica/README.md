# Pista Usuario · Vistas Públicas — Lote B

Specs de las 13 vistas de la pista pública mobile-first. Carpeta consumida por Claude Code cuando ejecute el **Lote B** del roadmap A-J.

## Cómo lee este folder Claude Code

Cuando se ejecute el Lote B, leer en el siguiente orden estricto:

1. **Este `README.md`** — visión general y orden de implementación.
2. **Las 4 specs base** del folder `01-arquitectura/` ya en el repo (inventario, mapa-rutas, flujos-navegacion, auditoria-repo-actual).
3. **El folder `00-design-system/` completo** (especialmente `componentes-mobile.md` que define los patrones que se reutilizan).
4. **Las specs de este folder en este orden de implementación:**

| Orden | Spec | Por qué este orden |
|---|---|---|
| 1 | `00-layout-y-nav.spec.md` | Define `<MobileHeader>`, `<BottomNav>`, footer público. Todas las vistas dependen de esto. |
| 2 | `home.spec.md` | Vista raíz, base de todas las decisiones de personalización por estado de usuario. |
| 3 | `partidos-slug.spec.md` ⭐ | Producto B. Vista más crítica del modelo v3.1. |
| 4 | `cuotas.spec.md` | Comparador global. Reutiliza componentes de Producto B. |
| 5 | `casas.spec.md` + `casas-slug.spec.md` | Casas: listing y reseña. Cambios menores sobre Lote 7-8. |
| 6 | `blog.spec.md` + `blog-slug.spec.md` | Blog: listing y artículo. Solo refinamientos visuales. |
| 7 | `guias.spec.md` + `guias-slug.spec.md` | Guías: listing y guía individual. |
| 8 | `pronosticos.spec.md` + `pronosticos-liga.spec.md` | Pronósticos por liga. |
| 9 | `auth.spec.md` | 5 vistas de auth en un solo spec por similitud. |
| 10 | `suscribir-y-aux.spec.md` | Suscribir + ayuda + legal. |

## Orden de implementación recomendado para Claude Code

El Lote B se puede sub-dividir en sub-lotes para evitar context overflow:

- **Sub-lote B.1:** Layout/Nav + Home + Producto B + Cuotas (orden 1-4 de la tabla). Las vistas más críticas.
- **Sub-lote B.2:** Casas + Blog + Guías + Pronósticos (orden 5-8). Editorial.
- **Sub-lote B.3:** Auth + Suscribir + Ayuda + Legal (orden 9-10). Auxiliares.

Si Claude Code lo ve manejable, puede hacer todo el Lote B en una pasada. Si no, sub-divide con las cortes anteriores y cierra cada sub-lote con su reporte canónico antes de pasar al siguiente.

## Convenciones de las specs en este folder

Cada spec sigue la estructura canónica definida en el `README.md` raíz de `docs/ux-spec/`:

```
1. Lote responsable
2. Estado actual del repo
3. Cambios necesarios (modificar / crear / eliminar)
4. Datos requeridos
5. Estados de UI (loading / vacío / error / por estado del usuario)
6. Componentes que reutiliza
7. Reglas duras a respetar
8. Mockup de referencia
```

Cada par `nombre.spec.md` + `nombre.html` (cuando aplica) representa una vista. Los mockups individuales solo existen para las 3 vistas críticas (Home, Producto B, Cuotas). Las demás vistas referencian al `mockup-actualizado.html` del design system.

## Estados del usuario que cada vista debe contemplar

Recordatorio (definidos en `01-arquitectura/flujos-navegacion.md`):

| Estado | Detección |
|---|---|
| 0. Anónimo | Sin session |
| 1. Free | Session sin suscripción ni FTD |
| 2. FTD | Session + cookie afiliado + flag `usuario.ftdReportado` |
| 3. Premium | Session + `prisma.suscripcion.activa = true` |

Cada spec indica explícitamente qué cambia en la UI según el estado.

## Reglas duras que aplican a todas las vistas de esta carpeta

1. **Mobile-first riguroso.** Diseñar a 375px primero. Lighthouse Mobile target >90 por vista.
2. **Touch targets ≥44px** en cualquier elemento interactivo.
3. **Tokens y componentes del design system.** Cero hex, cero estilos inline (excepto runtime). Reutilizar `<Button>`, `<Card>`, `<Badge>`, etc. del Lote A.
4. **Animaciones discretas.** Solo las definidas en `componentes-mobile.md` sección "Animaciones permitidas".
5. **Cero ejecución local.** Claude Code valida con `pnpm tsc --noEmit` y `pnpm lint`. No corre dev server.
6. **Cierre con merge a main + push** según directrices operativas del README raíz.

## Estado de las specs (Paquete 3A actual)

| Spec | Estado |
|---|---|
| `00-layout-y-nav.spec.md` | ✅ Incluido en 3A |
| `home.spec.md` + `home.html` | ✅ Incluido en 3A |
| `partidos-slug.spec.md` + `partidos-slug.html` | ✅ Incluido en 3A |
| `cuotas.spec.md` + `cuotas.html` | ✅ Incluido en 3A |
| Resto (`casas`, `blog`, `guias`, `pronosticos`) | ⏳ Llega en 3B |
| `auth`, `suscribir-y-aux` | ⏳ Llega en 3C |

---

*Versión 1 · Abril 2026 · Lote B specs base*
