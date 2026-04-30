# Finanzas `/admin/finanzas`

Vista de análisis financiero: Revenue mensual desagregado por fuente (Premium / afiliación), MRR, costos operativos, margen, CAC, LTV. Es el dashboard ejecutivo para entender la salud económica del negocio.

## Lote responsable

**Lote G** — Admin desktop análisis.

## Estado actual del repo

NUEVA — sin sistema de tracking financiero consolidado.

## Cambios necesarios

### Decisión arquitectónica

Hay 2 fuentes de revenue:

1. **Suscripciones Premium** — directas, capturadas en `prisma.pagoSuscripcion`.
2. **Comisiones de afiliación** — externas, llegan al banco de Habla! mensualmente. Se registran manualmente en BD por el admin desde `/admin/conversiones` cuando recibe el pago de cada casa.

Costos operativos relevantes:
- Anthropic API (Claude para picks Premium + bot FAQ)
- WhatsApp Business API (mensajes outbound, esencialmente $0 hasta cierto volumen)
- Resend (emails)
- Railway (hosting)
- Cloudflare (CDN)
- Otros servicios (Sentry, etc)

### Archivos a crear

- `apps/web/app/admin/finanzas/page.tsx`:
  - Server component con stats financieros + gráficas.

- `apps/web/components/admin/finanzas/RevenueResumenCards.tsx`:
  - 4 cards principales:
    - Revenue mes actual (Premium + afiliación)
    - MRR Premium
    - Margen operativo % (Revenue - Costos) / Revenue
    - LTV/CAC ratio

- `apps/web/components/admin/finanzas/RevenueDesagregado.tsx`:
  - Bar chart stacked: Premium (oro) vs Afiliación (azul) por mes últimos 12 meses.
  - Total mensual encima de cada barra.

- `apps/web/components/admin/finanzas/MRRChart.tsx`:
  - Line chart de MRR mensual con breakdown por plan (mensual / trimestral / anual).
  - Anotaciones de eventos clave: "lanzamiento Premium", "campaña X", etc (manuales).

- `apps/web/components/admin/finanzas/CostosOperativos.tsx`:
  - Tabla con costos del mes:
    - Categoría · Monto · % del revenue · Tendencia
  - Editable: admin puede agregar/editar costos manualmente (ej: hosting, salarios, etc).

- `apps/web/components/admin/finanzas/CACTendencia.tsx`:
  - Card con CAC promedio por canal:
    - Organic: S/0 (sin costo)
    - Social paid: S/X
    - Google ads: S/Y
  - Tendencia mensual.

- `apps/web/components/admin/finanzas/ProyeccionTabla.tsx`:
  - Proyección 12 meses adelante asumiendo growth rate del último trimestre.
  - Editable: admin puede ajustar growth rate manualmente.

### Modelos Prisma nuevos

```prisma
model CostoOperativo {
  id          String   @id @default(cuid())
  mes         String              // "2026-04"
  categoria   String              // "anthropic_api" | "hosting" | "salarios" | etc
  monto       Float                // en céntimos PEN
  notas       String?
  registradoPor String              // userId admin
  creadoEn    DateTime  @default(now())

  @@unique([mes, categoria])
  @@map("costos_operativos")
}

model ComisionAfiliacion {
  id            String   @id @default(cuid())
  mes           String
  afiliadoId    String
  afiliado      Afiliado  @relation(fields: [afiliadoId], references: [id])
  monto         Float                // en céntimos PEN
  ftdsContados  Int                   // # FTDs reportados ese mes
  notas         String?
  registradoPor String
  creadoEn      DateTime  @default(now())

  @@unique([mes, afiliadoId])
  @@map("comisiones_afiliacion")
}
```

### Servicios

- `apps/web/lib/services/finanzas.service.ts`:
  - `obtenerRevenueMes(mes)` — Premium + afiliación + total.
  - `obtenerMRRMensual(ultimosN)` — array para chart.
  - `obtenerCostosMes(mes)` — tabla editable.
  - `calcularMargenOperativo(mes)` — (revenue - costos) / revenue.
  - `obtenerCACPromedio(mes)` — total spend / nuevos registros.
  - `obtenerLTVPromedio()` — basado en cohortes históricas.

### Archivos a modificar

Ninguno.

## Datos requeridos

```typescript
// apps/web/app/admin/finanzas/page.tsx
export const dynamic = 'force-dynamic';

export default async function FinanzasPage() {
  const mesActual = formatYearMonth(new Date());

  const [revenue, mrr, costos, cac, ltv] = await Promise.all([
    obtenerRevenueMes(mesActual),
    obtenerMRRMensual(12),
    obtenerCostosMes(mesActual),
    obtenerCACPromedio(mesActual),
    obtenerLTVPromedio(),
  ]);

  return <FinanzasView ... />;
}
```

## Estados de UI

### Estructura

```
┌────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar (Análisis · Finanzas)                 │
├─────────┴──────────────────────────────────────────────┤
│ <AdminPageHeader>                                       │
│  Title: Finanzas                                        │
│  Desc: Salud económica · Mes en curso: Abril 2026       │
│  Actions: [Exportar reporte] [+ Costo manual]           │
├─────────────────────────────────────────────────────────┤
│ <RevenueResumenCards> 4 cards                           │
├─────────────────────────────────────────────────────────┤
│ <RevenueDesagregado> bar chart stacked 12 meses         │
├─────────────────────────────────────────────────────────┤
│ <MRRChart> line chart con breakdown por plan            │
├─────────────────────────────────────────────────────────┤
│ <CostosOperativos>                                      │
│  Categoría        │ Monto    │ % rev │ Tendencia │ Edit │
│  ─────────────────────────────────────────────────────  │
│  Anthropic API    │ S/  450  │ 0.5%  │ ↗         │ ✏    │
│  WhatsApp API     │ S/    0  │ 0%    │ —         │ ✏    │
│  Resend           │ S/   80  │ 0.1%  │ ↗         │ ✏    │
│  Railway          │ S/  200  │ 0.2%  │ —         │ ✏    │
│  Cloudflare       │ S/    0  │ 0%    │ —         │ ✏    │
│  Premios Liga     │ S/1,250  │ 1.4%  │ —         │ —    │
│  Salarios         │ S/8,000  │ 9.2%  │ —         │ ✏    │
│  TOTAL            │ S/9,980  │ 11.5% │           │      │
├─────────────────────────────────────────────────────────┤
│ <CACTendencia>  + <ProyeccionTabla>                     │
└─────────────────────────────────────────────────────────┘
```

### Estados de UI

#### Mes recién iniciado (días 1-7)
- Banner info: "El mes apenas comenzó. Datos completos disponibles al final del mes."
- Mostrar mes anterior por default.

#### Costos sin registrar
- Si una categoría no tiene `CostoOperativo` para el mes: mostrar "—" + botón "+ Agregar".

#### Comisiones afiliación pendientes
- Si una casa no ha pagado su comisión del mes: mostrar warning + botón "Registrar pago manual".

### Loading

- Server component → render directo.
- Cache con TTL 30 min (queries pesadas pero no críticamente actuales).

## Componentes que reutiliza

- `<AdminSidebar>`, `<AdminTopbar>`, `<AdminPageHeader>`, `<AdminCard>`, `<AdminTable>` (Lote F).
- Recharts (Lote 6).

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- Desktop-only.
- **Solo admin** puede ver esta vista (datos sensibles del negocio).
- **Auditoría** en cada edición de costo manual (`registradoPor` + log en `/admin/auditoria`).
- Eventos analíticos:
  - `admin_finanzas_visto` (NUEVO Lote G).
  - `admin_costo_registrado` (NUEVO Lote G).
  - `admin_comision_afiliacion_registrada` (NUEVO Lote G).

## Mockup de referencia

Sin mockup individual.

## Pasos manuales para Gustavo post-deploy

### Cierre de mes financiero

Cada inicio de mes (día 1-5):

1. Abrir `/admin/finanzas`.
2. Selector de mes → cambiar al mes recién cerrado.
3. Verificar que el revenue Premium se calcula automáticamente desde `pagoSuscripcion`.
4. Para cada casa afiliada:
   - Esperar a que reporte sus comisiones (revisar email de cada panel afiliado).
   - Cuando recibas el pago en BCP/Interbank: click "+ Comisión" → llenar mes, casa, monto, # FTDs, notas.
5. Para cada categoría de costo:
   - Revisar facturas: Anthropic Console, Resend dashboard, Railway billing, etc.
   - Click "+ Costo" → llenar categoría, monto, mes, notas.
6. Verificar que el margen calculado es razonable.
7. Si discrepancia: revisar `/admin/auditoria` para entender de dónde vienen los números.

**Validación post-deploy:**
1. Abrir `/admin/finanzas`.
2. Verificar revenue actual basado en pagos reales.
3. Agregar un costo de prueba ("Test Anthropic 100 PEN").
4. Verificar que aparece en la tabla y se descuenta del margen.
5. Eliminar el costo de prueba.

---

*Versión 1 · Abril 2026 · Finanzas para Lote G*
