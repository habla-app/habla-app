# UX Spec v3.1 — Habla!

Carpeta canónica de especificaciones de experiencia de usuario para Habla! v3.1. Reemplaza al mockup legacy `docs/habla-mockup-completo.html` (que se mantiene como referencia visual histórica) y se convierte en la fuente de verdad para todo trabajo de UI a partir del Lote A.

## Cómo leer este folder (orden recomendado para Claude Code)

Cuando arranques una nueva sesión de Claude Code para ejecutar un lote del nuevo roadmap (A-J), lee en este orden:

1. **Este `README.md`** — directrices operativas + roadmap.
2. **`01-arquitectura/auditoria-repo-actual.md`** — qué del repo se recicla, reescribe o descarta.
3. **`01-arquitectura/inventario-vistas.md`** — todas las vistas existentes y nuevas.
4. **`01-arquitectura/mapa-rutas.md`** — URL → componente → datos requeridos.
5. **`01-arquitectura/flujos-navegacion.md`** — transiciones entre vistas según estado del usuario.
6. **El folder específico del lote que vas a ejecutar** (ej: `02-pista-usuario-publica/`).
7. **Cada par `.spec.md` + `.html`** dentro del folder del lote, en el orden que indique el `README.md` de esa carpeta.

Solo después de leer todo lo anterior debe Claude Code empezar a tocar código.

## Directrices operativas permanentes (aplican a TODOS los lotes A-J)

Estas directrices complementan las reglas duras 1-12 que ya están en `CLAUDE.md`. Son inmutables y aplican a cada sesión de Claude Code que ejecute un lote del roadmap nuevo.

### 1. Cero ejecución local

Claude Code NUNCA corre `pnpm dev`, `next build`, `pnpm start`, `prisma migrate dev`, ni levanta servicios locales (Postgres, Redis, etc.). Validación pre-push se limita a:

- `pnpm tsc --noEmit` (typecheck)
- `pnpm lint`

Cualquier validación funcional la hace Gustavo en `hablaplay.com` post-deploy.

### 2. Autonomía total

Claude Code toma todas las decisiones técnicas sin pedir confirmación. Si una spec deja un detalle ambiguo (nombre de variante de componente, naming de columna, orden de ítems en una lista), Claude Code decide y documenta la decisión en el reporte de cierre del lote (sección "Decisiones tomadas durante el lote").

### 3. Cierre con merge a main + push

Cada lote termina con:

1. Commit final con mensaje Conventional (`feat:`, `fix:`, `chore:`, `docs:`).
2. Merge de la branch `feat/lote-X-slug` a `main`.
3. `git push origin main`.
4. Reporte canónico de 6 secciones en el último mensaje (formato definido en CLAUDE.md "Formato de reporte post-lote").

Railway deploya automáticamente al detectar el push a `origin/main`.

### 4. Pasos manuales para Gustavo son explícitos y atómicos

Si el lote requiere acciones manuales del usuario (Gustavo) post-deploy, Claude Code las describe en la sección 4 del reporte canónico. Reglas para esa sección:

- Asumir cero conocimiento técnico del lector.
- Cada paso es atómico: una acción concreta, no más.
- Describir qué pantalla va a ver el usuario antes de la acción ("vas a ver una página azul con un botón blanco que dice 'Add Variable'").
- Describir qué espera ver el usuario después de la acción ("aparecerá una fila nueva con tu variable y un check verde").
- Nunca usar términos técnicos sin explicarlos en lenguaje natural la primera vez que aparecen.
- Si la acción involucra credenciales sensibles (API keys, secrets), instruir al usuario a copiarlas de un proveedor específico en pasos numerados.

Ejemplos de qué pertenece a "pasos manuales":

- Agregar variables de entorno a Railway.
- Configurar dominio en Cloudflare.
- Aceptar términos en OpenPay BBVA.
- Verificar Meta Business Account para WhatsApp Business API.
- Crear el WhatsApp Channel privado y subir el ícono.
- Subir el logo de una casa de apuestas a R2.

### 5. Validación post-deploy es del usuario

Claude Code no valida visualmente ni funcionalmente lo que construyó. Tras el push:

1. Railway despliega.
2. Gustavo abre `hablaplay.com` y verifica.
3. Si encuentra errores o desviaciones, abre una sesión nueva de Claude Code con el feedback puntual.

Claude Code no asume que algo funciona "porque compiló". Compilar y deployar son condiciones necesarias pero no suficientes — la validación funcional la hace el usuario.

## Roadmap de lotes A-J (reemplaza Lotes 12-16 de `plan-final-lotes.md`)

| Lote | Nombre | Pista | Estado | Carpeta de specs |
|---|---|---|---|---|
| **A** | Design system v3.1 + tokens nuevos | Ambas | ⏳ Pendiente | `00-design-system/` |
| **B** | Reauditoría móvil — capa pública | Usuario | ⏳ Pendiente | `02-pista-usuario-publica/` |
| **C** | Reauditoría móvil — capa autenticada | Usuario | ⏳ Pendiente | `03-pista-usuario-autenticada/` |
| **D** | Premium WhatsApp Channel — UI usuario | Usuario | ⏳ Pendiente | `04-pista-usuario-premium/` (parte UI) |
| **E** | Premium backend — automatización | Backend | ⏳ Pendiente | `04-pista-usuario-premium/` (parte backend) |
| **F** | Admin desktop — operación diaria | Admin | ⏳ Pendiente | `05-pista-admin-operacion/` |
| **G** | Admin desktop — KPIs y análisis | Admin | ⏳ Pendiente | `06-pista-admin-analisis/` |
| **H** | Microcopy + emails + WhatsApp templates | Usuario | ⏳ Pendiente | `07-microcopy-emails-whatsapp/` |
| **I** | Mobile-first audit final + PWA | Usuario | ⏳ Pendiente | dentro de `00-design-system/mobile-audit.md` |
| **J** | QA + soft launch + lanzamiento 8 mayo | Ambas | ⏳ Pendiente | (no requiere specs UX, es checklist operativo) |

**Ruta crítica para llegar al 8 de mayo:** A → B → C → D → E → J. Los lotes F, G, H pueden trabajarse en paralelo después de D. El lote I corre antes del J como audit final.

**Lotes 1-11 ya hechos** quedan como base reciclable. Ver `01-arquitectura/auditoria-repo-actual.md` para detalle de qué se recicla, reescribe o descarta.

## Fuente de verdad para conflictos

Si hay contradicción entre fuentes, este es el orden de prioridad:

1. **`Habla_Plan_de_Negocios_v3.1.md`** (en la raíz del repo) — fuente de verdad estratégica.
2. **Las specs de esta carpeta `docs/ux-spec/`** — fuente de verdad funcional y visual.
3. **`CLAUDE.md`** — fuente de verdad operativa del repo (reglas duras, stack, etc.).
4. **El mockup legacy `docs/habla-mockup-completo.html`** — referencia visual histórica solo. Si entra en conflicto con una spec nueva, gana la spec.
5. **`plan-final-lotes.md`** — referencia histórica del roadmap original. Para Lotes 12-16 ese archivo está deprecado por el roadmap A-J de este README.

## Estructura del folder

```
docs/ux-spec/
├── README.md                         ← Este archivo
├── 00-design-system/                 ← Lote A
├── 01-arquitectura/                  ← Entrega 1 (este folder)
│   ├── inventario-vistas.md
│   ├── mapa-rutas.md
│   ├── flujos-navegacion.md
│   └── auditoria-repo-actual.md
├── 02-pista-usuario-publica/         ← Lote B
├── 03-pista-usuario-autenticada/     ← Lote C
├── 04-pista-usuario-premium/         ← Lotes D + E
├── 05-pista-admin-operacion/         ← Lote F
├── 06-pista-admin-analisis/          ← Lote G
└── 07-microcopy-emails-whatsapp/     ← Lote H
```

A medida que se completen las entregas 2-7, las carpetas se irán llenando. La Entrega 1 (este folder `01-arquitectura/`) define el plano que las siguientes entregas van a llenar.

## Convenciones de specs

Cada archivo `.spec.md` dentro de las carpetas de lotes sigue esta estructura canónica:

```markdown
# [Nombre de la vista o componente]

## Lote responsable
[Lote A / B / C / ...]

## Estado actual del repo
- `[ruta del archivo]` ([Lote N de origen]): [descripción del estado actual]
- ...

## Cambios necesarios
### Archivos a modificar
- `[ruta]`: [qué cambia]

### Archivos a crear
- `[ruta]`: [qué hace]

### Archivos a eliminar
- `[ruta]`: [por qué se elimina]

## Datos requeridos
[Queries Prisma, llamadas a services, etc.]

## Estados de UI
- Loading
- Vacío
- Error
- Por estado del usuario (anónimo / free / FTD / Premium / admin)

## Componentes que reutiliza
- `<NombreComponente>` ([Lote N de origen]): [descripción del uso]

## Reglas duras a respetar
- [Lista de reglas del CLAUDE.md aplicables]

## Mockup de referencia
Ver `[nombre-archivo].html` en este mismo folder.
```

Cada par `.spec.md` + `.html` representa una vista o flujo. El HTML es la verdad visual de alta fidelidad; el spec es la verdad funcional con instrucciones precisas para Claude Code.

## Próximas entregas

| Entrega | Carpeta | Contenido | Estado |
|---|---|---|---|
| 1 | `01-arquitectura/` | Inventario, rutas, flujos, auditoría | ✅ Esta entrega |
| 2 | `00-design-system/` | Tokens, componentes base, mockup actualizado | ⏳ Próxima |
| 3 | `02-pista-usuario-publica/` | Specs + mockups vistas públicas | ⏳ Pendiente |
| 4 | `03-pista-usuario-autenticada/` | Specs + mockups perfil, comunidad, mis predicciones | ⏳ Pendiente |
| 5 | `04-pista-usuario-premium/` | Specs + mockups Premium + flujos backend | ⏳ Pendiente |
| 6 | `05-pista-admin-operacion/` + `06-pista-admin-analisis/` | Specs + mockups admin desktop | ⏳ Pendiente |
| 7 | `07-microcopy-emails-whatsapp/` | Catálogo de textos + plantillas | ⏳ Pendiente |

---

*Versión 1 · Abril 2026 · Habla! UX Spec v3.1*
