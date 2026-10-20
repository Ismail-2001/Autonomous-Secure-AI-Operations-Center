# A-SOC E2E Test Runner
# Starts services and runs Playwright tests
# Usage: .\scripts\run-e2e-tests.ps1

Write-Host "=== A-SOC E2E Test Runner ===" -ForegroundColor Cyan

# Step 1: Ensure backend is running
Write-Host "`n[1/4] Checking backend..." -ForegroundColor Yellow
$backendHealth = Invoke-RestMethod -Uri "http://localhost:9002/health" -ErrorAction SilentlyContinue
if ($backendHealth.status -eq "healthy" -or $backendHealth.status -eq "degraded") {
    Write-Host "Backend OK ($($backendHealth.status))" -ForegroundColor Green
} else {
    Write-Host "Starting backend..." -ForegroundColor Yellow
    docker compose up -d backend
    Start-Sleep -Seconds 20
}

# Step 2: Ensure dashboard is running
Write-Host "`n[2/4] Checking dashboard..." -ForegroundColor Yellow
$dashHealth = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 5 -ErrorAction SilentlyContinue
if ($dashHealth.StatusCode -eq 200) {
    Write-Host "Dashboard OK" -ForegroundColor Green
} else {
    Write-Host "Starting dashboard..." -ForegroundColor Yellow
    docker compose up -d dashboard
    Start-Sleep -Seconds 15
}

# Step 3: Run tests in Docker
Write-Host "`n[3/4] Running Playwright tests..." -ForegroundColor Yellow
docker build -t a-soc-tests -f dashboard/Dockerfile.test dashboard/ 2>&1 | Select-String -Pattern "naming|ERROR|FAIL"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Test build FAILED" -ForegroundColor Red
    exit 1
}

# Run tests with backend accessible from host network
docker run --rm --network host -e TEST_BASE_URL=http://localhost:3000 a-soc-tests 2>&1
$testResult = $LASTEXITCODE

# Step 4: Report results
Write-Host "`n[4/4] Results" -ForegroundColor Yellow
if ($testResult -eq 0) {
    Write-Host "ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "SOME TESTS FAILED (exit code: $testResult)" -ForegroundColor Red
}

Write-Host "`n=== E2E Test Run Complete ===" -ForegroundColor Cyan
exit $testResult
