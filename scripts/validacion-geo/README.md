# Validación geo-test desde la PC del admin

Script local para confirmar que los 7 sportsbooks peruanos son accesibles
desde la IP residencial peruana del admin (Movistar/Claro/etc.) usando
Playwright headed.

**No corre en Railway, no se cablea al motor productivo.** Es un test
puntual de validación arquitectónica antes de invertir en construir un
agente residente que mueva el scraping desde Railway US a la PC del
admin.

## Uso

Desde Git Bash, parado en esta carpeta:

```bash
# 1. Verificar que tenés Node 18+
node --version

# 2. Instalar dependencias (~3 min, descarga Chromium ~170 MB)
npm install

# 3. Correr el script (~3-4 min, abre 7 ventanas de Chromium una por una)
node validar-geo-test.mjs
```

El script abre ventanas de Chromium VISIBLES (no headless). Vas a ver cada
sportsbook abrirse, navegar al listado de Liga 1 Perú, intentar aceptar
cookies, esperar hidratación, y cerrarse. NO cierres las ventanas a mano.

## Salida

Al terminar:
- Tabla resumen en consola con OK/FAIL por casa.
- `resumen.json` con todo el diagnóstico estructurado.
- `screenshots/{casa}.png` con captura visual de cada casa.

## Mandar al asistente

Mandale:
1. El contenido completo de `resumen.json`.
2. Los screenshots de las casas que aparezcan FAIL (no hace falta los OK).
