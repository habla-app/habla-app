# Catálogo de microcopy

Catálogo completo de strings de UI organizados por superficie del producto. Estos textos viven en `apps/web/lib/copy/index.ts` y se importan donde se usan, evitando hardcoding en componentes.

## Lote responsable

**Lote H** — Microcopy + emails + WhatsApp templates.

## Estado actual del repo

Los textos viven dispersos en componentes de los Lotes 0-11. En Lote H se centralizan en archivos `.ts` por categoría.

## Cambios necesarios

### Estructura de archivos

```
apps/web/lib/copy/
├── index.ts               (re-exporta todo)
├── auth.ts                (login, signup, eliminar cuenta)
├── home.ts                (home `/`)
├── partidos.ts            (Producto B `/partidos/[slug]`)
├── comunidad.ts           (Producto C `/comunidad/*`)
├── premium.ts             (Lote D vistas + componentes embebidos)
├── perfil.ts              (Lote 11 + nuevos)
├── admin.ts               (panel admin)
├── errores.ts             (errores comunes en toda la app)
├── empty-states.ts        (vistas vacías)
└── notificaciones.ts      (toasts y banners — overlap con notificaciones-in-app.spec.md del 7B)
```

Cada archivo exporta un objeto tipado:

```typescript
// apps/web/lib/copy/auth.ts
export const AUTH_COPY = {
  signin: {
    title: 'Entra a Habla!',
    subtitle: 'Continúa con Google o tu email',
    cta_google: 'Continuar con Google',
    cta_magic_link: 'Enviar link al email',
    placeholder_email: 'tu@email.com',
    error_email_invalido: 'Ese email no parece correcto',
    success_link_enviado: 'Te enviamos un link. Revisa tu inbox.',
  },
  // ...
};
```

## Catálogo completo

### auth.ts — Autenticación

```typescript
export const AUTH_COPY = {
  signin: {
    title: 'Entra a Habla!',
    subtitle: 'Continúa con Google o tu email',
    cta_google: 'Continuar con Google',
    cta_magic_link: 'Enviar link al email',
    placeholder_email: 'tu@email.com',
    error_email_invalido: 'Ese email no parece correcto',
    success_link_enviado: 'Te enviamos un link al email. Revisa tu inbox (y la carpeta de spam).',
    error_link_expirado: 'El link expiró. Pide uno nuevo.',
    sin_cuenta: '¿Sin cuenta?',
    crear_cuenta_link: 'Crear una',
  },
  signup: {
    title: 'Crea tu cuenta gratis',
    subtitle: 'Predice partidos. Compite por S/ 1,250 al mes.',
    cta_google: 'Continuar con Google',
    cta_email: 'Continuar con email',
    placeholder_email: 'tu@email.com',
    label_terminos: 'Acepto los términos y privacidad',
    label_mayor_edad: 'Confirmo que tengo 18 años o más',
    error_terminos_requerido: 'Acepta los términos para continuar',
    error_mayor_edad_requerido: 'Habla! es solo para mayores de 18 años',
    ya_tengo_cuenta: '¿Ya tienes cuenta?',
    entrar_link: 'Entra',
  },
  completar_perfil: {
    title: '¡Casi listo!',
    subtitle: 'Elige tu @username para competir en Liga Habla!',
    label_username: 'Tu @username',
    placeholder_username: 'JuanM',
    helper_username: '3-20 caracteres. Solo letras, números y guion bajo.',
    error_disponibilidad: 'Ese @username ya está tomado',
    error_formato: 'Solo letras, números y _',
    error_longitud: 'Mínimo 3 caracteres',
    cta_continuar: 'Empezar',
    aviso_inmutable: '⚠ Este @username no se puede cambiar después.',
  },
  cerrar_sesion: 'Cerrar sesión',
  eliminar_cuenta: {
    title: 'Eliminar mi cuenta',
    paso_1_subtitle: 'Esto es permanente. Te explicamos qué pasa.',
    consecuencias_h: 'Al eliminar tu cuenta:',
    consecuencias: [
      'Pierdes acceso a Habla! inmediatamente',
      'Tus predicciones se conservan anonimizadas (compliance)',
      'Premios pendientes de Liga Habla! se pierden',
      'Si eres Premium, la suscripción se cancela inmediatamente sin reembolso (a menos que estés en garantía 7 días)',
    ],
    cta_continuar: 'Entendido, continuar',
    cta_cancelar: 'Mejor no',
    paso_2_subtitle: 'Confirma escribiendo tu email.',
    placeholder_email_confirm: 'Tu email registrado',
    error_email_no_coincide: 'El email no coincide',
    cta_eliminar_definitivo: 'Eliminar mi cuenta',
    success: 'Tu cuenta fue eliminada. Te extrañaremos.',
  },
};
```

### home.ts — Home `/`

```typescript
export const HOME_COPY = {
  hero: {
    h1_anonimo: 'Apuestas con datos. Sin trampas.',
    h1_authed: 'Hola {nombre}, ¿qué predices hoy?',
    sub_anonimo: 'Compara cuotas, predice partidos top, gana hasta S/ 1,250/mes.',
    sub_authed: 'Tu posición actual: #{posicion} de la Liga Habla!',
    cta_anonimo: '⚡ Crear cuenta gratis',
    cta_authed: 'Ver partidos top →',
  },
  live_banner: {
    label_live: '● EN VIVO',
    cta_ver: 'Ver →',
    descripcion_template: '{local} {goll} - {golv} {visitante} · Min {min}\'',
  },
  partidos_top_section: {
    h2: 'Partidos top de la semana',
    cta_ver_todos: 'Ver todos los partidos →',
  },
  comunidad_preview: {
    h2: 'Liga Habla! · Abril 2026',
    sub: '{tipsters} tipsters compitiendo por S/ 1,250',
    cta: 'Ver leaderboard →',
  },
  blog_section: {
    h2: 'Análisis del editor',
    cta_todos: 'Ver más posts →',
  },
};
```

### partidos.ts — Producto B `/partidos/[slug]`

```typescript
export const PARTIDOS_COPY = {
  hero: {
    label_proximo: 'Próximo partido',
    label_vivo: '● EN VIVO',
    label_finalizado: 'Finalizado',
    fecha_template: '{dia} {fecha} · {hora}',
  },
  pronostico_seccion: {
    h2: 'Pronóstico Habla!',
    sub_anonimo: 'El editor analiza el partido y predice los 5 mercados.',
    sub_user: 'Análisis del editor para los 5 mercados.',
    label_confianza: 'Confianza:',
    label_razonamiento: 'Por qué este pronóstico',
  },
  prediccion_form: {
    h2: 'Tu predicción',
    sub_unauth: 'Crea cuenta gratis para predecir y competir por S/ 1,250 al mes.',
    sub_authed: 'Predice los 5 mercados. Cierra al kickoff.',
    label_resultado: 'Resultado',
    label_btts: 'Ambos anotan',
    label_ou: 'Más / menos 2.5 goles',
    label_roja: 'Habrá tarjeta roja',
    label_marcador: 'Marcador exacto',
    cta_predecir: 'Enviar predicción',
    cta_unauth: '⚡ Crear cuenta y predecir',
    aviso_cierre: 'Cierra al kickoff. No se puede cambiar después.',
    success: '✓ Predicción guardada',
    error: 'No pudimos guardar tu predicción. Intenta de nuevo.',
    error_cerrado: 'Las predicciones para este partido cerraron al kickoff.',
  },
  comparador_cuotas: {
    h2: 'Compara cuotas',
    sub: 'Las casas con licencia MINCETUR.',
    label_mejor_cuota: '★ Mejor cuota',
    cta_apostar: 'Apostar en {casa} →',
    aviso: '_Apuesta responsable. Cuotas pueden cambiar._',
  },
  pick_premium_section: {
    bloqueado_h: '💎 Pick Premium del editor',
    bloqueado_sub_anonimo: 'Crea cuenta y desbloquea con Premium.',
    bloqueado_sub_free: 'Suscríbete para acceder al pick + razonamiento.',
    bloqueado_sub_ftd: 'Tu acierto puede subir a 65% con picks Premium.',
    bloqueado_cta_anonimo: '⚡ Crear cuenta',
    bloqueado_cta_free: '⚡ Probar 7 días',
    desbloqueado_h: '💎 Pick Premium · APROBADO',
    desbloqueado_label_mercado: 'Mercado',
    desbloqueado_label_cuota: 'Cuota sugerida',
    desbloqueado_label_stake: 'Stake',
    desbloqueado_label_ev: 'EV+',
    desbloqueado_label_casa: 'Mejor cuota',
    desbloqueado_cta: 'Apostar en {casa} →',
  },
};
```

### comunidad.ts — Producto C

```typescript
export const COMUNIDAD_COPY = {
  index: {
    h1: 'Liga Habla!',
    sub_template: '{mes} · {tipsters} tipsters · S/ {premio} en premios',
    section_premios_h: 'Premios mensuales',
    section_top10_h: '🏅 Top 10 del mes',
    section_top100_h: '🏆 Top 100',
    cta_ver_mas: 'Ver más',
    section_meses_h: 'Meses cerrados',
  },
  premios: {
    primer: '1° lugar: S/ 500',
    segundo_tercero: '2° y 3° lugar: S/ 200 c/u',
    cuarto_decimo: '4°-10° lugar: S/ 50 c/u',
    total: 'Total mensual: S/ 1,250',
  },
  mis_stats: {
    title_authed: 'Tu posición',
    label_puntos: 'Puntos este mes',
    label_posicion: 'Posición actual',
    label_delta: 'vs semana anterior',
    cta: 'Ver mis predicciones →',
    empty_h: 'Aún no participas este mes',
    empty_cta: 'Hacer primera predicción →',
  },
  torneo_partido: {
    h_template: '{equipoA} vs {equipoB}',
    label_estado_abierto: 'Predicciones abiertas',
    label_estado_cerrado: 'Predicciones cerradas',
    label_cierre_template: 'Cierra en {tiempo}',
    cta_predecir: 'Hacer mi predicción',
    leaderboard_h: 'Ranking del torneo',
    leaderboard_actualiza: 'Se actualiza al final del partido',
  },
  perfil_publico: {
    cta_seguir: '+ Seguir',
    cta_siguiendo: '✓ Siguiendo',
    cta_editar: 'Editar perfil',
    cta_reportar: 'Reportar',
    label_nivel: 'Nivel',
    label_predicciones: 'Predicciones',
    label_aciertos: 'Aciertos',
    label_acierto_pct: '% Acierto',
    label_mejor_mes: 'Mejor mes',
    label_pos_historica: 'Mejor posición',
    h_ultimas: '📊 Últimas predicciones',
    h_mejor_en: '🏆 Mejor en',
    privado: 'Este perfil es privado',
  },
};
```

### premium.ts — Lote D

```typescript
export const PREMIUM_COPY = {
  landing: {
    hero_h: 'Picks de valor en tu WhatsApp',
    hero_sub: 'Recibe 2-4 picks/día con razonamiento estadístico, validados por nuestro editor. Directo en tu canal privado.',
    inclusiones_h: 'Lo que recibes',
    inclusiones: [
      '**2-4 picks/día** con razonamiento estadístico (datos H2H, forma reciente, EV+)',
      '**Casa con mejor cuota** en cada pick — link directo',
      '**Alertas en vivo** durante partidos top (cambios de cuotas, oportunidades)',
      '**Bot FAQ 24/7** en WhatsApp para resolver dudas al instante',
      '**Resumen semanal** los lunes con performance de los picks',
    ],
    plan_mensual_label: 'Mensual',
    plan_mensual_precio: 'S/ 49/mes',
    plan_mensual_helper: 'Cancela cuando quieras',
    plan_trimestral_label: 'Trimestral',
    plan_trimestral_precio: 'S/ 119/3 meses',
    plan_trimestral_helper: 'Ahorra 19% · S/ 39.6/mes',
    plan_anual_label: 'Anual',
    plan_anual_precio: 'S/ 399/año',
    plan_anual_helper: 'Ahorra 32% · S/ 33.2/mes',
    plan_anual_badge: 'Más popular',
    garantia: '✓ Garantía de 7 días · sin compromiso',
    sticky_cta: '⚡ Suscribirme con OpenPay',
    sticky_cta_anonimo: '⚡ Crear cuenta y suscribirme',
  },
  checkout: {
    h: 'Activa tu Premium',
    progress_label: 'Falta 1 paso',
    plan_resumen_cambiar: 'Cambiar plan',
    section_datos: 'Tus datos',
    section_tarjeta: '💳 Tarjeta',
    label_nombre: 'Nombre completo',
    label_email: 'Email',
    label_doc_tipo: 'Tipo de documento',
    label_doc_num: 'Número',
    label_tarjeta_num: 'Número de tarjeta',
    label_vencimiento: 'Vencimiento (MM/AA)',
    label_cvv: 'CVV',
    label_nombre_tarjeta: 'Nombre como aparece en la tarjeta',
    seguridad_1: 'Pago procesado por OpenPay BBVA',
    seguridad_2: 'Tarjeta encriptada con TLS',
    seguridad_3: 'No guardamos datos de tarjeta',
    aviso_terminos: 'Al continuar aceptas términos y privacidad. Renovación automática. Cancela cuando quieras desde tu perfil.',
    cta_pagar_template: '💎 Pagar S/ {monto} · Activar',
    procesando: 'Procesando tu suscripción...',
    procesando_sub: 'Esto puede tomar unos segundos. No cierres esta ventana.',
    error_tarjeta: 'Tu tarjeta fue rechazada por el banco. Intenta con otra.',
    error_duplicado: 'Detectamos un pago reciente. Verificando tu suscripción...',
    error_timeout: 'El proceso está tardando. Recarga esta página en 1 minuto. Si tu tarjeta fue cobrada, recibirás un email.',
    fallback_no_configurado: '⚠ Pagos aún no disponibles. Te avisamos cuando esté listo.',
  },
  post_pago: {
    hero_h: '¡Bienvenido a Premium!',
    hero_sub_template: 'Plan {plan} activo hasta el {fecha}',
    cta_h: 'Únete al Channel',
    cta_sub: 'Solo 1 click para empezar a recibir los picks. El link se abrirá en WhatsApp.',
    cta_btn: '📱 Unirme a Habla! Picks',
    cta_btn_sub: 'Canal privado · Solo suscriptores Premium',
    pasos_h: '📋 Qué pasa ahora',
    pasos: [
      '**Únete al Channel** con el botón verde de arriba.',
      '**Recibirás 2-4 picks/día** con razonamiento estadístico completo.',
      '**El primer pick llega en menos de 24h** (excepto domingos cuando hay menos partidos).',
      '**Para FAQ 24/7** envía cualquier mensaje al WhatsApp del bot.',
    ],
    email_info_template: 'Te enviamos un email a {email} con tu factura y el link al Channel por si lo necesitas después.',
    verificando_h: 'Verificando tu pago...',
    verificando_sub: 'Esto puede tomar 1-2 minutos.',
    verificando_timeout: 'Tu pago se está procesando. Te enviaremos un email cuando esté listo.',
  },
  mi_suscripcion: {
    h: 'Mi suscripción',
    sub: 'Gestiona tu plan, pagos y acceso al Channel',
    estado_activa: '✓ Activa',
    estado_cancelando: '⚠ Cancelando',
    estado_vencida: 'Vencida',
    label_proximo_cobro: 'Próximo cobro',
    label_dias_restantes: 'Días restantes',
    label_acceso_hasta_template: 'Acceso hasta {fecha}',
    section_cambiar_plan_h: '🔄 Cambiar plan',
    cambiar_plan_helper: 'El cambio aplica desde la siguiente renovación',
    section_historial_h: '💳 Historial de pagos',
    historial_descargar_todo: 'Descargar todo',
    section_critica_h: '⚠ Zona crítica',
    cta_cancelar: 'Cancelar suscripción',
    cancelar_modal_h: '¿Cancelar tu suscripción?',
    cancelar_modal_template: 'Mantienes acceso hasta el {fecha}. No te cobramos más después.',
    cancelar_survey_label: '¿Por qué cancelas?',
    cancelar_survey_opts: ['Caro', 'No me sirvió', 'Solo lo probaba', 'Otro motivo'],
    cancelar_confirmar: 'Confirmar cancelación',
    cancelar_volver: 'Mantener suscripción',
    reactivar_cta: 'Reactivar',
  },
};
```

### errores.ts — Errores comunes

```typescript
export const ERRORES_COPY = {
  network: 'Sin conexión. Verifica tu internet.',
  generico: 'Algo salió mal. Intenta de nuevo en un momento.',
  no_autorizado: 'No tienes permiso para hacer esto.',
  no_encontrado: 'No encontramos lo que buscas.',
  rate_limit: 'Demasiadas solicitudes. Espera un momento.',
  validacion_form: 'Revisa los campos marcados.',
  pago_fallido: 'No pudimos procesar tu pago. Intenta con otra tarjeta.',
  prediccion_cerrada: 'Las predicciones para este partido ya cerraron.',
  suscripcion_inactiva: 'Tu suscripción no está activa.',
  email_ya_existe: 'Ya hay una cuenta con ese email. Inicia sesión.',
  username_no_disponible: 'Ese @username ya está tomado.',
  email_no_valido: 'Ese email no parece correcto.',
  contacto_soporte: 'Si el problema sigue, escríbenos: soporte@hablaplay.com',
};
```

### empty-states.ts — Vistas vacías

```typescript
export const EMPTY_COPY = {
  partidos_sin_proximos: {
    h: 'Sin partidos esta semana',
    sub: 'Pronto subimos los próximos. Mira los pasados:',
    cta: 'Ver últimos partidos',
  },
  mis_predicciones_sin: {
    h: 'Aún sin predicciones',
    sub: 'Empieza con un partido top y compite por S/ 1,250 al mes.',
    cta: 'Ver partidos top',
  },
  comunidad_sin_actividad: {
    h: 'Tipster nuevo',
    sub: 'Aún sin predicciones. ¡Empieza ahora!',
  },
  blog_sin_posts: {
    h: 'Pronto más análisis',
    sub: 'El editor publica 2-3 posts por semana.',
  },
  premium_sin_picks_aprobados: {
    h: 'Picks llegan en horas',
    sub: 'Nuestro editor publica 2-4 picks/día con razonamiento.',
  },
  admin_sin_picks_pendientes: {
    h: '✓ Todo al día',
    sub: 'Sin picks pendientes. Próxima generación: en {tiempo}.',
  },
  admin_filtros_sin_resultados: {
    h: 'Sin resultados',
    sub: 'Prueba ajustando los filtros.',
  },
};
```

### admin.ts — Panel admin

```typescript
export const ADMIN_COPY = {
  layout: {
    mobile_guard_h: 'Panel admin requiere pantalla ≥ 1280px',
    mobile_guard_sub: 'Usa laptop o tablet horizontal.',
    cerrar_sesion: 'Cerrar sesión',
  },
  shortcuts: {
    aprobar: 'Aprobar',
    rechazar: 'Rechazar',
    editar: 'Editar',
    navegar: 'Navegar',
    cerrar: 'Cerrar',
  },
  picks_premium: {
    h: 'Validar Picks Premium',
    sub_template: '{n} picks pendientes · Próxima distribución a las {hora}',
    cola_h: 'Cola',
    sin_pendientes: '✓ Todo al día. Sin picks pendientes.',
    sin_pick_seleccionado: 'Selecciona un pick de la cola izquierda.',
    cta_aprobar: 'Aprobar y enviar al Channel',
    cta_editar: 'Editar',
    cta_rechazar: 'Rechazar',
    rechazar_modal_h: 'Rechazar pick',
    rechazar_label_motivo: 'Motivo (visible solo para el equipo)',
    rechazar_confirmar: 'Confirmar rechazo',
    success_aprobado_template: '✓ Pick enviado a {n} suscriptores',
    error_aprobar: 'No pudimos enviar el pick. Reintenta.',
  },
  // ... más secciones admin
};
```

## Implementación

### Cómo se usan en componentes

```tsx
// Antes (Lote 0-11)
<Button>Crear cuenta gratis</Button>

// Después (Lote H)
import { AUTH_COPY } from '@/lib/copy/auth';
<Button>{AUTH_COPY.signup.cta_email}</Button>
```

### Templating para variables

```typescript
// apps/web/lib/copy/template.ts
export function tpl(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
}

// Uso
import { PREMIUM_COPY } from '@/lib/copy/premium';
import { tpl } from '@/lib/copy/template';

<p>{tpl(PREMIUM_COPY.post_pago.hero_sub_template, { plan: 'Anual', fecha: '30/04/2027' })}</p>
// → "Plan Anual activo hasta el 30/04/2027"
```

## Reglas duras a respetar

- Reglas 1-13 del CLAUDE.md raíz.
- **TODO texto user-facing** debe estar en archivos `copy/`. Sin hardcoding en componentes.
- **Validar contra `glosario.spec.md`** antes de agregar términos nuevos.
- **Validar contra `tono-de-voz.spec.md`** antes de agregar copy nuevo.
- **Templates con `{variable}`** mantener convención uniforme (ni `${var}` ni `%{var}`).
- **Sin tests unitarios** del copy en sí (los textos cambian sin breaking changes), pero sí test de que las claves existen en los componentes que las usan.

## Pasos manuales para Gustavo post-deploy

Ninguno. Es un refactor interno.

**Validación post-deploy:**
1. Recorrer las superficies principales del sitio (home, partidos, comunidad, premium, admin).
2. Verificar que ningún texto se rompe ni falta.
3. Verificar templates con variables (ej: nombre del usuario en home authed).
4. Search global de strings hardcoded que falten centralizar (ej: `grep -r "Crear cuenta" apps/web/components/`).

---

*Versión 1 · Abril 2026 · Catálogo microcopy para Lote H*
