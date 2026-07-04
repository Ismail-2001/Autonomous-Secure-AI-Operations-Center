# Build Verification Script for A-SOC Dashboard
# Usage: .\scripts\verify-build.ps1

Write-Host "=== A-SOC Dashboard Build Verification ===" -ForegroundColor Cyan

# Step 1: Build Docker image
Write-Host "`n[1/3] Building dashboard Docker image..." -ForegroundColor Yellow
docker build -t a-soc-dashboard-verify . 2>&1 | Select-String -Pattern "naming|ERROR|FAIL"
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED" -ForegroundColor Red; exit 1 }
Write-Host "BUILD OK" -ForegroundColor Green

# Step 2: Run container and check health
Write-Host "`n[2/3] Starting container and checking health..." -ForegroundColor Yellow
$containerId = docker run -d -p 3001:3000 a-soc-dashboard-verify 2>&1
Start-Sleep -Seconds 10

# Check if container is running
$status = docker inspect --format='{{.State.Status}}' $containerId 2>&1
if ($status -ne "running") {
    Write-Host "CONTAINER NOT RUNNING" -ForegroundColor Red
    docker logs $containerId 2>&1
    docker rm -f $containerId 2>&1 | Out-Null
    exit 1
}

# Health check
$health = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 10 -ErrorAction SilentlyContinue
if ($health.StatusCode -eq 200) {
    Write-Host "HEALTH CHECK OK (HTTP 200)" -ForegroundColor Green
} else {
    Write-Host "HEALTH CHECK FAILED (HTTP $($health.StatusCode))" -ForegroundColor Red
    docker rm -f $containerId 2>&1 | Out-Null
    exit 1
}

# Step 3: Cleanup
Write-Host "`n[3/3] Cleaning up..." -ForegroundColor Yellow
docker rm -f $containerId 2>&1 | Out-Null
Write-Host "DONE" -ForegroundColor Green

Write-Host "`n=== Build Verification Complete ===" -ForegroundColor Cyan
