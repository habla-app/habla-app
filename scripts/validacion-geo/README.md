# Validación geo-test + reconocimiento estructural + extracción Stake

Script local que en una sola corrida:
1. Confirma que las 7 casas son accesibles desde la IP del admin.
2. Captura HTML completo + análisis estructural del listado y del detalle
   de cada casa (insumo para escribir extractores específicos por casa).
3. Valida end-to-end que el extractor de Stake (selectores ya conocidos)
   extrae las 4 cuotas correctamente desde la PC con IP peruana.

## Uso

Desde Git Bash, parado en esta carpeta:

```bash
# 1. Verificar que tenés Node 18+
node --version

# 2. Asegurarte de tener la última versión del script
cd /d/habla-app && git pull origin main && cd scripts/validacion-geo

# 3. Instalar dependencias (solo primera vez, ~3 min)
npm install

# 4. Correr el script (~4-6 min, abre 7 ventanas de Chromium una por una +
#    detalle de cada partido encontrado)
node validar-geo-test.mjs
```

El script abre ventanas de Chromium VISIBLES (no headless). NO las cierres
manualmente.

## Salida

Al terminar:
- **`resumen.json`** — consolidado de todos los resultados.
- **`screenshots/{casa}-listado.png`** y **`{casa}-detalle.png`** — capturas
  visuales por etapa.
- **`html/{casa}-listado.html`** y **`{casa}-detalle.html`** — HTML completo
  truncado a 500 KB.
- **`analisis-estructural/{casa}-listado.json`** y **`{casa}-detalle.json`**
  — análisis automático de cada DOM (clases más frecuentes, atributos
  data-* disponibles, prefijos de selectores, candidatos a tarjetas de
  partido). Es el insumo principal para que el asistente escriba los
  extractores específicos de cada casa.

## Mandar al asistente

1. **`resumen.json`** — pegalo entero en el chat.
2. **Carpeta `analisis-estructural/`** — zip-eala desde el Explorador
   de Windows (click derecho sobre la carpeta → Enviar a → Carpeta
   comprimida) y subila al chat como archivo adjunto.

Si la casa de Stake aparece como "VALIDADO end-to-end" en el resumen final,
estamos listos para construir el agente residente.
