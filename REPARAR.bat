@echo off
setlocal
title Casa Mama Emma - Reparar
cd /d "%~dp0"

rem ============================================================
rem  BOTON DE REPARACION (un solo clic)
rem  Usa esto SOLO si la app no abre, se ve en blanco, o da errores
rem  raros. NO borra tus datos (facturas, gastos, reservas se
rem  conservan). Solo limpia lo temporal y reinstala lo dañado.
rem ============================================================

echo.
echo   ============================================
echo      CASA MAMA EMMA - Reparacion automatica
echo   ============================================
echo.
echo   Esto NO borra tus datos. Solo limpia lo temporal.
echo.
pause

echo   [1/4] Cerrando servidores...
taskkill /F /IM node.exe >nul 2>nul

echo   [2/4] Borrando cache temporal (.next)...
if exist ".next" rmdir /S /Q ".next" >nul 2>nul

echo   [3/4] Reinstalando componentes dañados...
if exist "node_modules" rmdir /S /Q "node_modules" >nul 2>nul
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo   [!] Fallo la reinstalacion. Revisa tu internet e intenta de nuevo.
  pause
  exit /b 1
)

echo   [4/4] Verificando base de datos...
call npx prisma generate >nul 2>nul
call npx prisma db push --skip-generate --accept-data-loss >nul 2>nul

echo.
echo   ------------------------------------------------
echo     Reparacion lista. Ahora abre EJECUTAR.bat
echo   ------------------------------------------------
echo.
pause
