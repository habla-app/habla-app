# Probar scrapers local — instrucciones

> Lote V.12.5 — May 2026 — fase 0 (feasibility test)

Este script corre los 6 scrapers de cuotas **desde tu PC** con Chrome real, IP residencial peruana, y perfil persistente. Sirve para validar que las casas que bloquean al headless desde Railway US (Coolbet/Betano/Inkabet) **sí funcionan desde tu máquina**.

NO toca Railway, NO toca Postgres, NO persiste nada. Es 100% un test de feasibility.

## Pre-requisito (una sola vez)

1. Tener Google Chrome instalado.
2. Tener Node.js + pnpm instalados (ya los tenés porque tenés el repo).
3. Asegurarte que las dependencias están instaladas:

```powershell
pnpm install
```

## Cómo correrlo

### Opción A: ruta default de Chrome (Windows)

Si tenés Chrome en `C:\Program Files\Google\Chrome\Application\chrome.exe` (la ruta default), simplemente:

```powershell
pnpm --filter @habla/web run probar-scrapers
```

### Opción B: ruta custom

Si Chrome está en otra ubicación:

```powershell
$env:LOCAL_CHROME_PATH = "C:\Tu\Ruta\A\chrome.exe"
pnpm --filter @habla/web run probar-scrapers
```

## Qué pasa cuando lo corrés

1. Se abre una ventana de Chrome (headful) con un perfil aislado en `~/.habla-playwright-data/`. Este perfil es **separado** de tu Chrome principal — no toca tus cookies, historial ni extensiones reales.

2. El script itera las 6 casas y para cada una:
   - Navega a la URL del listing de Liga 1 Perú
   - Cierra cookie banners / modales (defensivo)
   - Espera 8s + scroll (lazy-load)
   - Captura las XHRs JSON con cuotas
   - Prueba el parser de la casa
   - Imprime resultado en la consola

3. Al final, un resumen:
   ```
   ─── RESUMEN ──
     doradobet      ✓ COMPLETO (14500ms)
     apuesta_total  ⚠ PARCIAL (faltan: doble_op) (45000ms)
     coolbet        ✓ COMPLETO (12000ms)         ← antes 403 desde Railway
     betano         ✓ COMPLETO (15000ms)         ← antes 403 desde Railway
     inkabet        ✓ COMPLETO (11000ms)         ← antes 403 desde Railway
     te_apuesto     ✓ COMPLETO (10000ms)
   
     → completos: 5/6
     → parciales: 1/6
     → fallidos:  0/6
   ```

4. Cierra Chrome y termina.

## Interpretación de resultados

- **`✓ COMPLETO`**: la casa cargó OK + se extrajeron los 4 mercados (1X2, Doble Op, ±2.5, BTTS).
- **`⚠ PARCIAL`**: la casa cargó OK + se extrajeron algunos pero no los 4. El log dice cuál falta.
- **`✗ NO MATCH`**: el partido no se encontró en la respuesta de la casa (puede que no esté en la jornada actual, o el matcher fuzzy rechazó).
- **`✗ ERROR`**: la navegación o el parser tiraron error (ver mensaje).

## Si todas las casas dan COMPLETO o PARCIAL desde tu PC

🎉 Confirmamos que el problema era IP/TLS, no nuestro código.

Próximo paso: lote V.12.6 con el agente local + endpoints en backend. La PC del admin quedará polleando jobs y procesándolos con el browser local. Set & forget.

## Si alguna casa sigue fallando desde tu PC

Veremos los logs específicos para esa casa. Posibles causas:
- Cookies / banner que el script no logró cerrar bien
- Carga muy lenta (necesita más wait)
- La casa cambió la URL del listing
- El partido específico no está hoy en la jornada

Cualquiera de estos es solucionable casa por casa.

## Probar otro partido

Editá la sección `Mock partido` en `apps/web/scripts/probar-scrapers-local.ts`:

```typescript
const partido = {
  id: "test-partido-local",
  equipoLocal: "Universitario",          // ← cambiá acá
  equipoVisita: "Alianza Lima",          // ← y acá
  liga: "Liga 1 Perú",
  fechaInicio: new Date("2026-05-12T20:00:00Z"),
} as any;
```

## Detalles técnicos (curiosos)

- El script reusa el código existente de `lib/services/scrapers/` (browser, xhr-intercept, los 6 scrapers, parsers, fuzzy matching). Cero duplicación.
- Trick de implementación: el script **lanza el browser primero** y settea `globalThis.__pwBrowser`/`__pwContext`. El singleton de `browser.ts`, al verlos seteados, los reusa en lugar de lanzar uno nuevo headless.
- Stealth plugin (`puppeteer-extra-plugin-stealth`) se aplica vía `chromium.use(...)` del lado del script.
- Perfil persistente en `~/.habla-playwright-data/`: las cookies aceptadas en una corrida quedan para la siguiente. Si querés limpiar el perfil (ej. para empezar fresco), borrá esa carpeta.

## Limpieza si querés desinstalar

```powershell
# Borrar perfil de Chrome aislado
Remove-Item -Recurse -Force "$env:USERPROFILE\.habla-playwright-data"
```

El script en sí vive en el repo y no hay nada más que limpiar.
