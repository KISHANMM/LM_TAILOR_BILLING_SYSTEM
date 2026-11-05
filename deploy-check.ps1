# ======================================================
# LM Tailor Billing System - Local Pre-Deployment Check
# ======================================================

Write-Host "Running pre-deployment checks..." -ForegroundColor Cyan

# Execute node pre-deploy script
node scripts/pre-deploy.js

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Pre-deployment checks failed! Do not push or deploy." -ForegroundColor Red
    exit $LASTEXITCODE
} else {
    Write-Host "`n[SUCCESS] Ready for deployment!" -ForegroundColor Green
    exit 0
}
