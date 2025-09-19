Write-Host "🚀 Smoke Test für Agent Framework startet..." -ForegroundColor Cyan

# === Backend Health Check ===
Write-Host "`n[1/4] Teste Backend Health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri http://localhost:4000/health -Method GET
    Write-Host "✅ Backend Health OK:" ($health | ConvertTo-Json -Depth 3) -ForegroundColor Green
}
catch {
    Write-Host "❌ Backend Health fehlgeschlagen: $_" -ForegroundColor Red
}

# === Chroma Heartbeat ===
Write-Host "`n[2/4] Teste Chroma Heartbeat..." -ForegroundColor Yellow
try {
    $chroma = Invoke-RestMethod -Uri http://localhost:8001/api/v2/heartbeat -Method GET
    Write-Host "✅ Chroma Heartbeat OK:" ($chroma | ConvertTo-Json -Depth 3) -ForegroundColor Green
}
catch {
    Write-Host "❌ Chroma Heartbeat fehlgeschlagen: $_" -ForegroundColor Red
}

# === RAG Query ===
Write-Host "`n[3/4] Teste RAG Query (Beispiel RMSL EU)..." -ForegroundColor Yellow
try {
    $body = '{ "query": "RMSL EU" }'
    $rag = Invoke-RestMethod -Uri http://localhost:4000/api/rag/search `
                             -Method POST `
                             -ContentType 'application/json' `
                             -Body $body
    Write-Host "✅ RAG Query OK:" ($rag | ConvertTo-Json -Depth 3) -ForegroundColor Green
}
catch {
    Write-Host "❌ RAG Query fehlgeschlagen: $_" -ForegroundColor Red
}

# === Chat Query ===
Write-Host "`n[4/4] Teste Chat Endpoint..." -ForegroundColor Yellow
try {
    $chatBody = '{ "message": "Plane Linie PCK-01 morgen für FG-123, 4000 Stk" }'
    $chat = Invoke-RestMethod -Uri http://localhost:4000/api/chat `
                              -Method POST `
                              -Headers @{ "x-api-key" = "user-123" } `
                              -ContentType 'application/json' `
                              -Body $chatBody
    Write-Host "✅ Chat Endpoint OK:" ($chat | ConvertTo-Json -Depth 3) -ForegroundColor Green
}
catch {
    Write-Host "❌ Chat Endpoint fehlgeschlagen: $_" -ForegroundColor Red
}

Write-Host "`n🏁 Smoke Test abgeschlossen." -ForegroundColor Cyan
