# Pista Admin · Análisis — Lote G

Specs de las vistas del panel admin para análisis de KPIs, cohortes, finanzas, mobile vitals y alarmas. Esta carpeta es lo que Claude Code lee al ejecutar el **Lote G — Admin desktop análisis** del roadmap A-J.

## Cómo lee este folder Claude Code

Cuando se ejecute el Lote G, leer en este orden:

1. Este `README.md`.
2. La carpeta `05-pista-admin-operacion/` completa (especialmente `00-layout-admin.spec.md` que define el sidebar y topbar compartidos).
3. Cada `.spec.md` de vista en el orden de implementación recomendado abajo.

## Decisión arquitectónica clave

### Lote G se separa de Lote F para escalabilidad

Lote F es operación diaria (validar picks, aprobar premios, gestionar suscripciones). Lote G es análisis de KPIs y métricas (más data viz, menos transacciones). Separar permite:

- Implementar F primero (crítico para el lanzamiento del 8 mayo).
- Lote G se completa post-lanzamiento sin bloquear soft launch.
- Si Gustavo solo necesita F al inicio, sigue funcionando.

## Orden de implementación recomendado

| # | Vista | Spec | Por qué este orden |
|---|---|---|---|
| 1 | KPIs detallado | `kpis.spec.md` | Vista principal de análisis. Reusa el sistema del dashboard. |
| 2 | Cohortes | `cohortes.spec.md` | Análisis cohorte registro → FTD → Premium. |
| 3 | Mobile Vitals | `mobile-vitals.spec.md` | Lighthouse + CWV monitoring. |
| 4 | Finanzas | `finanzas.spec.md` | Revenue, MRR, costos, margen. |
| 5 | Alarmas | `alarmas.spec.md` | Sistema de alarmas con thresholds. |
| 6 | Logs + Auditoría + Usuarios | `sistema.spec.md` | 3 vistas auxiliares en un spec. |

## Convenciones

Mismas convenciones del Lote F (desktop-only, sidebar lateral, tokens admin).

## Reglas duras

Mismas que Lote F. Adicionalmente:

- **Cache pesada en queries de KPIs.** Mucha data agregada → cachear en Redis con TTL 5-15 min.
- **Recharts** ya está disponible (Lote 6). Reutilizar para nuevas gráficas.
- **Export a CSV** disponible en cada vista de tabla densa.

## Estado de las specs del Lote G

| Spec | Paquete entrega | Estado |
|---|---|---|
| `kpis.spec.md` | 6C | ⏳ |
| `cohortes.spec.md` | 6C | ⏳ |
| `mobile-vitals.spec.md` | 6C | ⏳ |
| `finanzas.spec.md` | 6C | ⏳ |
| `alarmas.spec.md` | 6C | ⏳ |
| `sistema.spec.md` (logs + auditoría + usuarios) | 6C | ⏳ |

---

*Versión 1 · Abril 2026 · Lote G admin análisis*
