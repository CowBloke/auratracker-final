@echo off
echo Building backend...
cd backend
call npm run build 2>&1 > ..\backend-build.log
echo Backend build completed
cd ..

echo Building frontend...
cd frontend
call npm run build 2>&1 > ..\frontend-build.log
echo Frontend build completed
cd ..

echo Done!
