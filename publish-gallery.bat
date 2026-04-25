@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"

set "DRY_RUN=0"
set "NO_PAUSE=0"

:parse_args
if "%~1"=="" goto args_done
if /i "%~1"=="--dry-run" set "DRY_RUN=1"
if /i "%~1"=="--no-pause" set "NO_PAUSE=1"
shift
goto parse_args

:args_done
where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Git was not found. Please install Git for Windows first.
  goto fail
)

if not exist ".git" (
  echo [ERROR] This folder is not a Git repository: %cd%
  goto fail
)

set "REPO_SAFE=%cd:\=/%"
git config --global --get-all safe.directory | findstr /i /x /c:"%REPO_SAFE%" >nul
if errorlevel 1 (
  git config --global --add safe.directory "%REPO_SAFE%" >nul 2>nul
)

set "LATEST_EXPORT="
set "DELETE_AFTER_COPY=0"
for /f "delims=" %%F in ('dir /b /a:-d /o-d "gallery\gpt-image-2-gallery-data-*.js" 2^>nul') do (
  if not defined LATEST_EXPORT (
    set "LATEST_EXPORT=gallery\%%F"
    set "DELETE_AFTER_COPY=1"
  )
)

if not defined LATEST_EXPORT (
  for /f "delims=" %%F in ('dir /b /a:-d /o-d "%USERPROFILE%\Downloads\gpt-image-2-gallery-data-*.js" 2^>nul') do (
    if not defined LATEST_EXPORT set "LATEST_EXPORT=%USERPROFILE%\Downloads\%%F"
  )
)

if defined LATEST_EXPORT (
  echo [INFO] Found exported data file: !LATEST_EXPORT!
  copy /y "!LATEST_EXPORT!" "gallery\data.js" >nul
  if errorlevel 1 (
    echo [ERROR] Failed to overwrite gallery\data.js
    goto fail
  )
  if "!DELETE_AFTER_COPY!"=="1" del /q "!LATEST_EXPORT!" >nul 2>nul
  echo [INFO] gallery\data.js has been updated.
)

if not exist "gallery\data.js" (
  echo [ERROR] gallery\data.js is missing. Export data.js from the site first.
  goto fail
)

git add -- index.html gallery/index.html gallery/data.js gallery/app.js gallery/styles.css tools/image-generator.html README.md wrangler.jsonc .gitignore publish-gallery.bat

set "HAS_CHANGES=0"
for /f "delims=" %%S in ('git status --porcelain -- index.html gallery/index.html gallery/data.js gallery/app.js gallery/styles.css tools/image-generator.html README.md wrangler.jsonc .gitignore publish-gallery.bat') do (
  set "HAS_CHANGES=1"
)

if "%HAS_CHANGES%"=="0" (
  echo [INFO] No tracked publish changes were found.
  goto success
)

if "%DRY_RUN%"=="1" (
  echo [DRY RUN] The helper would commit these files:
  git status --short -- index.html gallery/index.html gallery/data.js gallery/app.js gallery/styles.css tools/image-generator.html README.md wrangler.jsonc .gitignore publish-gallery.bat
  goto success
)

set "COMMIT_FILE=%TEMP%\gpt-image-2-publish-commit.txt"
(
  echo Publish the latest gallery content and announcement updates
  echo.
  echo Sync the static gallery bundle and entry redirects so the
  echo deployed site reflects the latest locally reviewed changes.
  echo.
  echo Constraint: Deployment remains a static GitHub-backed site
  echo Confidence: high
  echo Scope-risk: narrow
  echo Reversibility: clean
  echo Directive: Export or copy the latest gallery data before running this helper
  echo Tested: Local publish helper stages tracked site files and pushes origin/main
  echo Not-tested: Remote auth failure or upstream divergence handling
) > "%COMMIT_FILE%"

git commit -F "%COMMIT_FILE%"
if errorlevel 1 (
  echo [ERROR] git commit failed.
  del /q "%COMMIT_FILE%" >nul 2>nul
  goto fail
)

del /q "%COMMIT_FILE%" >nul 2>nul

git push origin main
if errorlevel 1 (
  echo [ERROR] git push failed. Check auth, network, or remote conflicts.
  goto fail
)

echo [OK] Changes were committed and pushed to GitHub.
goto success

:fail
if "%NO_PAUSE%"=="1" exit /b 1
pause
exit /b 1

:success
if "%NO_PAUSE%"=="1" exit /b 0
pause
exit /b 0
