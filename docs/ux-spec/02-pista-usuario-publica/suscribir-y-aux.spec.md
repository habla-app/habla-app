# Suscribir, Ayuda y Legal

Spec consolidada de las vistas auxiliares de la pista pública. Las 3 son simples y comparten patrón visual sobrio.

## Lote responsable

**Lote B** — Reauditoría móvil de la capa pública.

## Vistas cubiertas

| Vista | Ruta | Función |
|---|---|---|
| Suscribir | `/suscribir` | Suscripción al newsletter (doble opt-in del Lote 10) |
| FAQ | `/ayuda/faq` | Preguntas frecuentes |
| Legal | `/legal/[slug]` | Términos, privacidad, cookies, etc. (MDX) |

## Estado actual del repo

### Suscribir
- `apps/web/app/(public)/suscribir/page.tsx` (Lote 10): página simple con `<SuscribirForm>`.
- Flow: email → POST `/api/v1/newsletter/suscribir` → email de confirmación con magic link → confirma vía `GET /api/v1/newsletter/confirmar?token=...`.

### FAQ
- `apps/web/app/ayuda/faq/page.tsx` (Lote 0): contenido estático con accordions.
- `apps/web/app/ayuda/layout.tsx` (Lote 0): layout propio para sección de ayuda.
- `apps/web/components/faq/FAQAccordion.tsx` (Lote 0).

### Legal
- `apps/web/app/legal/[slug]/page.tsx` (Lote 0): MDX desde `apps/web/content/legal/*.mdx`.
- `apps/web/app/legal/layout.tsx` (Lote 0): layout propio.

## Cambios necesarios

### Suscribir

#### Archivos a modificar

- `apps/web/app/(public)/suscribir/page.tsx`:
  - Aplicar layout consistente con otras vistas públicas (header + footer + bottom nav).
  - Refactor visual mobile-first del form.

- `apps/web/components/marketing/SuscribirForm.tsx`:
  - Refactor visual usando componentes del design system (`<Input>`, `<Button>`).
  - Touch targets ≥44px.
  - Mostrar disclaimer breve abajo del form: "Te llegará un email para confirmar. Sin spam, prometido."

#### Copy v3.1

- **Title:** "Recibe lo mejor de Habla! cada lunes"
- **Sub:** "Top 3 tipsters · Mejores cuotas de la semana · 2 análisis destacados"
- **CTA:** "Suscribirme gratis"

#### Estados de UI

- Form default: input email + checkbox "Quiero recibir promos también" (opcional, default unchecked).
- Submit exitoso: form se reemplaza por mensaje "📧 Revisa tu email para confirmar la suscripción."
- Error: alert rojo "No pudimos procesar tu suscripción. Intenta de nuevo."

### FAQ

#### Archivos a modificar

- `apps/web/app/ayuda/faq/page.tsx`:
  - Aplicar layout consistente con vistas públicas.
  - Categorizar las preguntas en 4 grupos:
    1. **Empezar** (registro, login, completar perfil)
    2. **Liga Habla!** (cómo funciona, premios, predicciones)
    3. **Premium** (qué incluye, cómo cancelar, garantía)
    4. **Casas y apuestas** (link a casas, MINCETUR, juego responsable)
  - Cada categoría como sección con sus accordions.

- `apps/web/components/faq/FAQAccordion.tsx`:
  - Refactor visual mobile-first.
  - Touch target ≥44px en summary.
  - Animación discreta con `animate-slide-down` al expandir.
  - Default: todos cerrados.

#### Archivos a crear

- `apps/web/components/faq/FAQCategoria.tsx`:
  - Sección con título + lista de FAQs de la categoría.

- `apps/web/components/faq/FAQSearch.tsx` (opcional):
  - Buscador que filtra preguntas por título.
  - Si la búsqueda da 0 resultados: "Ninguna pregunta coincide. [Contáctanos]" con link a soporte.

#### Contenido v3.1 sugerido

Lista mínima de preguntas que debe haber al cierre del Lote B (Claude Code escribe los textos):

**Empezar:**
- ¿Cómo me registro en Habla!?
- ¿Tengo que pagar para registrarme?
- ¿Qué pasa si pierdo mi email/no recibí el magic link?
- ¿Puedo cambiar mi username después de registrarme?

**Liga Habla!:**
- ¿Cómo funciona la Liga Habla!?
- ¿Cuál es el premio?
- ¿Cómo se calculan los puntos?
- ¿Cuándo cierra el ranking del mes?
- ¿Cómo me pagan si gano?

**Premium:**
- ¿Qué es Habla! Premium?
- ¿Cuánto cuesta y cómo cancelo?
- ¿Cómo recibo los picks?
- ¿Hay garantía?
- ¿Qué incluye y qué no incluye?

**Casas y apuestas:**
- ¿Habla! es una casa de apuestas?
- ¿Las casas listadas son seguras?
- ¿Qué es MINCETUR?
- ¿Qué hago si tengo problemas con apuestas?

### Legal

#### Archivos a modificar

- `apps/web/app/legal/[slug]/page.tsx`:
  - Aplicar layout consistente (header + footer + bottom nav).
  - Mantener carga MDX y metadata existentes.

- `apps/web/app/legal/layout.tsx`:
  - Eliminar — usar el layout `(public)` general en su lugar.

- Contenidos MDX en `apps/web/content/legal/*.mdx`:
  - **Actualizar para v3.1:**
    - Mencionar Premium (suscripciones, OpenPay como pasarela, garantía 7 días).
    - Mencionar WhatsApp Channel privado (qué datos se comparten con Meta, etc.).
    - Mencionar Anthropic API si se usa Claude para generar picks (Lote E).
    - Verificar que Política de Cookies refleja todos los servicios (no Sentry/PostHog ya que se eliminaron en Lote 1).
  - **Versionado:** cada documento legal debe tener `frontmatter.version` y `frontmatter.actualizado` para auditoría futura. Mantener versión histórica accesible vía admin (Lote G `/admin/auditoria`).

#### Archivos a crear

Ninguno.

## Datos requeridos

### Suscribir

```typescript
// apps/web/app/(public)/suscribir/page.tsx
// Sin queries server-side. Es un form puro.
```

### FAQ

```typescript
// apps/web/app/ayuda/faq/page.tsx
// Contenido estático. Sin queries server-side.
```

### Legal

```typescript
// apps/web/app/legal/[slug]/page.tsx
export default async function LegalPage({ params }: { params: { slug: string } }) {
  const doc = await legal.getBySlug(params.slug);
  if (!doc) notFound();
  return <LegalDocument doc={doc} />;
}
```

## Estados de UI

### Suscribir

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Hero compacto                    │
│   - Icon 📧                      │
│   - "Recibe lo mejor..."         │
│   - "Top 3 tipsters · ..."       │
├──────────────────────────────────┤
│ Form                             │
│   - Input email                  │
│   - Checkbox promos (opcional)   │
│   - Button "Suscribirme gratis"  │
│   - Disclaimer abajo             │
├──────────────────────────────────┤
│ <Footer> + <BottomNav>           │
└──────────────────────────────────┘
```

### FAQ

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Hero compacto                    │
│   - "Preguntas frecuentes"       │
│   - <FAQSearch> (opcional)       │
├──────────────────────────────────┤
│ <FAQCategoria> "Empezar"         │
│   - <FAQAccordion> x N           │
├──────────────────────────────────┤
│ <FAQCategoria> "Liga Habla!"     │
│   - ...                          │
├──────────────────────────────────┤
│ ... otras categorías             │
├──────────────────────────────────┤
│ Footer "¿No encuentras lo que    │
│  buscas? [Contáctanos →]"        │
├──────────────────────────────────┤
│ <Footer> + <BottomNav>           │
└──────────────────────────────────┘
```

### Legal

```
┌──────────────────────────────────┐
│ <MobileHeader variant="public">  │
├──────────────────────────────────┤
│ Hero compacto                    │
│   - Title del documento          │
│   - Sub: "Versión X.Y ·          │
│     Actualizado DD/MM/YYYY"      │
├──────────────────────────────────┤
│ Cuerpo MDX                       │
│   - Headings, lists, párrafos    │
│   - <TOC> mobile collapsable     │
├──────────────────────────────────┤
│ Footer "Si tienes dudas,         │
│  contáctanos en [email]"         │
├──────────────────────────────────┤
│ <Footer> + <BottomNav>           │
└──────────────────────────────────┘
```

### Empty / Loading / Error

#### Suscribir
- Form sin estado especial. Los errores aparecen como alerts inline.
- Submit exitoso: replace form por confirmación.

#### FAQ
- Si búsqueda da 0 resultados: mensaje + CTA "Contáctanos".

#### Legal
- Si slug no existe: `notFound()`.
- Si MDX no parsea: log error + render fallback "Documento en revisión".

## Componentes que reutiliza

- `<MobileHeader>` (Lote A).
- `<BottomNav>` (Lote A).
- `<Button>`, `<Input>`, `<Card>` del design system (Lote A).
- MDX provider (Lote 8) para legal.
- `<TOC>` (Lote 8, refactor compartido).
- `<Footer>` (Lote 11).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Mobile-first.
- ISR `revalidate=3600` para FAQ y Legal.
- `force-dynamic` solo para Suscribir si necesita session (no la necesita).
- Touch targets ≥44px en accordions y form.
- Eventos analíticos:
  - `newsletter_suscripcion` (Lote 10) ya cableado en POST `/api/v1/newsletter/suscribir`.
  - No hay eventos nuevos en estas vistas.

## Mockup de referencia

Sin mockup individual. Patrones visuales estándar (form simple, accordions, página de texto). Claude Code referencia design system.

## Pasos manuales para Gustavo post-deploy

**Para Legal:** después de actualizar los MDX legales, Claude Code los commitea. NO requiere acción de Gustavo. Solo verificación post-deploy.

**Validación post-deploy:**
1. Abrir `hablaplay.com/suscribir`. Probar suscripción con email tuyo. Verificar que llega email de confirmación. Click en magic link. Verificar redirect a `/?suscripcion=confirmada`.
2. Abrir `hablaplay.com/ayuda/faq`. Probar accordions. Verificar las 4 categorías.
3. Abrir `hablaplay.com/legal/terminos` (o slug que exista). Verificar contenido actualizado v3.1.
4. Probar TOC en mobile (collapsable) y desktop (sticky si aplica).

---

*Versión 1 · Abril 2026 · Suscribir + Ayuda + Legal para Lote B*
