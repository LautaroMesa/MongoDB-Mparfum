@echo off
REM =====================================================================
REM MPARFUM - Resguardo en Windows (programar con el Programador de tareas)
REM Uso: backup_windows.bat [URI] [CARPETA_DESTINO]
REM Requiere MongoDB Database Tools en el PATH.
REM =====================================================================
setlocal
set URI=%~1
if "%URI%"=="" set URI=mongodb://localhost:27017
set DESTINO=%~2
if "%DESTINO%"=="" set DESTINO=%~dp0resguardos

for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set FECHA=%%i
if not exist "%DESTINO%" mkdir "%DESTINO%"

echo Resguardando mparfum en %DESTINO%\mparfum_%FECHA%.archive.gz
mongodump --uri="%URI%" --db=mparfum --gzip --archive="%DESTINO%\mparfum_%FECHA%.archive.gz"
if errorlevel 1 (
  echo ERROR en el resguardo
  exit /b 1
)

REM Retención: borra resguardos de más de 7 días
forfiles /p "%DESTINO%" /m mparfum_*.archive.gz /d -7 /c "cmd /c del @path" 2>nul
echo Resguardo finalizado.
endlocal
