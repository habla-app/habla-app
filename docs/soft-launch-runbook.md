# Soft launch runbook — Lote J (3-7 mayo 2026)

> **Audiencia:** 5-10 testers de confianza convocados por Gustavo.
> **Objetivo:** romper Habla! v3.1 antes que lo rompan los usuarios reales el 8 mayo.
> **Window:** 3 may (sábado) → 7 may (jueves) 23:59 PET.
> **Premio:** los 5 testers más activos reciben 1 mes Premium gratis post-lanzamiento.

El soft launch corre con la app **publicada en producción** pero **con tráfico limitado** (no se anuncia en redes hasta el 8 mayo). Las URLs son las definitivas: `https://hablaplay.com`.

---

## 1. Convocar testers (4 mayo, 09:00 PET)

**Owner:** Gustavo.

Mensaje sugerido por WhatsApp/Email:

> Hola [Nombre]! Antes del lanzamiento oficial del 8 de mayo, quiero pedirte ayuda para testear Habla! Te tomaría 30-45 min, recibís 1 mes Premium gratis y acceso anticipado al Channel privado de picks. ¿Te animás?
>
> Si sí, te paso el runbook con 7 flujos cortos de testing y un canal de WhatsApp para reportar bugs en vivo. Empezamos sábado 3.

**Perfil de testers ideal:**
- Mix de móvil + desktop.
- 2-3 que apuesten online actualmente (entienden cuotas + cashback).
- 1-2 nuevos al mundo (no conocen apuestas).
- 1 con iPhone, 2-3 con Android, 1-2 desktop.

Si convocas 7-10, esperá un drop-out del 30%. Apuntá a 6-7 corridas reales por flujo.

---

## 2. Setup de testers (3 mayo, sábado)

Cada tester recibe un PDF/email con:

1. URL de producción: `https://hablaplay.com`.
2. Credenciales sandbox de OpenPay BBVA para el flujo Premium:
   - Aprobada: `4111 1111 1111 1111` cvv `110` venc `12/30`.
   - Declinada: `4000 0000 0000 0002` cvv `200`.
3. Link al runbook de smoke tests: `tests/e2e/SMOKE-LOTE-J.md` (idealmente exportado a Notion en formato amigable, no GitHub raw).
4. Canal de soporte: grupo WhatsApp privado "Habla! Beta Testers" donde reportar bugs en vivo.
5. Form de feedback estructurado (Notion / Google Forms) con los campos del §5 más abajo.
6. Recordatorio: **no compartir el link de signup todavía** — el 8 mayo es el lanzamiento público.

---

## 3. Distribución de flujos (3-7 mayo)

| Día | Flujos a cubrir | # testers asignados |
|---|---|---|
| Sáb 3 mayo | A (Anónimo→Free→Predicción) + G (Admin operación con Gustavo) | Todos los 5-10 |
| Dom 4 mayo | B (Free→Premium suscripción) + C (Premium→recibe pick) | Todos los que sean Premium tester |
| Lun 5 mayo | D (Premium→cancela) + E (Bot FAQ) | 3-4 testers |
| Mar 6 mayo | F (Liga Habla! mensual — requiere predicciones del finde) | Todos |
| Mie 7 mayo | Re-corrida de bugs encontrados + último smoke A-G end-to-end | Todos |

---

## 4. Comunicación durante el soft launch

**Canal principal:** grupo WhatsApp "Habla! Beta Testers" (Gustavo admin).

**Política de respuesta:**
- Bugs **bloqueantes** → respuesta < 30 min, hot-fix < 4h.
- Bugs **mayores** → respuesta < 2h, hot-fix < 24h.
- Bugs **menores** → respuesta < 8h, fix puede ir a post-launch.
- **Confusiones de UX** (no son bugs): registrar en backlog, no fix forzado salvo que > 3 testers reporten lo mismo.

**Daily check-in:** cada día 21:00 PET, Gustavo posta en el grupo:
- Bugs reportados hoy + su severidad.
- Hot-fixes deployados hoy.
- Foco para mañana.

---

## 5. Form de feedback estructurado

Notion / Google Forms con los siguientes campos. Una entrada por bug o por flujo completado.

```
Tester: [nombre]
Fecha: [dd/mm hh:mm]
Tipo: [bug / pregunta / sugerencia]
Severidad: [bloqueante / mayor / menor / cosmetic]
Flujo: [A/B/C/D/E/F/G de SMOKE-LOTE-J]
Paso: [#N del runbook]
Browser: [Chrome 124 mobile / Safari iOS 17 / Edge 122 desktop / etc.]
Device: [iPhone 14 / Pixel 8 / MacBook Pro / etc.]
URL: [https://hablaplay.com/...]
Qué hice: [3-5 frases]
Qué esperaba: [resultado esperado]
Qué pasó: [resultado real]
Screenshot/video: [adjuntar]
Idea de fix: [opcional, si el tester sabe]
```

---

## 6. Triage diario (Gustavo + Claude Code)

Cada noche 22:00 PET, Gustavo abre el form de feedback y triagea con Claude Code:

| Severidad | Acción |
|---|---|
| Bloqueante | `feat/lote-j-qa-launch` → hot-fix → merge → push. Reportar al tester en ≤ 1h. |
| Mayor | Mismo branch, fix dentro de 24h. |
| Menor | Issue en GitHub para post-launch (mes +1). |
| Cosmetic | Backlog (mes +2). |

**Hot-fixes aceptados:**
- Bugs de regla dura del CLAUDE.md (regla 1-23).
- Bugs que rompen un flujo del SMOKE-LOTE-J.
- Errores 500/timeout en cualquier ruta crítica.
- Errores de copy v3.1 que confundan o suenen "off".

**Hot-fixes NO aceptados:**
- Refactors / "podría ser más limpio".
- Features nuevas no spec'eadas.
- Cambios de design system (esos ya cerraron en Lote A).

---

## 7. Métricas de éxito del soft launch

Antes del 8 mayo 09:00 PET, se cumplen TODAS las siguientes:

- [ ] Cada flujo A-G corrido al menos 3 veces sin bloqueantes pendientes.
- [ ] ≥ 3 testers completaron el flujo B (suscripción) sin issues.
- [ ] ≥ 3 testers recibieron al menos 1 pick Premium en su WhatsApp 1:1.
- [ ] El bot FAQ respondió correctamente a ≥ 5 preguntas de testers distintos.
- [ ] Cero alarmas CRITICAL en `/admin/alarmas`.
- [ ] Lighthouse Mobile ≥ 90 en home + partido + cuotas + premium.
- [ ] P75 LCP < 2.5s · INP < 200ms · CLS < 0.1 (verificar en `/admin/mobile-vitals`).
- [ ] Cero errores no clasificados en `/admin/logs` últimas 24h.

Si alguna falla → **discutir Plan B (postponer al 15 mayo)** con Gustavo el 7 may 23:00 PET.

---

## 8. Mensaje a testers el 8 mayo (post-launch)

```
Familia Habla! 🎉

Estamos en vivo. Gracias por ayudarnos a romper la app antes de los usuarios reales.

Como prometido, ya activamos el mes Premium gratis para los 5 más activos del beta:
1. [@nombre] — N bugs reportados
2. [@nombre] — N
3. [@nombre] — N
4. [@nombre] — N
5. [@nombre] — N

El resto recibe 50% off el primer mes (cupón BETA50, válido hasta 31 mayo).

Un abrazo y nos vemos en el Channel,
Gustavo
```

(Nota: cupones requieren feature de descuentos en OpenPay, fuera de scope del Lote J — si no está listo, sustituir por reembolso manual del 50% post-cobro.)
