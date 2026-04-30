# Microcopy + Emails + WhatsApp — Lote H

Specs del catálogo completo de microcopy, plantillas de emails transaccionales, y templates WhatsApp Business API. Esta carpeta es lo que Claude Code lee al ejecutar el **Lote H — Microcopy + emails + WhatsApp templates** del roadmap A-J.

## Cómo lee este folder Claude Code

Cuando se ejecute el Lote H, leer en este orden:

1. Este `README.md`.
2. `tono-de-voz.spec.md` — guía de voz para todo el contenido. **Leer primero** porque define el lente para los demás archivos.
3. `glosario.spec.md` — términos canónicos. **Consultar siempre** antes de escribir nuevos textos.
4. `microcopy-catalogo.spec.md` — catálogo de microcopy por superficie del producto.
5. `emails-transaccionales.spec.md` — templates HTML/React Email.
6. `whatsapp-templates.spec.md` — plantillas para Meta Business API.
7. `notificaciones-in-app.spec.md` — toasts y notificaciones en la UI.

## Decisión arquitectónica clave

### Centralizar microcopy en archivos i18n-ready

Aunque Habla! arranca solo en español neutro Perú, los textos viven en archivos `.ts` con estructura tipo `i18n`:

```typescript
// apps/web/lib/copy/index.ts
export const COPY = {
  cta: {
    suscribirse: '⚡ Suscribirme con OpenPay',
    crear_cuenta: '⚡ Crear cuenta gratis',
  },
  errores: {
    tarjeta_rechazada: 'Tu tarjeta fue rechazada por el banco. Intenta con otra.',
  },
  // ...
};
```

Razones:
- Cambiar tono o términos en un solo lugar.
- Permite future i18n sin reescritura.
- Search global de un texto desde código (`grep "tarjeta_rechazada"`) es más útil que `grep "Tu tarjeta fue"`.

### Templates de email viven como React Email

`apps/web/lib/email/templates/` con cada email como componente React. Resend renderiza HTML inline-style automáticamente. Esto permite:
- Type-safety en variables.
- Preview local con `npx react-email dev`.
- Reutilización de componentes (Header, Footer, Button).

### WhatsApp templates requieren aprobación Meta

Los templates de WhatsApp Business API DEBEN ser aprobados por Meta antes de uso. Cada template tiene categoría (MARKETING / UTILITY / AUTHENTICATION) que afecta el costo. Spec documenta cómo enviarlos a aprobación + cuáles necesita Habla! para v1.

## Convenciones del lote

- **Tono:** informal-friendly, español neutro Perú. Evitar peruanismos exclusivos ("chibolo", "bacán") porque alejan al lector LATAM.
- **Persona:** "tú" (no "usted"). Habla! tutea siempre.
- **Inclusivo:** evitar género gramatical cuando sea posible ("tu cuenta" mejor que "el usuario que estás").
- **Verbo en imperativo positivo:** "Suscríbete" mejor que "Si quieres puedes suscribirte".
- **Cortos:** máx 12 palabras en CTAs. Máx 25 palabras en mensajes de error.

## Reglas duras (extiende reglas 1-13 del CLAUDE.md raíz)

1. **Cero promesas legales.** No "ganarás", no "garantizamos rentabilidad". Solo "buscamos valor estadístico", "histórico de N% acierto", "puede variar".
2. **Apuesta responsable** mencionada en cualquier comunicación que invite a apostar (CTAs a casa, picks Premium, alertas vivo).
3. **Bot FAQ y emails con `[DERIVAR_HUMANO]` o equivalente** para preguntas que requieren atención manual.
4. **Watermark con email del usuario** en mensajes WhatsApp Premium (ya en `pick-formato.spec.md` Lote E).
5. **Cero ejecución local.** Validación pre-push: `pnpm tsc --noEmit` + `pnpm lint`.

## Estado de las specs

| Spec | Paquete | Estado |
|---|---|---|
| `tono-de-voz.spec.md` | 7A | ✅ |
| `glosario.spec.md` | 7A | ✅ |
| `microcopy-catalogo.spec.md` | 7A | ✅ |
| `emails-transaccionales.spec.md` | 7B | ⏳ |
| `whatsapp-templates.spec.md` | 7B | ⏳ |
| `notificaciones-in-app.spec.md` | 7B | ⏳ |

---

*Versión 1 · Abril 2026 · Lote H microcopy*
