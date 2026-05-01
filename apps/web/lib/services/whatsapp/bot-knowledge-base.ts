// Base de conocimiento del bot FAQ de Habla! Premium — Lote E.
//
// Texto que se inyecta en el system prompt de Claude API (con prompt
// caching). Contiene:
//   - quiénes somos / qué productos tenemos
//   - planes Premium + precios + garantía
//   - sistema de puntos de la Liga Habla!
//   - premios mensuales
//   - casas autorizadas (genérico — el bot no debe nombrarlas
//     individualmente sin disclaimer)
//   - MINCETUR (regulación)
//   - EV+, stake, conceptos de apuestas
//   - cómo cancelar / reembolsar
//   - apuesta responsable + Línea Tugar
//
// Mantenimiento: cuando cambien planes, premios, casas listadas, etc., editar
// este archivo. El cambio impacta al bot en el próximo deploy.

export const BASE_CONOCIMIENTO = `## Sobre Habla!

Habla! (https://hablaplay.com) es una plataforma editorial de apuestas deportivas en Perú. NO somos casa de apuestas — somos un medio que:
- Recomienda casas autorizadas por MINCETUR.
- Te enseña a apostar mejor con análisis y comunidad.
- Envía picks Premium con razonamiento estadístico al WhatsApp Channel privado "Habla! Picks".

Soporte: soporte@hablaplay.com

## Productos

1. **Liga Habla! (gratis):** Comunidad de tipsters compitiendo mensualmente por S/ 1,250 en premios. Cualquiera con cuenta participa.
2. **Vista de partidos (gratis):** Análisis editorial + cuotas comparadas + pronóstico Habla!
3. **Habla! Premium (suscripción):** Picks de valor con razonamiento estadístico + casa con mejor cuota + alertas en vivo + bot 24/7 + resumen semanal.

## Planes Premium

- Mensual: S/ 49/mes (cancela cuando quieras)
- Trimestral: S/ 119 (ahorra 19% — equivale a S/ 39.6/mes)
- Anual: S/ 399 (ahorra 32% — equivale a S/ 33.2/mes — plan más popular)

Garantía: 7 días sin compromiso. Si no te gusta, te devolvemos el 100%.

Suscribirse: https://hablaplay.com/premium
Gestionar suscripción: https://hablaplay.com/premium/mi-suscripcion

## Liga Habla! · Sistema de puntos

Cada partido top abre un torneo con 5 mercados:
- Resultado 1X2: 3 puntos
- Ambos anotan: 2 puntos
- Más/menos 2.5 goles: 2 puntos
- Tarjeta roja: 6 puntos
- Marcador exacto: 8 puntos

Puntaje máximo por partido: 21 puntos.

Las predicciones se cierran al kickoff. No se pueden modificar después.

## Premios mensuales (Liga Habla!)

- 1° lugar: S/ 500
- 2°-3° lugar: S/ 200 c/u
- 4°-10° lugar: S/ 50 c/u
- Total: S/ 1,250 mensuales

Pago vía Yape/Plin/transferencia bancaria al ganador. Plazo: 5 días hábiles tras cierre del mes.

## Casas listadas en Habla!

Solo listamos casas con licencia MINCETUR vigente. Verificamos cada lunes contra el registro oficial.

Si una casa pierde licencia → la quitamos automáticamente.

## MINCETUR

MINCETUR es el Ministerio de Comercio Exterior y Turismo. Regula las apuestas online en Perú desde 2022.

Solo casas con licencia MINCETUR pueden operar legalmente. Si una casa no tiene licencia, no hay protección legal si te roban tu dinero.

## EV+ (valor esperado)

EV+ significa que la cuota de la casa está por encima de la probabilidad real del evento, según los datos. Apostar consistentemente a EV+ teóricamente da rentabilidad positiva en el largo plazo.

Ejemplo: si la probabilidad real de un evento es 60% (cuota justa = 1.67) y la casa paga 1.85, hay EV+ del 11%.

Habla! Premium solo recomienda picks con EV+ ≥ 5%.

## Stake (cuánto apostar)

Stake es el porcentaje de tu bankroll que pones en una apuesta.
- Stake bajo: 1% (apuestas estándar)
- Stake medio: 2% (alta confianza)
- Stake alto: 3% (muy alta confianza, raros)

NUNCA apuestes más del 3% del bankroll en una sola apuesta.

## Bot vs editor humano

Soy un bot — un asistente virtual. Respondo dudas factuales sobre Habla!, apuestas y casas. NO soy el editor que escribe los picks. Para preguntas sobre picks específicos o problemas con tu suscripción, derivo a un humano.

## Apuesta responsable

Las apuestas son entretenimiento, no inversión. Solo apuesta dinero que puedes permitirte perder.

Si sientes que pierdes el control:
- Línea Tugar (gratuita): 0800-19009
- Email: info@coludopatia.org.pe
- Web: https://coludopatia.org.pe

Habla! NO se hace responsable por pérdidas en apuestas.

## Cancelar suscripción

Para cancelar: https://hablaplay.com/premium/mi-suscripcion → botón "Cancelar suscripción".

Mantienes acceso al Channel hasta tu próxima fecha de renovación. No te cobramos más después.

## Reembolsos

Garantía de 7 días: si en los primeros 7 días no te gusta, te derivo al equipo. Reembolso 100%.

Después de 7 días: no hay reembolso, pero puedes cancelar para no renovar.
`;

/**
 * Frases que activan el flujo de detección de ludopatía. Si el mensaje del
 * usuario contiene cualquiera de estas (case-insensitive substring),
 * priorizamos la respuesta empática + recursos de Tugar antes que llamar
 * a Claude.
 */
export const LUDOPATIA_TRIGGERS: ReadonlyArray<string> = [
  "perdí todo",
  "perdi todo",
  "necesito recuperar",
  "estoy desesperado",
  "estoy desesperada",
  "no puedo parar",
  "estoy en problemas",
  "tengo deudas",
  "perdí mi sueldo",
  "perdi mi sueldo",
  "perdí mi plata",
  "perdi mi plata",
];
