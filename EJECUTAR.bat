@echo off
setlocal enabledelayedexpansion
title Casa Mama Emma - Arranque
cd /d "%~dp0"

rem ============================================================
rem  ARRANQUE A PRUEBA DE FALLOS (pensado para uso NO tecnico)
rem  Doble clic y listo. Cada arranque:
rem   1) Cierra servidores viejos que quedaron colgados
rem   2) Limpia el cache temporal (evita el error de pantalla en blanco)
rem   3) Instala/prepara lo necesario solo si falta
rem   4) Enciende la app y abre el navegador solo
rem ============================================================

echo.
echo   ============================================
echo      CASA MAMA EMMA - Encendiendo el sistema
echo   ============================================
echo.

rem --- 1. Node.js instalado? ---
where node >nul 2>nul
if errorlevel 1 (
  echo   [!] Node.js no esta instalado.
  echo       Se abrira la pagina de descarga: instala la version "LTS",
  echo       reinicia la computadora y vuelve a dar doble clic aqui.
  start https://nodejs.org/es
  echo.
  pause
  exit /b 1
)

rem --- 2. Cerrar servidores viejos colgados (evita conflictos de puerto) ---
echo   [1/5] Cerrando servidores anteriores...
taskkill /F /IM node.exe >nul 2>nul

rem --- 3. Configuracion inicial (.env) si no existe ---
if not exist ".env" (
  echo   [*] Creando configuracion inicial (.env)...
  copy ".env.example" ".env" >nul
)

rem --- 4. Limpiar cache temporal (LA CAUSA del error de pantalla en blanco) ---
echo   [2/5] Limpiando cache temporal...
if exist ".next" rmdir /S /Q ".next" >nul 2>nul

rem --- 5. Instalar dependencias solo si faltan ---
if not exist "node_modules" (
  echo   [3/5] Instalando componentes (solo la primera vez, tarda un poco)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   [!] Fallo la instalacion. Revisa tu conexion a internet
    echo       y vuelve a dar doble clic aqui.
    pause
    exit /b 1
  )
) else (
  echo   [3/5] Componentes ya instalados. OK.
)

rem --- 6. Base de datos: crear/actualizar (idempotente, sin borrar datos) ---
echo   [4/5] Preparando base de datos...
call npx prisma generate >nul 2>nul
call npx prisma db push --skip-generate --accept-data-loss >nul 2>nul
call npx tsx prisma/seed.ts >nul 2>nul

rem --- 7. Encender ---
echo   [5/5] Encendiendo... el navegador se abrira solo en unos segundos.
echo.
echo   ------------------------------------------------
echo     App lista en:  http://localhost:3000
echo     Para APAGAR:   cierra esta ventana negra
echo   ------------------------------------------------
echo.
start "" cmd /c "timeout /t 15 >nul & start http://localhost:3000"
call npm run dev

rem Si npm run dev termina (error o cierre), no cerrar de golpe.
echo.
echo   El servidor se detuvo. Si fue por error, vuelve a dar doble clic
echo   en EJECUTAR.bat. Si el problema sigue, usa REPARAR.bat.
pause
