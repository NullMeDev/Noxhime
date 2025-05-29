@echo off
echo Running Noxhime in Docker container...

REM Build and start the containers
docker-compose -f docker-compose.local.yml up --build

REM If you want to run in detached mode, uncomment the line below:
REM docker-compose -f docker-compose.local.yml up --build -d

echo Docker container started. Access Noxhime web dashboard at http://localhost:3000
