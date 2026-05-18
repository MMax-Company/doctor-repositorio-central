const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const fetch = global.fetch || require('node-fetch')

const BASE = 'http://localhost:3002'
const outputDir = path.join(__dirname, 'output')
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

function parseEnv(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const s = fs.readFileSync(envPath, 'utf8')
  return s.split(/\r?\n/).filter(Boolean).reduce((acc, line) => {
    const m = line.match(/^([^#=]+)=([\s\S]*)$/)
    if (m) acc[m[1].trim()] = m[2].trim()
    return acc
  }, {})
}

async function main() {
  const env = parseEnv(path.join(__dirname, '..', '.env'))
  const STRIPE_SECRET = env.STRIPE_WEBHOOK_SECRET
  const MEDICO_PASS = env.MEDICO_PASS || 'admin123'

  // pick atendimento id from atendimentos_tail.json (latest AGUARDANDO_PAGAMENTO)
  const atendPath = path.join(__dirname, 'output', 'atendimentos_tail.json')
  let atendimentoId = process.argv[2]
  if (!atendimentoId && fs.existsSync(atendPath)) {
    try {
      let txt = fs.readFileSync(atendPath, 'utf8')
      const first = txt.indexOf('[')
      const last = txt.lastIndexOf(']')
      if (first !== -1 && last !== -1) txt = txt.substring(first, last + 1)
      const arr = JSON.parse(txt)
      const found = arr.find(a => a.status === 'AGUARDANDO_PAGAMENTO') || arr[arr.length-1]
      atendimentoId = found && found.id
    } catch (e) {
      console.error('Erro lendo atendimentos_tail.json', e.message)
    }
  }
  if (!atendimentoId) {
    console.error('Nenhum atendimentoId encontrado. Passe como argumento.')
    process.exit(1)
  }
  console.log('Usando atendimentoId=', atendimentoId)

  const results = { atendimentoId }

  // 1) Simular webhook Stripe
  try {
    const event = JSON.stringify({ type: 'checkout.session.completed', data: { object: { metadata: { atendimentoId } } } })
    const t = Math.floor(Date.now()/1000)
    const signedPayload = `${t}.${event}`
    const sig = crypto.createHmac('sha256', STRIPE_SECRET || '').update(signedPayload).digest('hex')
    const header = `t=${t},v1=${sig}`

    const r = await fetch(`${BASE}/webhook/stripe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': header },
      body: event,
    })
    results.stripe = { status: r.status, body: await r.text() }
    console.log('Stripe webhook ->', results.stripe.status)
  } catch (e) {
    results.stripe = { error: e.message }
    console.error('Erro simulando Stripe:', e.message)
  }

  // 2) Login médico
  let token = null
  try {
    const rl = await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha: MEDICO_PASS }) })
    const jd = await rl.json()
    results.login = { status: rl.status, body: jd }
    token = jd.token
    console.log('Login ->', rl.status)
  } catch (e) {
    results.login = { error: e.message }
    console.error('Erro login:', e.message)
  }

  const auth = token ? { Authorization: `Bearer ${token}` } : {}

  // 3) iniciar atendimento
  try {
    const r = await fetch(`${BASE}/api/atendimento/${atendimentoId}/iniciar`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth } })
    results.iniciar = { status: r.status, body: await r.json() }
    console.log('Iniciar ->', r.status)
  } catch (e) { results.iniciar = { error: e.message } }

  // 4) pronto-decisao
  try {
    const r = await fetch(`${BASE}/api/atendimento/${atendimentoId}/pronto-decisao`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth } })
    results.pronto = { status: r.status, body: await r.json() }
    console.log('Pronto-decisao ->', r.status)
  } catch (e) { results.pronto = { error: e.message } }

  // 5) decidir (aprovar)
  try {
    const body = { decisao: 'APROVAR', medicamento_prescrito: 'Losartana 50mg', posologia: '1 comprimido ao dia' }
    const r = await fetch(`${BASE}/api/decisao/${atendimentoId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...auth }, body: JSON.stringify(body) })
    results.decisao = { status: r.status, body: await r.json() }
    console.log('Decisao ->', r.status)
  } catch (e) { results.decisao = { error: e.message } }

  // 6) emitir receita
  try {
    const r = await fetch(`${BASE}/api/receita/${atendimentoId}/emitir`, { method: 'POST', headers: { ...auth } })
    if (r.headers.get('content-type') && r.headers.get('content-type').includes('application/json')) {
      results.emitir = { status: r.status, body: await r.json() }
    } else {
      results.emitir = { status: r.status, body: 'PDF binary or redirect' }
    }
    console.log('Emitir ->', r.status)
  } catch (e) { results.emitir = { error: e.message } }

  // 7) listar receitas do atendimento e gerar signed URL para a primeira
  try {
    const lr = await fetch(`${BASE}/api/receitas/paciente/${atendimentoId}`, { method: 'GET', headers: { ...auth } })
    const lrj = await lr.json()
    results.listar_receitas = { status: lr.status, body: lrj }
    const receitaId = lrj.receitas && lrj.receitas[0] && lrj.receitas[0].id
    if (receitaId) {
      const r = await fetch(`${BASE}/api/receita/${receitaId}/signed`, { method: 'GET', headers: { ...auth } })
      results.signed = { status: r.status, body: await r.json() }
      console.log('Signed ->', r.status)
    } else {
      results.signed = { error: 'Nenhuma receita encontrada para o atendimento' }
    }
  } catch (e) { results.signed = { error: e.message } }

  const outPath = path.join(outputDir, 'full_flow.json')
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
  console.log('Resultados gravados em', outPath)
}

main().catch(e => { console.error(e); process.exit(1) })
