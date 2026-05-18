#!/usr/bin/env bash
# scripts/run-health-triagem.sh
# Bash script para: iniciar backend (se necessário), testar /healthz, enviar dois POSTs de triagem (novo + legado), e coletar logs/saídas.

PORT=3002
BASE_URL="http://localhost:$PORT"
LOGFILE=server.log
OUTPUT_DIR="scripts/output"
mkdir -p "$OUTPUT_DIR"

wait_for_healthz() {
  local url=$1
  local timeout=${2:-30}
  local start=$(date +%s)
  while true; do
    if curl -sSf "$url/healthz" >/dev/null 2>&1; then
      return 0
    fi
    now=$(date +%s)
    if [ $((now - start)) -ge $timeout ]; then
      return 1
    fi
    sleep 1
  done
}

# 1) Verifica se backend responde
if ! curl -sSf "$BASE_URL/healthz" >/dev/null 2>&1; then
  echo "Servidor não respondeu em $BASE_URL, iniciando 'npm run dev' (nohup -> $LOGFILE)"
  nohup npm run dev > "$LOGFILE" 2>&1 &
  echo $! > scripts/server.pid
  if ! wait_for_healthz "$BASE_URL" 30; then
    echo "Falha: /healthz não respondeu após start. Veja $LOGFILE"
    tail -n 200 "$LOGFILE" > "$OUTPUT_DIR/server.log.tail.txt" 2>/dev/null || true
    exit 1
  fi
fi

# 2) Gravar /healthz (headers + body)
curl -sS -D - "$BASE_URL/healthz" -o "$OUTPUT_DIR/healthz_body.json" > "$OUTPUT_DIR/healthz_headers.txt" 2>&1 || true
# move headers saved in stdout to a file (curl -D - writes headers to stdout, body to file)
# 3) POST triagem - formato novo
cat > "$OUTPUT_DIR/triagem_novo_payload.json" <<'JSON'
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
JSON

curl -sS -X POST "$BASE_URL/api/webhook/triagem" -H "Content-Type: application/json" --data-binary @"$OUTPUT_DIR/triagem_novo_payload.json" -o "$OUTPUT_DIR/triagem_novo.json" -w "HTTP_STATUS:%{http_code}\n" || true

# 4) POST triagem - formato legado (flat)
cat > "$OUTPUT_DIR/triagem_legado_payload.json" <<'JSON'
{
  "nome":"João Souza",
  "telefone":"+5511988887777",
  "cpf":"98765432100",
  "doencas":"has",
  "medicacao_em_uso":"enalapril",
  "tempo_doenca":"400"
}
JSON

curl -sS -X POST "$BASE_URL/api/webhook/triagem" -H "Content-Type: application/json" --data-binary @"$OUTPUT_DIR/triagem_legado_payload.json" -o "$OUTPUT_DIR/triagem_legado.json" -w "HTTP_STATUS:%{http_code}\n" || true

# 5) coletar logs do servidor (últimas 200 linhas)
if [ -f "$LOGFILE" ]; then
  tail -n 200 "$LOGFILE" > "$OUTPUT_DIR/server.log.tail.txt" || true
else
  echo "$LOGFILE não encontrado" > "$OUTPUT_DIR/server.log.tail.txt"
fi

# 6) verificar fallback JSON
if [ -f data/atendimentos.json ]; then
  tail -n 200 data/atendimentos.json > "$OUTPUT_DIR/atendimentos_tail.json" || true
else
  echo "data/atendimentos.json não encontrado" > "$OUTPUT_DIR/atendimentos_tail.json"
fi

echo "Resultados gravados em: $OUTPUT_DIR"
ls -la "$OUTPUT_DIR" || true

echo "Pronto. Cole os arquivos de $OUTPUT_DIR aqui para análise."
