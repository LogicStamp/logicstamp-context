# Generate context for the simple-app example

Write-Host "Generating context for simple-app..." -ForegroundColor Green
node ../../dist/cli/index.js . --out context.json

Write-Host ""
Write-Host "Context generated! Check context.json" -ForegroundColor Green
Write-Host ""
Write-Host "To validate:" -ForegroundColor Yellow
Write-Host "node ../../dist/cli/validate-index.js context.json"
