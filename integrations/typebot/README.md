Integração Typebot → Doctor Prescreve

Payload esperado (novo):

POST /api/webhook/triagem
Content-Type: application/json

{
  "paciente": {
    "nome": "Nome Completo",
    "telefone": "+5511999999999",
    "cpf": "00000000000",
    "email": "paciente@example.com",
    "data_nascimento": "1980-01-01"
  },
  "triagem": {
    "doencas": "Hipertensão",
    "medicacao_em_uso": "Losartana 50mg",
    "posologia_atual": "1 comprimido ao dia",
    "tempo_doenca": "365",
    "receita_vencida_dias": null,
    "ultima_consulta": null,
    "comorbidades": null,
    "alergias": null
  }
}

Resposta esperada (201):
{
  "success": true,
  "id": "<uuid>",
  "elegivel": true|false,
  "atendimentoId": "<uuid>",
  "mensagem": "...",
  "persisted": { "supabase": boolean, "json": boolean }
}

Observações / Boas práticas:
- Envie `Content-Type: application/json`.
- O backend aceita também o formato legado (campos planos), mas preferimos o novo com `paciente` e `triagem`.
- Campos sensíveis são criptografados antes da persistência (depende de `ENCRYPTION_KEY`).
- Se Supabase não estiver configurado, o fallback JSON em `data/atendimentos.json` será usado.
- Para depuração, chame `/healthz` e verifique `database.supabase_connected` e `database.json_fallback_available`.

Exemplo curl:

curl -X POST "${BASE_URL:-http://localhost:3002}/api/webhook/triagem" \
  -H "Content-Type: application/json" \
  -d @typebot-example.json

Arquivo `typebot-example.json` pode ser criado localmente com o payload acima.

**Campos Obrigatórios**:
- `paciente.nome`: string (mínimo 3 caracteres)
- `paciente.telefone`: string (10-13 dígitos, incluir DDI +55 opcional)
- `triagem.doencas`: string ou array (descrição das condições)
- `triagem.medicacao_em_uso`: string (medicação atual)
- `triagem.tempo_doenca`: número em dias (deve ser >= 30)

**Campos Opcionais**:
- `paciente.cpf`: string (apenas números, será validado se enviado)
- `paciente.email`: string
- `paciente.data_nascimento`: string `YYYY-MM-DD`
- `triagem.posologia_atual`, `triagem.receita_vencida_dias`, `triagem.ultima_consulta`, `triagem.comorbidades`, `triagem.alergias`

**Exemplo de integração Typebot (ação HTTP)**:

1. Em Typebot adicione uma ação `Request` ou `HTTP` apontando para:
   - URL: `{{BASE_URL}}/api/webhook/triagem`
   - Method: `POST`
   - Headers: `Content-Type: application/json`
   - Body: cole o JSON do `typebot-example.json`, substituindo os campos pelos valores coletados pelo fluxo do bot (ex.: `{{nome}}`, `{{telefone}}`, `{{medicacao}}`).

2. Verifique a resposta (201) e capture `atendimentoId` para próximos passos (pagamento/seguimento).

Observação: o backend aceita também o formato legado, mas recomendamos migrar o Typebot para o payload novo com `paciente` + `triagem`.
