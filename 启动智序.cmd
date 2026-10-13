@echo off
setlocal
set "WXMP_PROJECT_EXE=%~dp0src-tauri\target\release\wechat-mp-desktop.exe"
if not exist "%WXMP_PROJECT_EXE%" (
  echo Desktop executable is missing. Build it from this project first.
  echo Command: pnpm tauri build --bundles nsis
  pause
  exit /b 1
)
start "" /D "%~dp0src-tauri\target\release" "%WXMP_PROJECT_EXE%"
endlocal
