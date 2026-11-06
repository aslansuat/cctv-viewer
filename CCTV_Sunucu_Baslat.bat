@echo off
title CCTV Adli Inceleme (Yerel Sunucu)
cd /d "%~dp0"
echo ========================================================
echo   CCTV Adli Inceleme Yerel Sunucu Baslatiliyor...
echo   Tarayici otomatik acilacaktir (localhost:4173).
echo   Bu pencereyi acik birakiniz (simge durumuna kucultebilirsiniz).
echo ========================================================
timeout /t 1 /nobreak >nul
start "" http://localhost:4173
call npm run preview -- --port 4173
pause

