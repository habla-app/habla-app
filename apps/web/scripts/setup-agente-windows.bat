@echo off
REM ====================================================================
REM Setup del agente local de cuotas (Lote V.14 - May 2026)
REM
REM Hace 2 cosas, una sola vez por PC del admin:
REM   1. Copia el perfil "Habla" de tu Chrome a una carpeta aislada
REM      (~/.habla-agente-data) para que el agente no conflicte con tu
REM      Chrome diario.
REM   2. Registra el protocolo URL "habla-agente://" en Windows para que
REM      la admin pueda lanzar el agente con un click desde el browser.
REM
REM Cómo correrlo:
REM   - Doble-click sobre este archivo, o
REM   - Desde PowerShell: cd D:\habla-app\apps\web\scripts; .\setup-agente-windows.bat
REM
REM Pre-requisitos:
REM   - Tener Chrome instalado.
REM   - Haber creado un perfil llamado "Habla" en tu Chrome (Settings ->
REM     Manage profiles -> Add profile).
REM   - Haber hecho login al menos UNA vez en cada casa (doradobet,
REM     apuestatotal, betano, inkabet, teapuesto) en ese perfil "Habla"
REM     para que las cookies queden persistidas.
REM ====================================================================

setlocal enabledelayedexpansion

echo.
echo === Habla! Agente Cuotas - Setup Windows ===
echo.

REM ── Calcular paths ──────────────────────────────────────────────
set "REPO_DIR=%~dp0..\..\.."
pushd "%REPO_DIR%" >nul
set "REPO_DIR=%CD%"
popd >nul
set "AGENTE_DIR=%REPO_DIR%\apps\web"
set "AGENTE_DATA_DIR=%USERPROFILE%\.habla-agente-data"
set "CHROME_USER_DATA=%LOCALAPPDATA%\Google\Chrome\User Data"
set "LOCAL_STATE=%CHROME_USER_DATA%\Local State"

echo Repo: %REPO_DIR%
echo Agente data dir: %AGENTE_DATA_DIR%
echo Chrome user data: %CHROME_USER_DATA%
echo.

REM ── Paso 1: detectar perfil "Habla" en Local State ────────────────
if not exist "%LOCAL_STATE%" (
    echo [ERROR] No se encontró Chrome User Data en %CHROME_USER_DATA%
    echo Verificá que Chrome esté instalado y al menos una vez abierto.
    pause
    exit /b 1
)

echo [1/3] Buscando perfil "Habla"...

REM Usar PowerShell para parsear el JSON Local State (busca por nombre del perfil)
set "PERFIL_HABLA="
for /f "delims=" %%P in ('powershell -NoProfile -Command "$ls = Get-Content '%LOCAL_STATE%' -Raw | ConvertFrom-Json; $ls.profile.info_cache.PSObject.Properties | Where-Object { $_.Value.name -match 'Habla' -or $_.Value.user_name -match 'hablaplay' -or $_.Value.gaia_name -match 'hablaplay' } | Select-Object -First 1 -ExpandProperty Name"') do (
    set "PERFIL_HABLA=%%P"
)

if "!PERFIL_HABLA!"=="" (
    echo [ERROR] No se encontró ningún perfil llamado "Habla" en tu Chrome.
    echo.
    echo Pasos:
    echo   1. Abrí Chrome.
    echo   2. Click en tu avatar arriba a la derecha.
    echo   3. "Add" / "Agregar otro perfil".
    echo   4. Nombre: Habla
    echo   5. Iniciá sesión con tu cuenta hablaplay@gmail.com.
    echo   6. Visitá doradobet.com, apuestatotal.com, betano.pe, inkabet.pe,
    echo      teapuesto.pe. Aceptá cookies + +18 una vez en cada una.
    echo   7. Volvé a correr este script.
    pause
    exit /b 1
)

echo Encontrado: %CHROME_USER_DATA%\!PERFIL_HABLA!
echo.

REM ── Paso 2: copiar perfil a carpeta aislada ───────────────────────
echo [2/3] Copiando perfil a %AGENTE_DATA_DIR%\Default ...

REM Limpiar destino si existe
if exist "%AGENTE_DATA_DIR%" (
    rmdir /S /Q "%AGENTE_DATA_DIR%" 2>nul
)
mkdir "%AGENTE_DATA_DIR%" 2>nul

REM Copiar todo el contenido del perfil Habla al Default del nuevo User Data
robocopy "%CHROME_USER_DATA%\!PERFIL_HABLA!" "%AGENTE_DATA_DIR%\Default" /E /NFL /NDL /NJH /NJS /NC /NS >nul 2>&1
if errorlevel 8 (
    echo [ERROR] robocopy falló al copiar el perfil.
    pause
    exit /b 1
)

REM Crear el archivo Local State mínimo en el agente data dir para que Chrome lo reconozca
powershell -NoProfile -Command "@{profile = @{info_cache = @{Default = @{name = 'Habla'; active_time = 0}}; last_used = 'Default'}} | ConvertTo-Json -Depth 5 | Out-File -FilePath '%AGENTE_DATA_DIR%\Local State' -Encoding utf8" >nul 2>&1

echo Perfil copiado OK.
echo.

REM ── Paso 3: registrar protocolo "habla-agente://" ────────────────
echo [3/3] Registrando protocolo habla-agente:// en Windows...

set "LAUNCHER=%AGENTE_DIR%\scripts\agente-cuotas-launcher.cmd"

REM Crear el launcher .cmd (Windows lo invoca pasándole la URL como %%1)
REM IMPORTANTE: usamos expansion normal (%VAR%) en vez de delayed (!VAR!)
REM porque el launcher se crea aqui sin enabledelayedexpansion en su scope.
> "%LAUNCHER%" (
    echo @echo off
    echo REM Launcher del agente - invocado por el protocolo habla-agente://
    echo REM El argumento %%1 es la URL completa, ej: habla-agente://run?token=xxx
    echo.
    echo REM Extraer el token de la URL ^(despues del primer "="^)
    echo set "URL=%%~1"
    echo set "TOKEN="
    echo for /f "tokens=2 delims==" %%%%T in ^("%%URL%%"^) do set "TOKEN=%%%%T"
    echo.
    echo REM Cambiar al directorio del repo
    echo cd /D "%AGENTE_DIR%"
    echo.
    echo REM Lanzar el agente con el token. Si TOKEN quedo vacio, falla
    echo REM explicito en lugar de caer a modo polling silenciosamente.
    echo if "%%TOKEN%%"=="" ^(
    echo     echo [ERROR] No se pudo extraer el token de la URL: %%URL%%
    echo     echo Re-ejecuta setup-agente-windows.bat para regenerar este launcher.
    echo     pause
    echo     exit /b 1
    echo ^)
    echo.
    echo call pnpm --filter @habla/web run agente-cuotas -- --token=%%TOKEN%%
)

REM Registrar protocolo en HKCU (no requiere admin)
reg add "HKCU\Software\Classes\habla-agente" /ve /d "URL:Habla Agente Protocol" /f >nul
reg add "HKCU\Software\Classes\habla-agente" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\habla-agente\shell" /f >nul
reg add "HKCU\Software\Classes\habla-agente\shell\open" /f >nul
reg add "HKCU\Software\Classes\habla-agente\shell\open\command" /ve /d "\"%LAUNCHER%\" \"%%1\"" /f >nul

echo Protocolo registrado OK.
echo.

REM ── Listo ─────────────────────────────────────────────────────────
echo === SETUP COMPLETO ===
echo.
echo El agente está listo. A partir de ahora:
echo   - Desde la admin (https://hablaplay.com/admin/partidos),
echo     pulsá "Actualizar cuotas" en cualquier partido.
echo   - Windows va a abrir el agente automáticamente.
echo   - El agente procesa los jobs y se cierra solo.
echo   - Tu Chrome diario sigue funcionando sin interferencia.
echo.
echo Para re-ejecutar este setup (si actualizás cookies del perfil
echo Habla en Chrome y querés sincronizar al agente), correlo de nuevo.
echo.
pause
