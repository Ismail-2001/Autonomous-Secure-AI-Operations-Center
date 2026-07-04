# A-SOC Smoke Test — runs against live services, no browser needed
# Usage: .\scripts\smoke-test.ps1

$BASE = "http://localhost"
$DASHBOARD = "$BASE:3000"
$BACKEND = "$BASE:9002"
$passed = 0
$failed = 0

function Test-Check {
    param([string]$Name, [scriptblock]$Check)
    try {
        $result = & $Check
        if ($result) {
            Write-Host "  PASS  $Name" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "  FAIL  $Name" -ForegroundColor Red
            $script:failed++
        }
    } catch {
        Write-Host "  FAIL  $Name ($($_.Exception.Message))" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "`n=== A-SOC Smoke Tests ===" -ForegroundColor Cyan

# --- Backend Tests ---
Write-Host "`n[Backend]" -ForegroundColor Yellow

Test-Check "Health endpoint returns 200" {
    $r = Invoke-WebRequest "$BACKEND/health" -TimeoutSec 5 -ErrorAction Stop
    $r.StatusCode -eq 200
}

Test-Check "Auth token endpoint works" {
    $body = '{"user_id":"admin","password":"admin123"}'
    $r = Invoke-RestMethod "$BACKEND/api/v1/auth/token" -Method POST -ContentType "application/json" -Body $body -ErrorAction Stop
    $null -ne $r.access_token
}

# Get a real token for authenticated tests
$tokenResp = Invoke-RestMethod "$BACKEND/api/v1/auth/token" -Method POST -ContentType "application/json" -Body '{"user_id":"admin","password":"admin123"}'
$token = $tokenResp.access_token
$headers = @{ Authorization = "Bearer $token" }

Test-Check "Dashboard stats returns data" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/dashboard/stats" -Headers $headers -ErrorAction Stop
    $r.ContainsKey("active_threats") -or $r.ContainsKey("total_assets")
}

Test-Check "Incidents endpoint returns rows" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/incidents" -Headers $headers -ErrorAction Stop
    $r.count -ge 1
}

Test-Check "Assets endpoint returns rows" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/assets" -Headers $headers -ErrorAction Stop
    $r.count -ge 1
}

Test-Check "Forensics endpoint returns rows" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/forensics/jobs" -Headers $headers -ErrorAction Stop
    $r.count -ge 1
}

Test-Check "Threat intel endpoint returns rows" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/threat-intel/indicators" -Headers $headers -ErrorAction Stop
    $r.count -ge 1
}

Test-Check "Compliance endpoint returns score" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/compliance/report" -Headers $headers -ErrorAction Stop
    $null -ne $r.score
}

Test-Check "Agents status endpoint returns agents" {
    $r = Invoke-RestMethod "$BACKEND/api/v1/agents/status" -Headers $headers -ErrorAction Stop
    ($r.agents.Count -ge 1) -or ($r.Count -ge 1)
}

# --- Dashboard Tests ---
Write-Host "`n[Dashboard]" -ForegroundColor Yellow

$pages = @(
    @{ Name = "Monitoring (/)";       Path = "/" },
    @{ Name = "Hunting (/hunting)";    Path = "/hunting" },
    @{ Name = "Assets (/assets)";      Path = "/assets" },
    @{ Name = "Forensics (/forensics)"; Path = "/forensics" },
    @{ Name = "Threat Intel (/threat-intel)"; Path = "/threat-intel" },
    @{ Name = "Governance (/governance)"; Path = "/governance" }
)

foreach ($page in $pages) {
    Test-Check "$($page.Name) loads (HTTP 200)" {
        $r = Invoke-WebRequest "$DASHBOARD$($page.Path)" -TimeoutSec 10 -ErrorAction Stop
        $r.StatusCode -eq 200
    }

    Test-Check "$($page.Name) contains HTML content" {
        $r = Invoke-WebRequest "$DASHBOARD$($page.Path)" -TimeoutSec 10 -ErrorAction Stop
        $r.Content.Length -gt 500
    }
}

Test-Check "Dashboard serves Next.js chunks" {
    $r = Invoke-WebRequest "$DASHBOARD/" -TimeoutSec 10 -ErrorAction Stop
    $r.Content -match "_next" -or $r.Content -match "next"
}

Test-Check "Dashboard returns no server errors in HTML" {
    $r = Invoke-WebRequest "$DASHBOARD/" -TimeoutSec 10 -ErrorAction Stop
    -not ($r.Content -match "500 Internal Server Error")
}

# --- Summary ---
Write-Host "`n=== Results ===" -ForegroundColor Cyan
Write-Host "  Passed: $passed" -ForegroundColor Green
Write-Host "  Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host "  Total:  $($passed + $failed)" -ForegroundColor White

if ($failed -gt 0) {
    Write-Host "`nSOME TESTS FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host "`nALL TESTS PASSED" -ForegroundColor Green
    exit 0
}
