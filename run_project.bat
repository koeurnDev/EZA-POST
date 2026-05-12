@echo off
echo Starting EZA-POST Backend...
start cmd /k "cd backend && npm run dev"

echo Starting EZA-POST Frontend...
start cmd /k "cd frontend\frontend && npm run dev"

echo Servers are starting in separate windows.
pause
