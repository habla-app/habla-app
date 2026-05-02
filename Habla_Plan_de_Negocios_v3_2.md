*HABLA! · Plan de Negocios v3.2*

**HABLA!**

**Plan de Negocios**

*Plataforma editorial de pronósticos deportivos*

*y comunidad de apostadores en Perú*

**Versión 3.2 (Final)**

Mayo 2026

*Confidencial*

**Lanzamiento al público: 8 de mayo de 2026**

*Mundial FIFA 2026 inicia el 11 de junio · 34 días para construir tracción*

---

# **1. Resumen Ejecutivo**

Habla! es la plataforma editorial peruana de pronósticos deportivos, comparación de cuotas y comunidad de apostadores. Operamos como medio digital independiente — producimos contenido editorial dinámico de valor y monetizamos vía afiliación con casas de apuestas autorizadas por MINCETUR, suscripciones a Socios Habla! y productos educativos.

Habla! NO es operador de juego. No recibimos apuestas, no manejamos pozos, no necesitamos licencia MINCETUR. Esto permite operar bajo una EIRL con capital de arranque acotado, tiempos de lanzamiento agresivos y operación con muy baja intervención humana.

**Cambios estratégicos clave en v3.2 (consolidación del modelo):**

- **Rebranding "Premium" → "Socios Habla!"**: la marca de suscripción se renombra como "Socios" para reforzar la identidad de comunidad por sobre la idea transaccional. La página `/socios` (venta) y `/socios-hub` (área del miembro activo) reemplazan a `/premium`.
- **Producto B con paywall explícito por nivel**: cada partido cubierto tiene dos versiones de análisis técnicamente separadas — Free (pronóstico 1X2 + probabilidad + mejor cuota + análisis básico) y Socios (combinada con value + stake + EV+ + razonamiento detallado + mercados secundarios). El motor genera ambas versiones simultáneamente; lo único editable manualmente es la redacción.
- **Modelo de filtros formalizado**: el sistema admin opera sobre dos filtros explícitos con reglas claras. El **Filtro 1** decide qué partidos importados se muestran al público (genera análisis Free + Socios). El **Filtro 2** decide cuáles de esos partidos son elegibles para la Liga Habla!. Esto permite gestión granular y trazabilidad completa.
- **Liga simplificada a una combinada final por partido**: cada jugador envía solo una combinada por partido (editable hasta el kickoff). Esto simplifica el cálculo de leaderboard y elimina ambigüedad en la mecánica.
- **Producto A reducido a Reviews + Guías**: la biblioteca auxiliar se concentra en lo que más impacta SEO y confianza (reseñas de casas autorizadas + guías evergreen). Las calculadoras y herramientas se mueven a perfil del usuario o se eliminan.

Los cuatro productos (Las Fijas, Liga Habla!, Reviews y Guías, Socios) se lanzan simultáneamente el 8 de mayo de 2026 para capturar el Mundial con MRR desde día 1. La experiencia se diseña con **paridad mobile + desktop** según las dos versiones específicas que el mockup v3.2 define para cada vista — ambos viewports son ciudadanos de primera clase, no es que uno se "adapte" al otro.

### **Datos clave**

| **Concepto** | **Detalle** |
| --- | --- |
| Forma jurídica | EIRL ya constituida |
| Lanzamiento público | 8 de mayo de 2026 (cuatro productos en simultáneo) |
| Pico de demanda | Mundial FIFA 2026 (11 jun – 19 jul) |
| Mercado direccionable | US$ 550M+ apuestas online Perú 2026 (proyección MINCETUR) |
| Modelo de monetización | Afiliación + suscripción Socios + productos educativos |
| Capital requerido | S/ 18,000 – S/ 28,000 |
| Breakeven proyectado | Mes 2 (impulsado por el Mundial + MRR Socios desde día 1) |
| Operación | Unipersonal con apoyo de Claude (Code, Chat, Cowork, API) |
| Intervención humana semanal | ~5-7 hrs (incluye validación diaria de análisis Socios) |
| Stack técnico | 100% reutilizado de la versión previa + WhatsApp Business API + Claude API |
| Slogan | *"Habla! Todas las fijas en una"* |
| Diseño dual | Mockup v3.2 define ambos viewports (mobile ~380px + desktop ~1400px) con paridad de funcionalidad y calidad UX |

### **Secuencia de lanzamiento**

- **8 de mayo de 2026**: lanzamiento simultáneo de los cuatro productos: Las Fijas (cobertura dinámica por partido con paywall Free/Socios), Liga Habla! (competencia comunitaria con premios), Reviews y Guías (biblioteca de soporte), Socios Habla! (canal WhatsApp privado + bot vía Business API + 2-4 picks/día automatizados) y programa de afiliados con casas autorizadas.

- **11 de junio – 19 de julio de 2026**: Mundial FIFA 2026. Producción editorial intensiva, pauta paga, construcción de comunidad y captura masiva de Socios aprovechando el pico de demanda.

- **Cuando se justifique la operación**: contenido editorial complementario para Socios (análisis generales no atados a un partido específico) y eventual incorporación de tipsters colaboradores especializados.

- **Octubre 2026**: lanzamiento de productos educativos (curso, ebook, coaching).

### **Ventaja competitiva**

El mercado peruano de pronósticos está dominado por canales de Telegram con baja calidad editorial (El Crack, LATAM Analistas, Tipster Perú) y por sitios SEO genéricos con identidad débil (ApuestaLegal.pe, Apuesta.pe, OneFootball Perú). Habla! combina seis elementos que ningún competidor local integra:

1. Identidad de marca peruana auténtica.
2. Cobertura dinámica por partido con análisis editorial estructurado en dos niveles (Free 1X2 + Socios combinada con EV+).
3. Comunidad gamificada con premios reales financiados por la operación.
4. Producto Socios automatizado de bajo costo y alto margen, distribuido vía WhatsApp Channel.
5. Sistema admin con filtros explícitos que permite gestión granular del catálogo de partidos.
6. Diseño dual mobile + desktop con paridad funcional — ambos viewports están definidos explícitamente en el mockup v3.2.

Modelo validado globalmente: OLBG (UK), Action Network (USA, adquirido por Better Collective en 2021 por aproximadamente US$ 240M), Pyckio (España, adquirido por Tipstrr en 2024). El playbook está probado y replicable en mercados emergentes.

---

# **2. Descripción del Negocio**

## **2.1 Qué es Habla!**

Habla! es un medio digital especializado en apuestas deportivas para el mercado peruano. Funciona como un sistema integrado de cuatro productos que trabajan en conjunto para captar, convertir y retener usuarios:

- **Las Fijas (Producto B)** — cobertura dinámica por partido. Cada partido cubierto tiene una vista dedicada con dos versiones de análisis: Free (pronóstico 1X2 + probabilidad + mejor cuota + análisis básico de forma/H2H) y Socios (combinada óptima + stake sugerido + EV+ + razonamiento detallado + mercados secundarios con value).

- **La Liga Habla! (Producto C)** — competencia comunitaria gratuita con leaderboard mensual público y premios reales en efectivo. Cada jugador envía una combinada final por partido elegible.

- **Reviews y Guías (Producto A)** — biblioteca de soporte. Reseñas de cada casa autorizada MINCETUR + guías evergreen para apostadores. Funciona como red de seguridad cognitiva y captura tráfico SEO informativo.

- **Socios Habla! (motor de MRR)** — suscripción que distribuye 2-4 picks de valor por día vía WhatsApp Channel privado, además de desbloquear el análisis Socios en cada partido cubierto, contenido editorial profundo (en agosto) y bot 24/7 para consultas.

## **2.2 Propuesta de valor**

- **Información práctica antes de cada apuesta**: análisis previos, estadísticas y cuotas comparadas entre las casas autorizadas en Perú, organizados partido por partido.
- **Comunidad gratuita con stakes reales**: el usuario compite con otros apostadores, gana puntos por aciertos, sube en el ranking mensual y gana premios reales en efectivo — sin pagar ninguna entrada.
- **Producto Socios automatizado y data-driven**: cada pick Socios incluye razonamiento estadístico explícito (head-to-head, forma reciente, EV+ calculado) en lugar de "intuición del tipster".
- **Identidad peruana**: voz, tono y referentes locales — sin la frialdad de los sitios europeos genéricos ni el desorden de los canales de Telegram.
- **Funciona igual de bien en mobile y desktop**: PWA optimizada para celular (sin descarga de app, instalable como acceso directo), y experiencia desktop dedicada para quienes usan PC. Ambas versiones son específicas, no una adaptación responsiva genérica.
- **Transparencia**: tracking público de los pronósticos del equipo editorial, histórico de aciertos visible y disclosure explícito de afiliaciones.

## **2.3 Posicionamiento de marca**

**Tagline:** *"Habla! Todas las fijas en una"*

El slogan refleja directamente la propuesta de valor: una sola plataforma reúne todos los picks de valor del día — los gratuitos del editor, los del comparador de cuotas, los Socios del canal WhatsApp y los de la comunidad de tipsters competidores. "Las fijas" es jerga peruana auténtica del apostador.

**Voz de marca**: cercana, peruana, conocedora pero accesible. Mezcla de "compa que sabe de fútbol" con análisis serio. Modismos peruanos sin caer en lo vulgar.

**Estilo visual**: azul oscuro (#001050) y dorado (#FFB800) de la identidad existente. Tipografía Barlow Condensed (titulares y scores) + DM Sans (cuerpo). Sistema de tokens Tailwind ya consolidado.

**Principio de diseño**: el mockup v3.2 es la fuente de verdad de la experiencia objetivo. Define las **24 vistas** del producto (10 públicas + 14 admin) con sus dos versiones de viewport (desktop ~1400px y mobile ~380px) y los **3 estados de autenticación** (Visitante, Logueado free, Socio). Mobile y desktop son ambos primarios y deben funcionar con paridad de calidad UX — ninguno es una adaptación del otro. Cualquier decisión de implementación se valida contra el mockup; cualquier ambigüedad se resuelve mirando lo que el mockup dice. La realidad de que 75%+ del tráfico viene de móvil refuerza la importancia del viewport mobile, pero no lo eleva por encima del desktop como criterio de diseño.

---

# **3. Análisis de Mercado**

## **3.1 Tamaño y dinámica del mercado peruano**

- Apuestas deportivas online en Perú: proyección MINCETUR de US$ 550M+ anuales en 2025-2026; estimaciones privadas (Flanqueo) llevan el mercado total a S/ 5,000M en 2025.
- Plataformas autorizadas MINCETUR a Q1 2026: 91 marcas activas.
- 5 millones de jugadores online en Perú (~20% de la población).
- ARPU del mercado peruano (2024): aproximadamente US$ 502/año.
- Gasto promedio mensual del apostador: S/ 200–600 (Inkabet 2025).
- Tráfico Q1 2026 a casas de apuestas: 253.4M visitas (+10.3% YoY).
- 75%+ del tráfico viene de móvil.
- Penetración de fútbol en hombres peruanos 18-45: superior al 70%.
- Mundial FIFA 2026 (11 jun – 19 jul): pico histórico de interés.

## **3.2 Segmentos objetivo**

### **Buyer Persona principal: "El Apostador Estable"**

| **Atributo** | **Descripción** |
| --- | --- |
| Demografía | Hombre, 25-45 años |
| Geografía | Lima Metropolitana, Arequipa, Trujillo, Piura, Chiclayo |
| Ingreso mensual | S/ 2,500 – S/ 7,000 |
| Gasto mensual en apuestas | S/ 50 – S/ 300 |
| Activos en | Fútbol europeo (Champions, Premier, La Liga), Liga 1 Perú, Eliminatorias |
| Casas habituales | 2-3 simultáneas (Betsson, Te Apuesto, Inkabet, Stake) |
| Canales digitales | TikTok, Instagram, WhatsApp, YouTube |
| Lo que busca en Habla! | Tips de calidad, comparar cuotas, comunidad de pares, mejorar disciplina |

### **Buyer Persona secundario: "El Apostador Casual del Mundial"**

| **Atributo** | **Descripción** |
| --- | --- |
| Demografía | Hombre, 18-35 años |
| Patrón | Apuesta solo en eventos grandes (Mundial, Copa América, Champions) |
| Tickets típicos | S/ 5 – S/ 30 por apuesta |
| Acquisition objetivo | Mundial 2026; convertirlo en apostador estable es la meta |

## **3.3 Análisis competitivo**

| **Competidor** | **Tipo** | **Fortaleza** | **Debilidad** |
| --- | --- | --- | --- |
| El Crack | Tipster Telegram | 120K+ suscriptores | Sin sitio web, marca débil |
| LATAM Analistas | Tipster multi-país | Cobertura LatAm | No peruano, identidad débil |
| Tipster Perú | Telegram | Transparencia con comprobantes | Operación unipersonal, sin marca |
| ApuestaLegal.pe | Sitio SEO | SEO sólido, lista oficial licencias | Marca aburrida, sin comunidad |
| OneFootball Perú | Sitio SEO global | Marca futbolística mundial | Genérico, no localizado |
| Apuesta.pe | Sitio SEO | Posicionamiento Perú | Diseño anticuado |
| SportyTrader | Sitio SEO global | Cobertura masiva | Español neutro |

### **Ventana de oportunidad**

Ningún competidor local combina simultáneamente identidad de marca peruana fuerte, cobertura editorial dinámica por partido con paywall por nivel (Free/Socios), comunidad gamificada con premios reales, comparador de cuotas y diseño dual mobile + desktop con paridad de calidad y producto Socios automatizado. Es el espacio que ocupa OLBG en UK.

## **3.4 Tendencias del sector**

- Mundial 2026: pico histórico de interés.
- Te Apuesto como sponsor oficial de la Liga 1 — legitimidad social al betting.
- Movilidad: 75%+ del tráfico viene de móvil.
- TikTok como canal dominante de adquisición para jóvenes.
- Regulación MINCETUR vigente desde febrero 2024.
- WhatsApp como canal dominante de comunicación en Perú.

---

# **4. Productos Core**

## **4.1 Estructura general**

Habla! opera cuatro productos con jerarquía explícita, todos lanzados simultáneamente el 8 de mayo de 2026:

| **Producto** | **Rol** | **Naturaleza** | **Visibilidad** |
| --- | --- | --- | --- |
| **Las Fijas** (B) | Cara visible #1 | Dinámico por partido + paywall Free/Socios | Hero, navegación principal |
| **La Liga Habla!** (C) | Cara visible #2 | Dinámico (ranking en tiempo real) | Hero, navegación principal |
| **Reviews y Guías** (A) | Soporte invisible | Estático (actualización trimestral) | Footer, links contextuales |
| **Socios** | Motor de MRR | Dinámico (picks diarios automatizados) | Sección dedicada + CTA en B y C |

URLs definitivas: `/las-fijas`, `/liga`, `/socios`, `/reviews-y-guias`, `/perfil`, `/socios-hub` (área Socios activos).

## **4.2 Las Fijas (Producto B) — paywall por nivel**

### **Qué es**

Cobertura editorial individual de cada partido relevante. Cada partido tiene una vista propia (`/las-fijas/[match-slug]`) que se monta sobre dos niveles de análisis técnicamente separados:

**Análisis Free (visible para todos, incluso sin registro):**
- Hero del partido con countdown, equipos, datos clave.
- Pronóstico Habla! 1X2 con probabilidad calculada por el motor.
- Mejor cuota Local + comparador de cuotas en vivo entre todas las casas afiliadas.
- Análisis básico: forma reciente, head-to-head, lesiones.
- Redacción explicativa corta del editor (única parte editable manualmente).
- Pick Socios bloqueado con blur (gancho de upgrade).
- Widget de invitación a competir en la Liga Habla!.

**Análisis Socios (desbloqueado con suscripción):**
- Combinada óptima recomendada con cuota.
- Stake sugerido (% bankroll).
- EV+ calculado.
- Casa con mejor cuota explícita.
- Confianza del modelo.
- Razonamiento detallado (~150 palabras, generado por motor + edición humana de la redacción).
- Mercados secundarios con value (BTTS, ±2.5 goles, tarjeta roja, etc.) si el motor identifica EV+ positivo.

### **Cómo se controla qué es Free vs Socios**

La política se define globalmente en `/admin/paywall` con toggles por elemento. Default actual:

| **Elemento** | **Free** | **Socios** |
| --- | --- | --- |
| Pronóstico 1X2 + probabilidad | ✅ | ✅ |
| Mejor cuota Local + comparador completo | ✅ | ✅ |
| Análisis básico (forma, H2H, lesiones) | ✅ | ✅ |
| Combinada óptima + stake + EV+ | 🔒 | ✅ |
| Razonamiento detallado | 🔒 | ✅ |
| Mercados secundarios con value | 🔒 | ✅ |
| Análisis complementario general (no por partido) | 🔒 | ✅ |

El editor puede sobreescribir la política por partido individual desde la pantalla de Partidos.

### **Producción**

Combinación de templates pre-definidos + Claude API + datos automatizados (api-football). El motor genera ambas versiones (Free + Socios) simultáneamente para cada partido del Filtro 1. El editor valida y edita solo la redacción/razonamiento, los datos numéricos son del motor.

Cadencia: 2-3 partidos cubiertos al día en período normal, 4-6 al día en Mundial.

## **4.3 La Liga Habla! (Producto C)**

### **Qué es**

Competencia comunitaria gratuita con leaderboard mensual público y premios reales en efectivo. La entrada es gratuita, no hay moneda virtual, y los premios mensuales del Top 10 los financia la operación con sus ingresos de afiliación.

### **Mecánica del producto**

- El usuario se registra gratis con email + verificación (NextAuth ya existente).
- Para los partidos elegibles (que pasaron el Filtro 2), arma una **combinada final** con 5 predicciones — una sola por partido, editable cuantas veces quiera hasta el kickoff.
- Mercados de la combinada: Resultado 1X2 (3 pts), Ambos anotan (2 pts), Más de 2.5 goles (2 pts), Hay tarjeta roja (6 pts), Marcador exacto (8 pts). Máximo 21 puntos por combinada.
- Los puntos se acumulan en un leaderboard mensual público, con ranking en vivo durante los partidos vía WebSockets.
- El día 1 de cada mes a las 00:01 hora Lima, un cron interno cierra el leaderboard, asigna premios al Top 10 y dispara emails para coordinar el pago.

### **Visibilidad de partidos elegibles**

Solo se muestran como visibles al público los partidos elegibles (Filtro 2) cuyo kickoff esté dentro de los próximos 7 días. La regla es automática pero el admin puede sobreescribirla por partido (mantener oculto un partido de fecha cercana, o hacer visible uno más lejano).

### **Estructura de premios mensuales**

| **Posición** | **Premio en efectivo** | **Bonus** |
| --- | --- | --- |
| 1° lugar | S/ 500 | 12 meses Socios gratis |
| 2° - 3° | S/ 200 c/u | 6 meses Socios |
| 4° - 10° | S/ 50 c/u | 1 mes Socios |
| Premio total mensual | S/ 1,250 | + Socios otorgado automáticamente |

### **Por qué es legalmente seguro**

- Entrada gratuita: no hay buy-in. No es apuesta según la Ley 31806.
- Premios pagados por la plataforma con ingresos de afiliación. No es pozo de jugadores.
- Es un concurso de habilidad. No aplica la Ley 28036 de promociones por sorteo.
- Una combinada final por partido por jugador (no múltiples) — simplifica la mecánica y elimina ambigüedad.

## **4.4 Sincronía Las Fijas ↔ Liga Habla!**

Productos B y C están sincronizados por partido. Cada partido elegible Liga tiene una vista doble:

- `/las-fijas/[match-slug]` → análisis editorial + paywall Free/Socios
- `/liga/[match-slug]` → modal de combinada + ranking en vivo del partido

Cada vista incluye widgets de la otra:
- En Las Fijas: "🏆 Compite por este partido en la Liga Habla! · 234 tipsters · [Hacer mi combinada]"
- En Liga: "📊 Ver análisis completo y cuotas comparadas → [Ir al análisis]"

Esto multiplica el tiempo en sitio y reduce el costo marginal de tráfico.

## **4.5 Reviews y Guías (Producto A)**

### **Qué es**

Conjunto estático de contenido que sirve de soporte permanente:

- Reseñas editoriales de cada casa autorizada MINCETUR (`/reviews-y-guias/casas/[slug]`).
- Guías evergreen sobre cómo apostar, glosario, tipos de mercado, gestión de bankroll (`/reviews-y-guias/guias/[slug]`).

### **Cuándo aparece**

Reviews y Guías nunca aparece como hero ni en la navegación principal hero. Aparece:
- Como pestaña dedicada en la navegación inferior y hamburguesa móvil.
- Como link contextual cuando Las Fijas o Liga usan un término técnico.
- En el footer organizado por categorías.
- Como destino de tráfico SEO de cola larga.

### **Función estratégica**

Captura tráfico SEO informativo y lo redirige a Las Fijas o Liga. Construye confianza en la marca al educar antes de vender.

## **4.6 Sistema de CTAs jerárquicos**

Cada vista de Las Fijas y Liga incluye **CTAs simultáneos** cuya jerarquía visual cambia según el estado del usuario logueado:

| **Estado del usuario** | **CTA dominante** | **CTA secundario** |
| --- | --- | --- |
| Visitante anónimo | Registro Liga Habla! gratis | Conocer Socios |
| Registrado free | Hacete Socio (FOMO de pick bloqueado) | Apostar en casa |
| Socio | Apostar en casa con mejor cuota | Ir a hub Socios |
| FTD activo (no Socio) | Hacete Socio (banner persistente) | Cross-sell de casa diferente |

Esta jerarquía dinámica se implementa con segmentación en tiempo real basada en la sesión NextAuth + tabla `EventoAnalytica` que registra el estado de conversión.

## **4.7 Socios Habla! (lanzamiento 8 mayo 2026, expansión agosto)**

### **Arquitectura de distribución: WhatsApp Channel + Business API**

| **Componente** | **Función** | **Por qué** |
| --- | --- | --- |
| WhatsApp Channel privado *Habla! Socios* | Distribución broadcast de los 2-4 picks/día y alertas en vivo | Ilimitado, broadcast-only, sin chat caótico |
| WhatsApp Business API + Bot | Atención individual 1:1 (FAQ, soporte, confirmación de pago, recordatorios) | Permite respuestas personalizadas |
| WhatsApp Channel público *Habla!* | Marketing y teasers gratuitos | Atrae prospectos hacia Socios |

### **Controles de acceso al canal**

1. El link de invitación al canal Socios NUNCA es público. Se entrega vía email automatizado tras confirmación de pago en OpenPay.
2. El canal se rota cada 6 meses (link nuevo, requiere re-invitación).
3. Cron diario verifica suscripciones activas vs miembros del canal y remueve a quienes cancelaron.
4. Cada pick incluye watermark con email del usuario en la imagen.

### **Inclusiones del producto al lanzamiento (8 mayo)**

- 2-4 picks de valor por día con análisis estadístico generado vía Claude API + datos.
- Análisis Socios desbloqueado en cada partido cubierto en `/las-fijas/[slug]`.
- Hub Socios (`/socios-hub`) con resumen de picks del día, performance histórica, próximo análisis profundo.
- Alertas en vivo automatizadas durante partidos top.
- Cada pick recomienda explícitamente la casa con mejor cuota disponible (RevShare cruzado).
- Bot de FAQ instantáneo vía WhatsApp Business API.
- Resumen semanal automatizado los lunes.
- Watermark con email para trazabilidad.

### **Inclusiones que se agregan más adelante**

- Sección Socios extendida en sitio con contenido complementario general (no atado a partido específico): análisis macro de ligas, criterios de bankroll, lecturas de mercado, tendencias del sector.
- Onboarding eventual de 1-2 tipsters colaboradores especializados (Liga 1 / fútbol europeo).
- Bonos exclusivos negociados con casas para Socios.

### **Estructura de los picks (formato fijo)**

```
🎯 PICK #N · [Liga] · [Hora Lima]
[Equipo Local] vs [Equipo Visitante]

🏆 Recomendación: [Mercado] @ [Cuota]
🏠 Casa con mejor cuota: [Casa] → [link afiliado]
💰 Stake sugerido: [%] del bankroll
📊 EV+ calculado: [%]

📝 Razonamiento (datos):
• [Stat 1: forma reciente]
• [Stat 2: head-to-head]
• [Stat 3: contexto del partido]

⚠️ Solo apuesta lo que estés dispuesto a perder.
```

### **Precios**

| **Plan** | **Precio** | **Inclusiones** |
| --- | --- | --- |
| Mensual | S/ 49 | Acceso al canal, alertas en vivo, bot FAQ 24/7, análisis Socios desbloqueado en sitio |
| Trimestral | S/ 119 (S/ 39.6/mes equivalente) | Todo lo anterior + bono de ebook (cuando se lance en oct) |
| Anual | S/ 399 (S/ 33.2/mes equivalente, -32%) | Todo lo anterior + sesión 1-a-1 de bienvenida + acceso al curso (oct) |

Conversión esperada free → Socio: 1-2% de usuarios free activos mensuales. Conversión esperada del Top 50 del leaderboard mensual (trial gratis) a pago: 25-40%.

### **Estructura de costos Socios**

| **Componente** | **Costo** |
| --- | --- |
| WhatsApp Channel (broadcast) | Gratis |
| WhatsApp Business API (mensajes 1:1) | ~US$ 0.005-0.01/mensaje |
| Claude API para generación de picks y FAQ | ~US$ 1.5-2/día |
| Datos deportivos | api-football ya pagado |
| Comparador de cuotas | odds-cache existente, costo cero |
| OpenPay by BBVA | 3.44% + IGV |
| Tiempo del operador | ~30 min/día (validación + escalación) |
| **Total operativo aproximado** | **US$ 3-5 por día** |

A 1,500 Socios estables el ingreso bruto es S/ 67,500/mes ≈ US$ 18,000/mes. Margen bruto Socios ≈ 95%. Margen neto: 80-85%.

### **Procesamiento de pagos**

- OpenPay by BBVA, integrado en el sprint pre-launch (debe estar activo el 8 mayo).
- Cobertura: tarjetas Visa, Mastercard, Amex, Diners. Comisión hasta 3.44% + IGV.
- Suscripciones recurrentes con manejo automático de renovaciones y cancelaciones.
- Webhook OpenPay → endpoint Habla! → entrega automatizada del link de invitación al canal vía email + WhatsApp.

### **Evolución del motor de análisis (dirección estratégica)**

El motor automático genera análisis por partido vía Claude API. Esto es ventaja competitiva porque permite cobertura de 12+ partidos/día sin un equipo de redactores y mantiene consistencia editorial.

A nivel infraestructura, desde el día 1 del lanzamiento se versiona cada prompt y se guarda el snapshot completo de inputs que recibió Claude para cada análisis (campos `promptVersion` e `inputsJSON` en la entidad `AnalisisPartido`). Esto permite reproducir, debuggear y comparar performance entre versiones de prompt a lo largo del tiempo. Sin esta infraestructura cualquier ajuste del modelo es ciego.

A nivel evolución del modelo, la dirección estratégica es incorporar progresivamente un modelo cuantitativo independiente (estilo Elo / SPI / Dixon-Coles / xG ajustado) que calcule probabilidades base a partir de datos históricos de las ligas cubiertas, y que Claude reciba como input para refinar cualitativamente con factores no numéricos (lesiones, motivación, contexto del torneo). Esto se hace en fases:

- **Fase 1 (lanzamiento)**: Claude estima probabilidades a partir de cuotas implícitas + datos básicos de api-football. Calidad razonable validada manualmente.
- **Fase 2 (junio-octubre)**: con 80-100+ partidos evaluados acumulados, iteración del prompt con base empírica.
- **Fase 3 (octubre-diciembre)**: implementación de modelo cuantitativo base con histórico real de ligas cubiertas, integrado al prompt como input adicional.
- **Fase 4 (2027)**: modelo cuantitativo refinado (xG ajustado, ratings por jugador, factor local, etc.); Claude pasa a aportar solo interpretación cualitativa.

Esta evolución no compromete fechas públicas y no es bloqueante para el lanzamiento. Los KPIs del motor (sección 8.7) siguen aplicando en cada fase y son la herramienta para decidir cuándo conviene avanzar de una fase a la siguiente.

## **4.8 Productos Educativos (Octubre 2026)**

| **Producto** | **Precio** | **Descripción** |
| --- | --- | --- |
| Curso "Apuestas Inteligentes Habla!" | S/ 199 | 8 módulos de video, 4 horas. Plataforma in-house |
| E-book "Manual del Apostador Peruano 2026" | S/ 39 | PDF + plantillas Excel + checklist |
| Coaching 1-a-1 | S/ 99/sesión | 60 min vía Zoom |

Plataforma de cursos in-house: video privado servido vía Cloudflare R2 con auth gate sobre el sistema NextAuth. Cero costo recurrente adicional.

---

# **5. Modelo de Captación y Retención**

## **5.1 Etapas del usuario**

| **Etapa** | **Estado** | **Personas (pico Mundial)** |
| --- | --- | --- |
| 0 | Visitante anónimo | 100,000/mes |
| 1 | Visitante comprometido | 25,000/mes |
| 2 | Registrado free Habla! | 5,000/mes nuevos |
| 3 | Click a casa de apuestas | 1,500/mes |
| 4 | Registrado en casa | 450/mes |
| 5 | FTD (First Time Depositor) | 90/mes nuevos |
| 6 | Apostador recurrente activo | 27/mes pasan a recurrente |
| 7 | Socio Habla! | 75/mes nuevos (de pool MAU total) |
| 8 | Usuario ideal (Socio + afiliado activo) | 20-30/mes |

## **5.2 Captación: etapas 0 → 5**

### **Etapa 0 → 1 (Visitante anónimo → Comprometido)**

**Driver**: Las Fijas y Liga Habla! como cara visible. Cada uno tiene contenido suficiente para retener al usuario más allá del rebote inicial.

**Servicios involucrados**:
- Análisis Free disponible para todos en cada partido cubierto.
- Comparador de cuotas embebido.
- Leaderboard en vivo de la Liga (gancho de gamificación).
- Voz de marca peruana y diseño dual mobile + desktop según mockup.

### **Etapa 1 → 2 (Comprometido → Registrado free)**

**Driver primario**: Liga Habla! con premios reales en efectivo.
**Driver secundario**: Análisis Socios bloqueado en cada Fija (FOMO).

**Servicios involucrados**:
- CTA "Compite por S/ 500/mes" omnipresente en Las Fijas y Liga.
- Registro sin fricción: Google OAuth + magic link.
- Sistema de niveles y stats personales en `/perfil`.
- Newsletter semanal con teaser de picks.

### **Etapa 2 → 3 (Registrado → Click a casa)**

**Driver**: comparador de cuotas con botones directos a casas + reseñas con CTA "Abrir cuenta + bono S/ X".

**Servicios involucrados**:
- Comparador de cuotas en cada vista de Las Fijas con botón "Apostar" por casa.
- Reviews destacadas en footer + carousel "Casas autorizadas top" en home.
- Endpoint `/go/[casa-slug]` con tracking + UTM tags.
- Badge "Autorizada MINCETUR" como sello de confianza.

### **Etapa 3 → 4 (Click → Registrado en casa)**

**Driver**: confianza acumulada de la marca + contenido pre-warm.

**Servicios involucrados**:
- Reviews detalladas de cada casa accesibles vía link contextual.
- Códigos de bono visibles antes del click.
- Verificación visible de autorización MINCETUR.
- Cookie de tracking de 30 días en `/go/[casa]`.

### **Etapa 4 → 5 (Registrado en casa → FTD)**

**Driver**: bono de bienvenida de la casa + contenido de Habla! que muestra cómo aprovecharlo.

**Servicios involucrados**:
- Guías paso a paso "Cómo registrarse en X" (link contextual).
- Newsletter automatizada con recordatorios de bonos por vencer.
- Push notifications con pronóstico del día.

## **5.3 Retención y acompañamiento: etapas 5 → 8**

### **Etapa 5 → 6 (FTD → Apostador recurrente)**

**Driver**: rutina diaria construida alrededor de Las Fijas y Liga.

**Servicios involucrados**:
- Las Fijas y Liga siguen siendo el hub diario.
- Newsletter semanal automática.
- Push notifications de cambios de cuotas.
- Liga Habla! sigue activa (acumula puntos cada mes).

### **Etapa 6 → 7 (Recurrente → Socio)**

**Driver primario**: pick bloqueado en cada Fija + banner persistente segmentado.
**Driver secundario**: premio Top 10 mensual incluye 1-12 meses Socios gratis.

**Servicios involucrados**:
- Análisis Socios bloqueado con blur en cada vista de Las Fijas.
- Banner segmentado: "Tu % de acierto: X%. Picks Socios llegan a Y%. Prueba 7 días gratis".
- Email de upgrade segmentado a usuarios con 2+ meses de actividad.
- Bundle "Socios + bono de casa con depósito S/ 100" → CAC negativo.

### **Etapa 7 → 8 (Socio → Socio + Afiliado activo cruzado)**

**Driver**: cada pick Socios recomienda casa específica con mejor cuota disponible.

**Servicios involucrados**:
- Canal WhatsApp con picks que incluyen enlace afiliado a la casa con mejor cuota.
- Bonos exclusivos negociados con casas para Socios.
- Análisis quincenales que sugieren distribuir bankroll en 2-3 casas.

## **5.4 Sinergias clave del modelo**

1. **Liga gratis → Las Fijas con afiliados**: los usuarios registrados para competir terminan haciendo click a enlaces de afiliado durante el flujo natural.
2. **Premios Liga → Socios pago**: ganadores Top 10 reciben Socios gratis 1-12 meses. Tasa típica de conversión a pago al terminar: 25-40%.
3. **Socios → Afiliados cruzados**: cada pick recomienda casa específica. Los Socios abren cuentas en 2-3 casas distintas, multiplicando el RevShare por usuario.
4. **Pick bloqueado → Socios**: el FOMO de no ver el análisis Socios convierte mejor que cualquier banner explícito.
5. **Reviews y Guías → menos rebote**: el usuario con duda técnica encuentra respuesta sin abandonar el ecosistema.

## **5.5 Reglas operativas del modelo**

1. Las Fijas y Liga son la cara visible. Reviews y Guías nunca aparece en hero ni en navegación principal.
2. Cada vista de Las Fijas y Liga tiene CTAs simultáneos jerarquizados según el estado del usuario.
3. El "análisis Socios bloqueado" es la herramienta principal de conversión desde día 1.
4. WhatsApp Business API + Claude + datos = Socios escalable. No hay tipsters humanos full-time.
5. Una vez FTD, los CTAs se segmentan: el usuario con cuenta en Betsson nunca debe ver banner de Betsson — debe ver Stake o Betano (cross-sell).
6. Socios es la graduación natural del usuario activo, no venta agresiva. El upgrade ocurre cuando el usuario lleva 2-3 meses consumiendo Las Fijas + Liga activamente.
7. El leaderboard de Liga es la mejor lista de prospectos para Socios. Los Top 50 mensuales reciben automáticamente trial Socios al cierre de mes.

---

# **6. Modelo de Negocio**

## **6.1 Fuentes de ingreso**

### **Afiliación (motor principal del año 1)**

| **Modelo** | **Típico global** | **Perú** |
| --- | --- | --- |
| CPA fijo | US$ 50-200 | US$ 40-120 |
| Revenue Share | 25%-40% NGR | 25%-35% |
| Híbrido (recomendado) | CPA bajo + RevShare | US$ 30-50 + 20-30% RS |

### **Casas objetivo iniciales (4-6 deals para 8 mayo)**

| **Casa** | **Programa** | **Notas** |
| --- | --- | --- |
| Betsson Group Affiliates | Income Access | Cubre Betsson + Inkabet. RevShare 25-45%, no negative carryover |
| Betano (Kaizen Gaming) | Income Access | Opera oficialmente en Perú. RevShare 20-30% |
| 1xBet Partners | Programa global | Más fácil de cerrar (24-48h). RevShare 15-40%, pago semanal |
| Stake | Programa global | Crypto payouts |
| Coolbet / Doradobet / Retabet | Operadores con licencia MINCETUR | Reemplazos de Te Apuesto (sin programa público) |

### **Suscripción Socios (motor de valuación)**

| **Plan** | **Precio** | **LTV ponderado** |
| --- | --- | --- |
| Mensual S/ 49 | S/ 49/mes | S/ 103 |
| Trimestral S/ 119 | S/ 39.6/mes equivalente | S/ 50 |
| Anual S/ 399 | S/ 33.2/mes equivalente | S/ 40 |
| **LTV ponderado por mix típico** | — | **~S/ 193** |

### **Productos educativos**

| **Producto** | **Precio** | **Margen** |
| --- | --- | --- |
| Curso | S/ 199 | ~95% |
| E-book | S/ 39 | ~98% |
| Coaching 1-a-1 | S/ 99/sesión | ~70% |

## **6.2 Unit Economics**

### **Comparación de LTV por canal**

| **Canal** | **LTV bruto** | **LTV neto** | **Cash en mes 1** |
| --- | --- | --- | --- |
| Afiliación (por FTD) | ~S/ 410 | ~S/ 390 | ~45% |
| Socios (por suscriptor) | ~S/ 193 | ~S/ 110 | ~25% |
| Usuario ideal (Socio + 2 casas) | S/ 500-600 combinado | S/ 450-540 | ~30% |

### **Funnel de conversión esperado**

| **Etapa de embudo** | **Conversión mes 1-3** | **Conversión mes 4+** |
| --- | --- | --- |
| Visita → Click a casa | 5-12% | 8-15% |
| Click → Registro en casa | 25-35% | 25-40% |
| Registro casa → FTD | 15-25% | 20-30% |
| **Visita → FTD compuesto** | **0.2% - 1.0%** | **0.4% - 1.8%** |
| Visita → Registro free Habla! | 5-10% | 7-12% |
| Free → Socio (de MAU) | 1% | 1-2% |

### **Distribución esperada del ingreso (Año 1)**

| **Canal** | **% del ingreso anual** |
| --- | --- |
| Afiliación | 75-80% |
| Socios | 15-20% |
| Productos educativos | 5% |

## **6.3 Proyección de ingresos Año 1**

| **Período** | **Audiencia mensual** | **Afiliación neto** | **Socios neto** | **Total mensual** |
| --- | --- | --- | --- | --- |
| Mayo 2026 (lanzamiento, Socios activo) | 20K | S/ 6,000 | S/ 1,500 | S/ 7,500 |
| Junio (pre-Mundial + Mundial) | 80K | S/ 35,000 | S/ 6,000 | S/ 41,000 |
| Julio (Mundial pico) | 200K | S/ 80,000 | S/ 18,000 | S/ 98,000 |
| Agosto (Socios expansión) | 60K | S/ 35,000 | S/ 22,000 | S/ 57,000 |
| Septiembre - Octubre | 50K | S/ 40,000 | S/ 28,000 | S/ 68,000 |
| Noviembre - Enero | 45K | S/ 42,000 | S/ 35,000 | S/ 77,000 |
| Febrero - Abril 2027 | 50K | S/ 50,000 | S/ 45,000 | S/ 95,000 |

**Total estimado año 1:** ~S/ 900,000-950,000 netos.

---

# **7. Operación y Stack Técnico**

## **7.1 Stack técnico**

| **Componente** | **Tecnología** | **Estado** |
| --- | --- | --- |
| Frontend | Next.js 14 + Tailwind 3.4 (PWA, paridad mobile + desktop) | Producción |
| Backend | Next.js Route Handlers | Producción |
| Base de datos | PostgreSQL 16 + Prisma | Producción en Railway |
| Realtime | Redis 7 + Socket.io | Producción |
| Auth | NextAuth v5 (Google OAuth + magic link) | Producción |
| Datos deportivos | api-football.com (incluye odds endpoint) | Producción |
| Email transaccional | Resend | Producción |
| Hosting | Railway | Producción |
| DNS + CDN | Cloudflare | Producción |
| Object storage | Cloudflare R2 | Producción |
| Pagos | OpenPay by BBVA | Sprint pre-launch (8 mayo) |
| Distribución Socios | WhatsApp Channel privado (gratis, broadcast ilimitado) | Sprint pre-launch (8 mayo) |
| Atención individual Socios | WhatsApp Business API | Sprint pre-launch (8 mayo) |
| Generación de contenido | Claude API (Anthropic) | Sprint pre-launch (8 mayo) |
| Monorepo | pnpm 10 + Turborepo | Producción |

### **Política de servicios externos**

Habla! NO utiliza servicios de terceros más allá de la infraestructura core. Todas las funciones que típicamente se delegarían a SaaS están implementadas in-house:

| **Función** | **Solución in-house** |
| --- | --- |
| Error tracking | Logging Pino → Railway logs + LogError en Postgres + email alerts |
| Analytics de producto | Tabla EventoAnalytica en Postgres + vistas SQL + dashboard admin propio |
| A/B testing y feature flags | Tabla FeatureFlag en Postgres |
| CMS de contenido editorial | Archivos MDX en `apps/web/content/` |
| Plataforma de cursos | Video privado en R2 + auth gate NextAuth |
| Tracking de afiliados | Endpoint `/go/[casa]` + tabla ClickAfiliado |
| Newsletter | Resend + cron in-process + plantillas MDX |

## **7.2 Sistema admin: modelo de filtros**

El admin opera sobre un pipeline explícito con tres etapas:

```
API-Football  →  Filtro 1 (Mostrar al público)  →  Filtro 2 (Liga elegible)
   312 partidos     87 partidos visibles            12 partidos suman puntos
   próximos 7d      con análisis Free + Socios      al ranking del mes
```

**Reglas del pipeline:**

1. **API-Football es la única fuente de verdad**. Lo que no aparece ahí no se muestra. Es read-only.
2. **Filtro 1 (Mostrar al público)**: el admin activa/desactiva cada partido. Al activarlo, el motor genera automáticamente:
   - Análisis Free (pronóstico 1X2 + probabilidad + mejor cuota + datos básicos).
   - Análisis Socios (combinada óptima + stake + EV+ + razonamiento + mercados secundarios).
   - Ambos van a la cola de validación. Lo único editable es la redacción/razonamiento.
3. **Filtro 2 (Liga elegible)**: solo activable si el partido pasó Filtro 1. Habilita el partido para sumar puntos en la Liga Habla!. La visibilidad pública en Liga sigue regla de 7 días (override manual posible).

**Vistas admin (14 totales):**

| **Sección** | **Vistas** |
| --- | --- |
| Dashboard | Vista global con KPIs estratégicos del negocio |
| Motor de Fijas | Partidos · Cola validación · Salud motor · Free vs Socios |
| Liga | Torneo del mes · Verificación Top 10 (gestión de pagos a ganadores) |
| Monetización | Embudo · Vinculaciones (WhatsApp · casas · webhooks) · Suscripciones · Channel · Afiliados · Conversiones · Newsletter |
| Análisis | Métricas · KPIs · Cohortes · Mobile Vitals · Finanzas · Alarmas |
| Sistema | Logs · Auditoría · Usuarios |

## **7.3 Operación automatizada (target: ~5-7 hrs/semana)**

### **Procesos completamente automatizados**

| **Proceso** | **Frecuencia** | **Mecanismo** |
| --- | --- | --- |
| Importación de partidos | Cada 6h | Cron + api-football |
| Generación de análisis Free + Socios al activar Filtro 1 | Bajo demanda | Claude API + templates + datos |
| Detección de partidos en vivo + ranking | Cada 30s mientras EN_VIVO | Poller existente |
| Actualización de comparador de cuotas | Cada 30 min | odds-cache service |
| Cierre de leaderboard mensual | Día 1 a las 00:01 Lima | Cron interno |
| Verificación MINCETUR de casas afiliadas | Lunes 06:00 | Scrape semanal |
| Newsletter semanal | Sábado 09:00 (draft) → admin aprueba | Resend |
| Picks Socios (drafts con datos + razonamiento) | Diario 10:00 Lima | Claude API + api-football + odds-cache |
| Distribución de picks aprobados al canal Socios | Diario 12:00 Lima (tras aprobación) | Push al WhatsApp Channel privado |
| Alertas en vivo Socios | En tiempo real | WebSocket trigger + push al Channel |
| Bot de FAQ Socios (1:1) | 24/7 | WhatsApp Business API + Claude API |
| Sincronización membresía Channel ↔ suscripción activa | Diario 03:00 Lima | Cron remueve miembros con subs canceladas |
| Webhook OpenPay → entrega de link Channel | En tiempo real | Tras confirmación de pago |
| Watermark de email en imágenes de picks | En cada pick generado | Servicio de imagen on-the-fly |
| Resumen semanal Socios | Lunes 09:00 Lima | Claude API genera, push al Channel |
| Backups Postgres a R2 | Diario 03:00 | Cron + scripts |
| Health check | Cada 5 min | /api/health + alerta |
| Lighthouse mobile audit | Diario 04:00 Lima | Lighthouse CI → tabla MetricaWebVitals |

### **Intervención humana semanal**

| **Tarea** | **Tiempo semanal** |
| --- | --- |
| Aprobar análisis Free generados (cola validación) | ~30 min |
| Aprobar análisis Socios + picks (cola validación) | ~3.5 hrs (~30 min/día) |
| Aprobar newsletter semanal | ~5 min |
| Coordinar pago de premios mensuales Liga (verificación Top 10) | ~10 min/mes |
| Responder consultas escaladas del bot Socios | ~30-45 min |
| Auditoría manual de membresía Channel (mensual) | ~15 min/mes |
| Revisión de KPIs y dashboard | ~30 min |
| Revisión Core Web Vitals + ajustes mobile | ~30 min |
| **Total semanal** | **~5-7 hrs/semana** |

---

# **8. KPIs y Framework de Evaluación**

Esta sección es el corazón operativo del plan. Cada KPI tiene definición, fórmula, target, umbral de alarma, frecuencia de revisión y acción correctiva. Toda la medición se hace in-house sobre la tabla `EventoAnalytica` en Postgres con vistas SQL agregadas y dashboard admin propio.

## **8.1 Estructura de KPIs**

Los KPIs se organizan en seis grupos que mapean directamente a las vistas admin:

1. **Captación** — etapas 0 → 5 del embudo.
2. **Productos Las Fijas y Liga** — engagement, sincronía, salud del motor.
3. **Conversión** — pasos críticos del embudo (incluye Free → Socio).
4. **Retención** — etapas 5 → 8 del embudo.
5. **Económicos y Operativos** — margen, costo, automatización.
6. **Motor de Fijas** — calidad del modelo automático.

## **8.2 KPIs de Captación (Etapas 0-2)**

| **KPI** | **Target inicial** | **Target maduro** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- | --- |
| Visitantes únicos / mes | 20K (Mes 1) → 200K (Mundial) → 50K (estable) | Crece 5-10% MoM post-Mundial | Caída >20% MoM sin estacionalidad | Semanal |
| Tráfico por canal | SEO 40%, Pauta 30%, Redes 25% | SEO 60%, Pauta 15%, Redes 20% | SEO <30% en mes 6 | Semanal |
| Tasa de rebote | <60% | <50% | >70% sostenido | Semanal |
| Páginas por sesión | >2.0 | >2.5 | <1.5 | Semanal |
| Tiempo promedio en sitio | >2 min | >3.5 min | <1.5 min | Semanal |
| Posiciones SEO de keywords prioritarios | Top 20 en 50% | Top 10 en 70% | Drop >5 posiciones | Mensual |
| Backlinks acumulados | 30 (Mes 3) | 200+ (Mes 12) | 0 ganados en un mes | Mensual |

## **8.3 KPIs Las Fijas y Liga**

| **KPI** | **Target** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- |
| **LAS FIJAS** | | | |
| Vistas únicas por partido | >500 partidos top, >100 resto | <50 en partido top | Semanal |
| Click en comparador de cuotas | >8% | <4% | Semanal |
| Tiempo en página de partido | >3 min | <1.5 min | Semanal |
| Cobertura de partidos top | 100% Liga 1 + Champions + Mundial | <80% | Semanal |
| Click "Hacete Socio" desde análisis bloqueado | >5% de visitantes Free | <2% | Semanal |
| **LIGA HABLA!** | | | |
| Combinadas / partido elegible | >100 partidos top, >30 resto | <10 en partido top | Semanal |
| Tipsters activos / mes | 30% de MAU | <15% | Mensual |
| Ediciones / combinada | >1.5 | <1.0 | Mensual |
| Premios pagados puntualmente | 100% del Top 10 en <7 días | <90% | Mensual |
| **SINCRONÍA Las Fijas ↔ Liga** | | | |
| Click cross-product | >25% | <10% | Semanal |
| Usuarios activos en ambos productos | >60% de MAU | <30% | Mensual |

## **8.4 KPIs de Conversión**

| **KPI** | **Target inicial** | **Target maduro** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- | --- |
| Conversión visita → registro | 5% | 8% | <3% | Semanal |
| Origen del registro | Liga >70% | Liga >80% | Liga <50% | Mensual |
| CTR site-wide afiliados | 5% | 8% | <3% | Semanal |
| CTR por casa | Distribución pareja, ninguna >40% | Top casa <50% | 1 casa >70% | Semanal |
| Click → Registro en casa | 25% | 35% | <15% | Mensual |
| Registro → FTD | 20% | 30% | <10% | Mensual |
| Tiempo medio Registro → FTD | <3 días | <2 días | >7 días | Mensual |
| **Visita → FTD compuesto** | **0.3%** | **0.7%** | **<0.15%** | Mensual |
| FTDs nuevos / mes | 75 (Mes 1), 900 (Mundial), 200 estable | 300+ estable | <50 estable | Mensual |
| Free → Socio (de MAU) | 1% | 2% | <0.5% | Mensual |
| Origen del Socio | Análisis bloqueado >50% | >60% | <30% | Mensual |
| Trial-to-Paid (Top 50 leaderboard) | 25% | 40% | <15% | Mensual |

## **8.5 KPIs de Retención**

| **KPI** | **Target** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- |
| **APOSTADOR ACTIVO (afiliación)** | | | |
| Tenure promedio del FTD | 4-6 meses | <3 meses | Mensual |
| RevShare / FTD / mes | US$ 7-15/mes | <US$ 5/mes | Mensual |
| Cross-sell de casas (FTDs con cuenta en 2+ casas) | 30% | <15% | Trimestral |
| **SOCIOS** | | | |
| MRR | S/ 10K (Sep) → S/ 67K (Mes 12) | Crecimiento <5% MoM | Mensual |
| ARR | S/ 800K hacia Mes 12 | <S/ 500K Mes 12 | Mensual |
| Churn mensual Socios | <20% (inicial) → <12% (maduro) | >30% | Mensual |
| Tenure promedio Socios | 5+ meses inicial → 8+ meses maduro | <3 meses | Mensual |
| ARPU Socios | S/ 45 | <S/ 40 | Mensual |
| LTV Socios | S/ 200+ | <S/ 130 | Mensual |
| Engagement WhatsApp Socios | >85% lecturas/mensajes | <70% | Semanal |
| % Socios con click afiliado en últimos 30d | >70% | <50% | Mensual |
| **MAU GENERAL** | | | |
| MAU | 25K (Mundial pico), 15K (estable) | <8K estable | Mensual |
| DAU/MAU ratio | >15% | <8% | Semanal |
| Retention 7d | >25% | <15% | Mensual |
| Retention 30d | >12% | <6% | Mensual |

## **8.6 KPIs Económicos**

| **KPI** | **Target inicial** | **Target maduro** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- | --- |
| Revenue total mensual | S/ 20K (Mes 1), S/ 80K (Mundial) | S/ 100K+ | <S/ 30K Mes 6+ | Mensual |
| Revenue por canal | Afiliación 80%, Socios 15%, Educativos 5% | Afiliación 60%, Socios 30%, Educativos 10% | Afiliación >90% Mes 12 | Mensual |
| Revenue por casa afiliada | Ninguna casa >35% | Ninguna >35% | Concentración >50% | Mensual |
| CAC | S/ 50-100 | S/ 30-50 | >S/ 150 | Mensual |
| Costo operativo total | <S/ 5K (estable) | <S/ 8K (con Socios maduros) | >S/ 12K | Mensual |
| Costo Socios / suscriptor | <S/ 5/sub/mes | <S/ 3/sub/mes | >S/ 10/sub/mes | Mensual |
| Costo de premios mensuales | S/ 1,250 fijo | S/ 1,250 | Cualquier desvío | Mensual |
| Margen bruto | >90% | >95% | <80% | Mensual |
| Margen operativo | >50% | >70% | <30% | Mensual |
| LTV / CAC ratio | >3x | >5x | <2x | Trimestral |
| Payback period | <3 meses | <2 meses | >6 meses | Trimestral |
| ARPU general | S/ 4 (Mes 1) → S/ 6 (estable) | S/ 8+ | <S/ 2.5 | Mensual |

## **8.7 KPIs Motor de Fijas (nuevo en v3.2)**

Como el motor de generación automática es ahora central a la operación, su salud merece su propia categoría.

| **KPI** | **Target** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- |
| Picks aprobados sin edición | >70% | <50% | Semanal |
| % acierto picks Socios | >55% | <45% | Mensual |
| EV+ realizado del mes | >+8% | <0% | Mensual |
| Tiempo medio validación por pick | <2 min | >5 min | Semanal |
| Latencia generación (Claude API) | <15s | >30s | Diaria |
| Costo Claude API / día | <US$ 5 | >US$ 10 | Diaria |
| Cobertura partidos top | 100% Liga 1 + UEFA + Champions | <90% | Semanal |
| Picks rechazados por validación | <10% | >25% | Semanal |
| Confianza media del modelo | >60% | <50% | Mensual |
| Acierto por mercado: 1X2 | >60% | <50% | Mensual |
| Acierto por mercado: BTTS | >50% | <40% | Mensual |
| Acierto por mercado: ±2.5 goles | >55% | <45% | Mensual |

## **8.8 KPIs Operativos y de Automatización**

| **KPI** | **Target** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- |
| Intervención humana semanal | 5-7 hrs | >10 hrs | Semanal |
| Costo WhatsApp Business API / mes | <US$ 200 | >US$ 400 | Mensual |
| Uptime del sitio | 99.5% | <99% | Semanal |
| Bot Socios - tasa de resolución | >80% | <60% | Semanal |

## **8.9 KPIs de Performance — Mobile y Desktop**

Como ambos viewports son ciudadanos de primera clase, ambos se monitorizan con la misma rigurosidad.

| **KPI** | **Target** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- |
| **MOBILE** | | | |
| Lighthouse Mobile - Performance | >90 | <80 | Diaria |
| Lighthouse Mobile - SEO | >95 | <85 | Diaria |
| Lighthouse Mobile - Accessibility | >90 | <80 | Diaria |
| LCP (Largest Contentful Paint) móvil | <2.5s | >4s | Diaria |
| INP (Interaction to Next Paint) móvil | <200ms | >500ms | Diaria |
| CLS (Cumulative Layout Shift) móvil | <0.1 | >0.25 | Diaria |
| Tiempo carga 4G simulado (móvil) | <3.5s | >6s | Mensual |
| **DESKTOP** | | | |
| Lighthouse Desktop - Performance | >95 | <85 | Diaria |
| Lighthouse Desktop - SEO | >95 | <85 | Diaria |
| Lighthouse Desktop - Accessibility | >95 | <85 | Diaria |
| LCP desktop | <2s | >3s | Diaria |
| INP desktop | <150ms | >300ms | Diaria |
| CLS desktop | <0.1 | >0.25 | Diaria |
| **DISTRIBUCIÓN** | | | |
| % sesiones desde móvil | 75-85% | <65% | Semanal |
| Conversión móvil vs desktop | Paridad ±20% (sin gap sistemático) | Gap >40% en cualquier dirección | Mensual |
| % usuarios con PWA instalada | >5% | <2% | Mensual |

### **Filtro de paridad mobile + desktop para nuevas features**

Cualquier feature nueva se valida en ambos viewports antes del lanzamiento:

**Validación en mobile:**
1. ¿Funciona con una sola mano sosteniendo el teléfono?
2. ¿Carga en <3s en Slow 4G?
3. ¿El CTA principal está en la zona accesible del pulgar (mitad inferior)?
4. ¿Funciona sin necesidad de hover?
5. ¿No hay layout shift al interactuar?

**Validación en desktop:**
1. ¿El layout aprovecha el espacio horizontal disponible (no se ve "estirado mobile")?
2. ¿Los hover states aportan información sin ser indispensables?
3. ¿Los atajos de teclado funcionan donde corresponden (admin)?
4. ¿La densidad de información es la apropiada para una pantalla grande?
5. ¿El CTA principal sigue siendo claro sin perderse en el ancho extra?

**Regla integral:** ningún feature se considera "listo" hasta que cumple ambas listas. La fuente de verdad de cómo debe verse cada vista en cada viewport es el mockup v3.2.

## **8.10 KPIs Canal Socios WhatsApp**

| **KPI** | **Target** | **Alarma** | **Frecuencia** |
| --- | --- | --- | --- |
| Tasa de sincronía membresía Channel ↔ DB | 100% (±1%) | <95% | Diaria |
| Detección de leak del link Channel | 0 | >2 detectados | Semanal |
| Reacciones emoji por pick | >40% de membresía | <15% | Semanal |
| Tasa de apertura push del Channel | >75% | <50% | Semanal |
| Tiempo de entrega del link tras pago | <2 min | >10 min | Diaria |
| Tasa de membresías removidas por cron de sync | 100% | <98% | Mensual |
| Watermark integrity | 0 picks sin watermark | >0 | Semanal |
| Rotación del Channel cada 6 meses | Cumplimiento 100% | Atraso >7 días | Cada 6 meses |

## **8.11 Cadencia de revisión**

### **Diario (~10 min)**

- Dashboard admin: revenue del día, FTDs reportados, errores críticos, costo Claude API.
- Lighthouse Mobile scores y Core Web Vitals.
- Sincronía membresía Channel.
- Tiempo de entrega de link Socios tras pago.
- Salud del motor (latencia, errores).

### **Semanal (~45 min, lunes)**

- Tráfico, CTR, conversiones del embudo.
- Engagement de Las Fijas y Liga.
- Estado de validación de picks Socios.
- Reacciones del Channel Socios por pick.
- Uptime y latencia.
- Bot Socios - tasa de resolución.
- % aprobados sin edición (motor).

### **Mensual (~2 hrs, primer lunes del mes)**

- Cierre del mes: revenue total, distribución por canal, FTDs, MRR, churn.
- Cohortes y retention.
- LTV/CAC actualizados.
- Pago de premios Liga (verificación Top 10 completada).
- Auditoría manual de membresía Channel.
- Reporte ejecutivo con todos los KPIs en rojo, ámbar, verde.

### **Trimestral (~4 hrs)**

- Análisis profundo de cohortes (LTV real vs proyectado).
- Revisión de mix de afiliados.
- Revisión de pricing Socios.
- Auditoría legal y de compliance MINCETUR.
- Revisión de roadmap de productos.
- Auditoría de seguridad del Channel Socios.

## **8.12 Hitos críticos del primer año**

| **Mes** | **Hito** | **Métrica de éxito** |
| --- | --- | --- |
| 1 (Mayo) | Launch simultáneo de los 4 productos | 20K visitas · 75 FTDs · 50 Socios · S/ 22K revenue · Lighthouse Mobile >90 |
| 2 (Junio) | Tracción pre-Mundial | 60K visitas · 200 FTDs · 200 Socios · 5K registros free · S/ 55K revenue |
| 3 (Julio) | Pico Mundial capturado | 200K visitas · 900 FTDs · 600 Socios · S/ 235K revenue · 25K MAU |
| 4 (Agosto) | Socios consolidado (contenido complementario en sitio) | 800 Socios · MRR S/ 36K · churn <20% |
| 6 (Octubre) | Curso lanzado | 30 ventas mes 1 · 1,000 Socios · MRR S/ 45K |
| 9 (Enero 2027) | Operación consolidada | MAU 20K estable · MRR S/ 60K · LTV/CAC >3x |
| 12 (Abril 2027) | Año 1 cerrado | Revenue mensual >S/ 100K · 1,500+ Socios · ARR >S/ 800K |

---

# **9. Objetivo de Lanzamiento**

El compromiso operativo es lanzar el producto completo el **8 de mayo de 2026** con todas las funciones especificadas en el mockup v3.2 funcionando para usuarios reales. No se manejan sprints internos, hitos intermedios ni MVP escalonados — el alcance es el que define el mockup y el deadline es firme.

**Lo que estará en producción el 8 de mayo:**

- Las 10 vistas de la app pública: Home, Las Fijas (lista y detalle), La Liga Habla! (lista y detalle de partido), Modal de combinada, Socios (página de venta), Hub Socios (área del miembro activo), Reviews y Guías, Mi Perfil, Perfil público de jugador.
- Las 14 vistas del panel admin: Dashboard, Partidos, Cola de validación, Salud del motor, Free vs Socios, Torneo del mes, Verificación Top 10, Embudo de monetización, Vinculaciones, KPIs detalle, Cohortes, Logs, Auditoría, Usuarios.
- Los tres estados de autenticación funcionando con todos los componentes adaptativos: Visitante, Logueado free, Socio activo.
- Modelo de filtros del admin (Filtro 1 visibilidad pública + Filtro 2 Liga elegible) con generación automática dual de análisis Free + Socios al activar Filtro 1.
- Sistema de pagos OpenPay activo (sin feature flag).
- WhatsApp Channel privado Socios + Business API + bot de FAQ.
- Programa de afiliación con al menos 4 casas autorizadas MINCETUR.
- PWA con paridad mobile + desktop según mockup v3.2 cumpliendo Lighthouse Mobile >90 y Desktop >95.

**Operación post-lanzamiento (sin cronograma rígido):**

- **Mundial FIFA 2026 (11 jun – 19 jul)**: ventana de captura masiva. Producción intensiva de cobertura de partidos, escalado de picks Socios a 4-6/día, pauta paga aumentada.
- **Expansión de Socios**: cuando el operador determine que la base de Socios y la operación lo justifiquen, se incorpora la sección Socios extendida en sitio (contenido complementario general no atado a un partido), paper picks históricos y 1-2 tipsters colaboradores.
- **Productos educativos**: curso, ebook y coaching se lanzan cuando el contenido base esté listo.
- **Otros deportes y expansión**: NBA, Copa Libertadores fases finales y eventual spin-off LatAm (Colombia, México) se evalúan en función de tracción y bandwidth disponible.

Este plan no maneja fechas para lo post-lanzamiento porque la prioridad absoluta hasta el 8 de mayo es entregar el alcance del mockup. Lo que venga después se cronograma cuando llegue.

---

# **10. Riesgos y Mitigación**

| **Riesgo** | **Probabilidad** | **Impacto** | **Mitigación** |
| --- | --- | --- | --- |
| Lanzamiento se retrasa más allá del 8 mayo | Baja-Media | Alta | Stack reciclado en producción, esfuerzo predominantemente sustractivo. Plan B: launch día 15 mayo |
| WhatsApp Business API verificación demora | Media | Alta | Iniciar trámite de verificación 28 abril. Plan B: WhatsApp regular del operador como fallback temporal |
| Filtración del link del Channel privado Socios | Media | Media | Watermark con email, rotación cada 6 meses, cron de sincronía membresía-suscripción |
| Integración OpenPay no se completa a tiempo | Media | Alta | Iniciar día 1 del sprint. Plan B: cobranza manual con Yape/PLIN durante primera semana |
| Tráfico orgánico no despega antes del Mundial | Media | Alta | Pauta paga agresiva, micro-influencers, contenido viral en TikTok |
| Casas tardan en aprobar afiliación | Alta | Media | Empezar con 1-2 fáciles (1xBet, Betano) |
| Mundial menor a expectativas | Baja | Media | Liga 1 + Champions sostienen demanda continua |
| Penalidad INDECOPI por publicidad | Media | Media | Marcado obligatorio "Publicidad", frase de ludopatía en footer |
| Bus factor 1 (operador único) | Alta | Media | Documentación exhaustiva, Claude como copiloto, freelancers en mes 4 |
| Dependencia de un solo afiliado | Baja | Alta | 4-6 deals desde día 1, ningún operador concentra >35% del revenue |
| Burnout durante Mundial | Alta | Alta | Plan de descanso 2 semanas en julio, automatización agresiva del flujo de picks |
| Cambio regulatorio que limite afiliación | Baja | Alta | Monitoreo Diario Oficial, asesoría legal trimestral, pivot a contenido educativo si fuera necesario |
| Competidor grande (Better Collective LatAm) entra a Perú | Baja | Alta | Ventaja de ser local, marca peruana, comunidad construida |
| Costo Claude API se dispara con escala Socios | Media | Media | Cache agresivo de prompts, optimización de tokens |
| Churn Socios >30% sostenido en primeros meses | Media | Alta | Garantía de 30 días, mejorar % acierto público, ajustar pricing |
| Bot Socios genera respuestas incorrectas | Media | Alta | Validación humana 30 min/día, feedback loop, escalación rápida |
| Performance móvil cae (Lighthouse <80) | Baja | Alta | Lighthouse CI diario con alarma, regresión automática |
| Calidad del motor cae (% acierto <45%) | Media | Alta | KPIs específicos del motor en dashboard, revisión semanal de causas de rechazo |

---

# **11. Conclusión y Próximos Pasos**

Habla! 3.2 consolida un modelo validado: editorial deportivo dinámico con paywall por nivel + comunidad gamificada + producto Socios automatizado vía WhatsApp + afiliación + diseño dual mobile + desktop con paridad de calidad. El modelo está validado globalmente (OLBG, Action Network, Pyckio) y existe demanda local insatisfecha en Perú que ningún competidor está capturando con calidad.

**Lo que cambia respecto a v3.1:**

- **Rebranding de "Premium" a "Socios Habla!"**, alineando la marca con la identidad de comunidad. URLs, copy, KPIs y proyecciones se actualizan en consecuencia.
- **Las Fijas con paywall explícito por nivel** — cada partido tiene dos versiones técnicamente separadas (Free 1X2 + análisis básico, Socios combinada + EV+ + razonamiento), generadas simultáneamente por el motor.
- **Modelo de filtros formal** — el admin opera sobre dos filtros explícitos (Filtro 1: visibilidad pública, Filtro 2: Liga elegible) con reglas claras y trazabilidad completa.
- **Liga simplificada** — una combinada final por partido por jugador (no múltiples) — elimina ambigüedad y facilita el cálculo del leaderboard.
- **Producto A reducido a Reviews + Guías** — pasa a ser pestaña dedicada con foco SEO en lugar de hub de calculadoras.
- **Vistas admin formalizadas** — 14 vistas estructuradas en seis secciones (Dashboard, Motor de Fijas, Liga, Monetización, Análisis, Sistema), cada una con KPIs específicos y acciones contextuales.
- **KPIs del motor automático** — nueva categoría que monitorea calidad de generación (% sin edición, acierto, EV+ realizado, latencia, costo), permitiendo intervenir cuando el motor no está produciendo valor.
- **Vinculaciones de servicios** — vista admin que monitorea sincronía Socios↔Channel, distribución de FTDs por casa, estado de webhooks externos.
- **Embudo de monetización con caminos paralelos** — visualización explícita del funnel afiliación vs Socios, con insights cross-flow (87% de Socios también clickea casas).

**Lo que cambia respecto a v3.0 (resumen acumulado):**

- El plan deja de organizarse en "capas" abstractas y se organiza alrededor de cuatro productos concretos (Las Fijas, Liga, Reviews y Guías, Socios) con jerarquía explícita.
- Modelo formal de captación y retención etapa por etapa.
- Socios sobre WhatsApp Channel + Claude API + datos, eliminando dependencia de tipsters humanos.
- Framework comprehensivo de KPIs con targets, alarmas y acciones correctivas.
- Paridad mobile + desktop según mockup como principio operativo central, con métricas de Core Web Vitals para ambos viewports.

La ventana del Mundial FIFA 2026 (11 jun - 19 jul) ofrece un acelerador único: 34 días entre el lanzamiento (8 mayo) y el kickoff que permiten construir tracción y capturar la masa crítica de usuarios que ingresarán al ecosistema durante el torneo. Con Socios activo desde día 1, este período captura tanto FTDs (afiliación) como suscriptores Socios (MRR).

Con capital inicial de S/ 18K-28K y operación lean apoyada en Claude (Code, Chat, Cowork, API), Habla! puede alcanzar breakeven en mes 2 y consolidar una operación rentable de seis cifras anuales hacia el cierre del año 1, con upside de siete cifras en el escenario optimista. La intervención humana semanal en régimen estable se proyecta en aproximadamente 5-7 horas (incluyendo validación diaria de análisis Socios y picks).

## **Próximos pasos inmediatos**

- Aprobar este plan de negocios v3.2 (final).
- Aprobar el plan de desarrollo por etapas actualizado (documento separado a generar).
- Contactar a los 4-6 programas de afiliados objetivo (Betsson Group Affiliates, Betano, 1xBet, Stake, Coolbet/Doradobet/Retabet).
- Iniciar verificación de Meta Business Account + WhatsApp Business API inmediatamente (es el ítem con mayor riesgo de bloquear el lanzamiento del 8 de mayo).
- Crear el WhatsApp Channel privado Socios y el Channel público Habla! desde la cuenta verificada.
- Iniciar integración OpenPay sin feature flag.
- Iniciar la redacción de Términos y Condiciones, Política de Privacidad actualizadas con un estudio legal — incluir cláusulas específicas de Socios y distribución por WhatsApp.
- Iniciar el registro del banco de datos ante la ANPD (Autoridad Nacional de Protección de Datos Personales).
- Iniciar el sprint técnico de transición el lunes 28 de abril según el plan de etapas.

---

*Versión 3.2 (Final) · Vigente desde mayo 2026*

*Refinamiento de v3.1 basado en cinco decisiones clave: rebranding "Premium" → "Socios Habla!", paywall explícito Free/Socios en Las Fijas, modelo formal de dos filtros (visibilidad pública + Liga elegible), una combinada final por partido en Liga, reorganización del admin en seis secciones con 14 vistas. Reemplaza a las versiones 3.0 y 3.1.*

*— Fin del documento —*

*Confidencial · Mayo 2026*
