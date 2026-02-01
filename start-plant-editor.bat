@echo off
echo Starting Plant Editor...
cd /d C:\Users\User\clawd\projects\plant-editor
set PORT=3001
start /b node server/index.js
timeout /t 3 /nobreak >nul
echo Starting Cloudflare Tunnel...
cloudflared tunnel --url http://localhost:3001
