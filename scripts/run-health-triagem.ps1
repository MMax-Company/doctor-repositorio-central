# scripts/run-health-triagem.ps1
# PowerShell script para: iniciar backend (se necessário), testar /healthz, enviar dois POSTs de triagem (novo + legado), e coletar logs/saídas.

$port = 3002
$baseUrl = "http://localhost:$port"
$logFile = "server.log"
$outputDir = "scripts\output"
if (-not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }

function Wait-For-Healthz {
  param($url, $timeoutSec = 30)
  $deadline = (Get-Date).AddSeconds($timeoutSec)
  while ((Get-Date) -lt $deadline) {
    try {
      $r = Invoke-WebRequest -Uri "$url/healthz" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
      return @{ ok = $true; status = $r.StatusCode; body = $r.Content }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
  return @{ ok = $false }
}

# 1) Verifica se backend já responde
$health = Wait-For-Healthz -url $baseUrl -timeoutSec 2
$serverStarted = $false
if (-not $health.ok) {
  Write-Host "Servidor não respondeu em $baseUrl, iniciando 'npm run dev' (background -> $logFile)"
  Start-Process -FilePath npm -ArgumentList 'run','dev' -RedirectStandardOutput $logFile -RedirectStandardError $logFile -NoNewWindow -PassThru | Out-Null
  $serverStarted = $true
  # aguardar até 30s por healthz
  $health = Wait-For-Healthz -url $baseUrl -timeoutSec 30
}

if (-not $health.ok) {
  Write-Host "Falha: /healthz não respondeu após tentativa de start. Veja $logFile"
  if (Test-Path $logFile) { Get-Content $logFile -Tail 200 | Out-File -FilePath (Join-Path $outputDir 'server.log.tail.txt') -Encoding utf8 }
  Exit 1
}

# 2) Gravar /healthz (headers + body) usando curl se disponível, senão com Invoke-WebRequest
$healthRawFile = Join-Path $outputDir 'healthz_raw.txt'
try {
  # tenta usar curl para incluir headers
  $curlPath = (Get-Command curl -ErrorAction SilentlyContinue).Source
  if ($curlPath) {
    & curl -sS -D - "$baseUrl/healthz" > $healthRawFile
  } else {
    $r = Invoke-WebRequest -Uri "$baseUrl/healthz" -UseBasicParsing -TimeoutSec 10
    $hdrs = "HTTP/1.1 $($r.StatusCode) `n" + ($r.Headers.GetEnumerator() | ForEach-Object { "{0}: {1}`n" -f $_.Name, $_.Value })
    $hdrs + $r.Content | Out-File -FilePath $healthRawFile -Encoding utf8
  }
} catch {
  "Error fetching /healthz: $_" | Out-File -FilePath $healthRawFile -Encoding utf8
}

# 3) POST triagem - formato novo
$newPayload = @'
{
  "paciente": {
    "nome":"Maria Silva",
    "telefone":"+5511999998888",
    "cpf":"12345678909",
    "email":"maria@example.com",
    "data_nascimento":"1980-01-01"
  },
  "triagem": {
    "doencas":"Hipertensão",
    "medicacao_em_uso":"losartana 50mg",
    "tempo_doenca":"365"
  }
}
'@

$newOutFile = Join-Path $outputDir 'triagem_novo.json'
try {
  $resp = Invoke-RestMethod -Uri "$baseUrl/api/webhook/triagem" -Method Post -Body $newPayload -ContentType 'application/json' -TimeoutSec 20
  $resp | ConvertTo-Json -Depth 6 | Out-File -FilePath $newOutFile -Encoding utf8
} catch {
  if ($_.Exception.Response) {
    try { $_.Exception.Response.GetResponseStream() | ForEach-Object { $_ } } catch {}
  }
  "ERROR: $_" | Out-File -FilePath $newOutFile -Append -Encoding utf8
}

# 4) POST triagem - formato legado (flat)
$legacyPayload = @'
{
  "nome":"João Souza",
  "telefone":"+5511988887777",
  "cpf":"98765432100",
  "doencas":"has",
  "medicacao_em_uso":"enalapril",
  "tempo_doenca":"400"
}
'@

$legacyOutFile = Join-Path $outputDir 'triagem_legado.json'
try {
  $resp2 = Invoke-RestMethod -Uri "$baseUrl/api/webhook/triagem" -Method Post -Body $legacyPayload -ContentType 'application/json' -TimeoutSec 20
  $resp2 | ConvertTo-Json -Depth 6 | Out-File -FilePath $legacyOutFile -Encoding utf8
} catch {
  if ($_.Exception.Response) {
    try { $_.Exception.Response.GetResponseStream() | ForEach-Object { $_ } } catch {}
  }
  "ERROR: $_" | Out-File -FilePath $legacyOutFile -Append -Encoding utf8
}

# 5) coletar logs do servidor (últimas 200 linhas)
$logTailFile = Join-Path $outputDir 'server.log.tail.txt'
if (Test-Path $logFile) {
  Get-Content $logFile -Tail 200 | Out-File -FilePath $logTailFile -Encoding utf8
} else {
  "server.log não encontrado" | Out-File -FilePath $logTailFile -Encoding utf8
}

# 6) verificar fallback JSON (data/atendimentos.json)
$atendimentosFile = Join-Path (Resolve-Path "data").Path 'atendimentos.json'
$attOutFile = Join-Path $outputDir 'atendimentos_tail.json'
if (Test-Path $atendimentosFile) {
  Get-Content $atendimentosFile -Tail 200 | Out-File -FilePath $attOutFile -Encoding utf8
} else {
  "data/atendimentos.json não encontrado" | Out-File -FilePath $attOutFile -Encoding utf8
}

Write-Host "Resultados gravados em: $outputDir"
Write-Host "Files:"
Get-ChildItem $outputDir | ForEach-Object { Write-Host " - $($_.FullName)" }

Write-Host "Pronto. Cole os arquivos em $outputDir aqui para análise." 

# Não matar processo do servidor; deixe rodando
