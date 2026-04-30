# Glosario — Términos canónicos

Lista de términos consistentes para usar en todo el contenido de Habla!. Si está aquí, **úsalo siempre**. Si no está, agrégalo antes de inventar variantes.

## Lote responsable

**Lote H** — Microcopy + emails + WhatsApp templates.

## Cómo usar este glosario

- **Antes de escribir un texto nuevo:** consulta esta lista.
- **Al traducir o adaptar:** verifica que el término ya está acá.
- **Si descubres un término faltante:** agrégalo en este archivo + commit.

Para Claude Code: cuando generes copy nuevo, valida que los términos usados estén en este glosario antes de finalizar.

## Términos canónicos por categoría

### Producto Habla!

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| Habla! | Habla, HablaPlay, hablaplay.com en copy | Siempre con `!`. En URLs sí va sin (hablaplay.com). |
| Liga Habla! | Comunidad Habla! / Torneo Habla! | El producto C de competencia mensual. |
| Habla! Premium | Premium / Plan Premium | Cuando se habla del producto pago. |
| Habla! Picks | Picks Habla! / Canal Premium | Nombre del WhatsApp Channel privado. |
| pick | tip / consejo / recomendación / fija | "Recomendación de apuesta" en contexto Premium. |
| pick Premium | pick exclusivo / pick pago | Para diferenciar de pronóstico Habla! gratuito. |
| pronóstico Habla! | predicción Habla! / análisis Habla! | El análisis editorial gratuito en `/partidos/[slug]`. |
| comparador de cuotas | tabla de cuotas / cotizador | La sección del producto B que compara casas. |
| Channel privado | Canal privado / grupo de WhatsApp | Es **canal**, no grupo (broadcast 1-a-N). |
| bot FAQ | asistente / chatbot | El bot 1:1 de WhatsApp con Claude API. |

### Apuestas

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| apostar | jugar / play / arriesgar | "Jugar a algo" suena infantil. |
| apuesta | play / jugada | "Hacer una apuesta", no "hacer un play". |
| casa de apuestas | operador / book / bookmaker | "Casa" en singular cuando aplica. |
| cuota | momio / odd | Del SDK de api-football a copy: traducir "odd" → "cuota". |
| stake | apuesta unitaria / monto | "Stake sugerido 3% del bankroll". |
| bankroll | capital / banca | Universal LATAM. |
| EV+ | valor esperado positivo | Mantener "EV+" en copy técnico. Para principiantes: "valor estadístico". |
| BTTS | "Both Teams To Score" / "ambos equipos anotan" | Mostrar como "Ambos anotan: SÍ/NO" en copy user-facing. En WhatsApp pick: "Ambos anotan: SÍ". |
| Over/Under 2.5 | "Más/menos 2.5 goles" | Mostrar como "Más de 2.5 goles" / "Menos de 2.5 goles". |
| 1X2 | resultado / ganador | Mostrar como "Gana local / Empate / Gana visitante". |
| FTD | "First Time Deposit" / primer depósito | "FTD" en copy técnico. Para usuarios: "primer depósito en una casa". |
| acierto | win / hit | "% acierto del último mes". |

### Liga Habla!

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| tipster | jugador / participante / usuario | El usuario que hace predicciones en Liga Habla! |
| predicción | pick / pronóstico / apuesta | Lo que el tipster registra (sin dinero real). |
| ticket | combinada / boleto | El conjunto de 5 mercados predichos por partido. |
| torneo | competencia / liga | Cada partido top abre un torneo. |
| podio | top 3 / mejores | El top 3 del leaderboard. |
| leaderboard | ranking / tabla | Tabla de posiciones del mes. |
| cierre del mes | fin de mes / corte | Cuando el leaderboard se congela y se pagan premios. |
| premio mensual | ganancia / recompensa | El dinero que el ganador recibe en su cuenta. |

### Pista usuario

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| cuenta | perfil / login | "Crear cuenta", "tu cuenta". |
| @username | @handle / nick | El identificador único del usuario. |
| perfil público | profile / página de perfil | `/comunidad/[username]`. |
| FTD reportado | conversión / venta | Lo que reporta una casa cuando un usuario nuestro hizo FTD. |
| comisión de afiliación | commission / referral fee | Lo que la casa nos paga por cada FTD. |
| MINCETUR | MINCETUR (con todas mayúsculas) / Min Cetur | Ministerio de Comercio Exterior y Turismo del Perú. |
| licencia MINCETUR | autorización / permiso | Lo que valida que la casa opera legalmente en Perú. |

### Premium

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| suscripción | membresía / plan / cuenta paga | "Tu suscripción", "cancelar la suscripción". |
| plan | tipo / modalidad | "Plan Mensual / Trimestral / Anual". |
| garantía 7 días | money back guarantee / garantía total | "7 días sin compromiso, reembolso 100%". |
| reembolso | refund / devolución | "Procesar reembolso". |
| renovación | recurrencia / siguiente pago | "Próxima renovación: 30 abril 2027". |
| cancelar | dar de baja / unsubscribe | "Cancelar suscripción". |
| cancelando | en proceso de cancelación | Estado donde acceso sigue vigente hasta vencimiento. |
| vencimiento | expiración / end date | Fecha en que termina el acceso. |
| watermark | marca de agua | El email del usuario en cada pick para anti-leak. |

### Económico

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| MRR | "Monthly Recurring Revenue" / "ingreso recurrente mensual" | "MRR" en admin. Sin acrónimo en user-facing. |
| CAC | costo de adquisición | "CAC" en admin. |
| LTV | lifetime value / "valor de vida del cliente" | "LTV" en admin. |
| ROI | "return on investment" / "retorno" | "ROI" en copy de Premium ("ROI promedio +12%"). |
| margen operativo | operating margin | "margen" en admin. |
| revenue | ingresos / facturación | "revenue" en admin, "ingresos" en user-facing. |

### Técnico

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| OpenPay BBVA | Openpay / pasarela / processor | "Pagos procesados por OpenPay BBVA". |
| WhatsApp Channel | canal de WhatsApp / grupo | El producto de Meta para broadcast 1-a-N. |
| WhatsApp Business API | WA Bot / WhatsApp Business | "WhatsApp Business API" en docs técnicos. |
| Claude API | Anthropic / IA / AI | "Generado con Claude API". |
| OAuth Google | Sign In with Google | "Continuar con Google". |
| magic link | link mágico / passwordless | "Te enviamos un link al email". |

### Estados

| Término canónico | Variantes a EVITAR | Notas |
|---|---|---|
| activa / activo | active / habilitada | "Tu suscripción está activa". |
| pendiente | pending / espera | "Pago pendiente". |
| pagada / pagado | paid / cobrado | "Premio pagado el 5 de mayo". |
| rechazada / rechazado | declined / fallida | "Tarjeta rechazada". |
| vencida / vencido | expirada / caducada | "Suscripción vencida hace 3 días". |
| cancelando | en cancelación | Cancelada pero con acceso vigente. |
| reembolsada / reembolsado | devuelta | "Suscripción reembolsada en garantía". |

## Términos legales y compliance

| Contexto | Término canónico |
|---|---|
| Prohibido a menores | "Solo mayores de 18 años" |
| Apuesta responsable | "Apuesta responsable" (sin "el juego responsable") |
| No es asesoría financiera | "Esto no es asesoría financiera ni inversión" |
| Casa autorizada | "Casa con licencia MINCETUR" |

## Frases prohibidas

NUNCA usar en ninguna comunicación de Habla!:

- "Apuesta segura"
- "Gana garantizado"
- "Sin riesgo"
- "Estrategia infalible"
- "Multiplica tu dinero"
- "Te haremos rico"
- "100% acierto"
- "Sin pérdidas"

Estas frases son ilegales en Perú (Reglamento MINCETUR) Y son falsas estadísticamente.

## Convenciones de capitalización

- **Habla!** siempre con mayúscula y `!`.
- **Premium** mayúscula cuando se refiere al producto. Minúscula como adjetivo común.
- **Channel** mayúscula cuando se refiere al WhatsApp Channel de Habla! Picks. Minúscula en otros contextos.
- **MINCETUR** todas mayúsculas siempre.
- **Acrónimos:** todas mayúsculas (MRR, CAC, LTV, ROI, EV, FTD, BTTS, KPI).

## Convenciones de formato numérico

- **Moneda peruana:** "S/ 49" (con espacio entre símbolo y número).
- **Decimales en cuotas:** 2 decimales fijos: "1.85", "2.10". Punto, no coma.
- **Porcentajes:** sin espacio: "65%". 
- **Cantidades grandes:** comas como separador de miles: "3,180 suscriptores". (Configurar `Intl.NumberFormat('es-PE')`).
- **Fechas:** formato "DD/MM/YYYY" en datos técnicos. "30 de abril de 2026" en copy long-form.
- **Horas:** formato 24h en datos técnicos: "21:00". Formato 12h con am/pm en user-facing: "9:00 PM".

---

*Versión 1 · Abril 2026 · Glosario para Lote H*
