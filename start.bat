@echo off
rem Run the app with a clean Python environment (Windows twin of start.sh).
setlocal
cd /d "%~dp0"

rem Host-level PYTHON* vars can break venv resolution - clear them for this session.
set "PYTHONHOME="
set "PYTHONPATH="
set "PYTHONPLATLIBDIR="
set "PYTHONUSERBASE="
set "PYTHONSTARTUP="

set "PY=python"
where python >nul 2>nul || set "PY=py -3"

if not exist "venv\Scripts\python.exe" (
    %PY% -m venv venv || goto :error
    venv\Scripts\python.exe -m pip install -r requirements.txt || goto :error
)

venv\Scripts\python.exe -c "import flask" 2>nul
if errorlevel 1 (
    venv\Scripts\python.exe -m ensurepip >nul 2>nul
    venv\Scripts\python.exe -m pip install -r requirements.txt || goto :error
)

venv\Scripts\python.exe seed.py
venv\Scripts\python.exe app.py
goto :eof

:error
echo.
echo Failed to set up the environment. Make sure Python 3 is installed
echo and available as "python" (or the "py" launcher).
pause
exit /b 1
