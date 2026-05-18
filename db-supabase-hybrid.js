// db-supabase-hybrid.js
// Dual-write: Supabase (fonte principal) + JSON (fallback)
// SEM quebrar o sistema atual

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
const ws = require('ws')
const { v4: uuidv4 } = require('uuid')

// ========================
// CONFIGURAÇÃO
// ========================
const DB_DIR = path.join(__dirname, 'data')
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

// Supabase (se configurado)
let supabase = null
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || null

if (process.env.SUPABASE_URL && supabaseServiceKey) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_KEY) {
    console.warn('⚠️ SUPABASE_SERVICE_KEY detectado. Use SUPABASE_SERVICE_ROLE_KEY no backend para garantir a chave de service role.')
  }

  supabase = createClient(process.env.SUPABASE_URL, supabaseServiceKey, {
    realtime: {
      transport: ws
    }
  })
  console.log('✅ Supabase cliente inicializado')
} else {
  console.warn('⚠️ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados. Usando apenas JSON.')
}

// ========================
// FUNÇÕES AUXILIARES JSON (FALLBACK)
// ========================
function readJSON(file, defaultValue = []) {
  const filePath = path.join(DB_DIR, file)
  if (!fs.existsSync(filePath)) return defaultValue
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (e) {
    console.error(`❌ Erro ao ler ${file}:`, e.message)
    return defaultValue
  }
}

function writeJSON(file, data) {
  const filePath = path.join(DB_DIR, file)
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error(`❌ Erro ao escrever ${file}:`, e.message)
    return false
  }
}

// ========================
// 1. ATENDIMENTOS
// ========================

// Salvar atendimento (DUAL-WRITE)
async function salvarAtendimento(atendimento) {
  let supabaseOk = false
  
  // 1. Salvar no Supabase (se disponível)
  if (supabase) {
    try {
      // Mapear campos para o formato do Supabase
      const supabaseData = {
        id: atendimento.id,
        paciente_nome: atendimento.paciente?.nome || atendimento.paciente_nome,
        paciente_telefone: atendimento.paciente?.telefone || atendimento.paciente_telefone,
        paciente_cpf: atendimento.paciente?.cpf || atendimento.paciente_cpf,
        paciente_email: atendimento.paciente?.email || atendimento.paciente_email,
        paciente_data_nascimento: atendimento.paciente?.data_nascimento || atendimento.paciente_data_nascimento,
        paciente_endereco: atendimento.paciente?.endereco || atendimento.paciente_endereco,
        doenca_cronica: atendimento.doenca_cronica,
        tempo_doenca: atendimento.tempo_doenca,
        medicacao_em_uso: atendimento.medicacao_em_uso,
        validade_ultima_receita: atendimento.validade_ultima_receita,
        queixa_principal: atendimento.queixa_principal,
        historia_clinica: atendimento.historia_clinica,
        conduta_prescricao: atendimento.conduta_prescricao,
        foto_receita_url: atendimento.foto_receita_url,
        status: atendimento.status,
        elegivel: atendimento.elegivel,
        pagamento: atendimento.pagamento || false,
        stripe_session_id: atendimento.stripe_session_id,
        pago_em: atendimento.pago_em,
        dados_clinicos: atendimento.dados_clinicos || atendimento.triagem,
        decisao: atendimento.decisao,
        memed_prescription_id: atendimento.memed_prescription_id,
        memed_pdf_url: atendimento.memed_pdf_url,
        memed_payload: atendimento.memed_payload,
        criado_em: atendimento.criadoEm || atendimento.criado_em || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      // Remove campos undefined
      Object.keys(supabaseData).forEach(key => supabaseData[key] === undefined && delete supabaseData[key])
      
      const { error } = await supabase
        .from('atendimentos')
        .upsert(supabaseData, { onConflict: 'id' })
      
      if (!error) {
        supabaseOk = true
        console.log(`✅ Supabase: Atendimento ${atendimento.id} salvo`)
      } else {
        console.error(`⚠️ Supabase erro ao salvar ${atendimento.id}:`, error.message)
      }
    } catch (e) {
      console.error(`⚠️ Supabase exceção ao salvar ${atendimento.id}:`, e.message)
    }
  }
  
  // 2. Salvar no JSON (sempre, como fallback)
  const atendimentos = readJSON('atendimentos.json')
  const existingIndex = atendimentos.findIndex(a => a.id === atendimento.id)
  
  if (existingIndex >= 0) {
    atendimentos[existingIndex] = { ...atendimentos[existingIndex], ...atendimento, updated_at: new Date().toISOString() }
  } else {
    atendimentos.push({ ...atendimento, created_at: atendimento.criadoEm || new Date().toISOString() })
  }
  
  writeJSON('atendimentos.json', atendimentos)
  console.log(`✅ JSON: Atendimento ${atendimento.id} salvo`)
  
  return { supabase: supabaseOk, json: true }
}

// Buscar atendimento (PRIORIDADE: Supabase → JSON)
async function buscarAtendimentoPorId(id) {
  // 1. Tentar Supabase primeiro
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('id', id)
        .single()
      
      if (!error && data) {
        console.log(`✅ Supabase: Atendimento ${id} encontrado`)
        return data
      }
    } catch (e) {
      console.error(`⚠️ Supabase erro ao buscar ${id}:`, e.message)
    }
  }
  
  // 2. Fallback para JSON
  const atendimentos = readJSON('atendimentos.json')
  const atendimento = atendimentos.find(a => a.id === id)
  
  if (atendimento) {
    console.log(`✅ JSON: Atendimento ${id} encontrado`)
  } else {
    console.log(`❌ Atendimento ${id} não encontrado em nenhum lugar`)
  }
  
  return atendimento || null
}

// Buscar atendimento por memed_prescription_id
async function buscarAtendimentoPorMemedId(prescriptionId) {
  // 1. Tentar Supabase primeiro
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .eq('memed_prescription_id', prescriptionId)
        .single()
      
      if (!error && data) {
        return data
      }
    } catch (e) {}
  }
  
  // 2. Fallback para JSON
  const atendimentos = readJSON('atendimentos.json')
  return atendimentos.find(a => a.memed_prescription_id === prescriptionId) || null
}

// Listar todos atendimentos
async function getAtendimentos() {
  let supabaseData = []
  
  // 1. Tentar Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('atendimentos')
        .select('*')
        .order('criado_em', { ascending: false })
      
      if (!error && data) {
        supabaseData = data
        console.log(`✅ Supabase: ${data.length} atendimentos carregados`)
      }
    } catch (e) {}
  }
  
  // 2. Se Supabase não retornou dados, usar JSON
  if (supabaseData.length === 0) {
    supabaseData = readJSON('atendimentos.json')
    console.log(`✅ JSON: ${supabaseData.length} atendimentos carregados`)
  }
  
  return supabaseData
}

// Listar atendimentos por status
async function getAtendimentosPorStatus(status) {
  const atendimentos = await getAtendimentos()
  return atendimentos.filter(a => a.status === status)
}

// Atualizar status do atendimento
async function atualizarStatus(id, novoStatus, dadosAdicionais = {}) {
  let supabaseOk = false
  
  // 1. Atualizar Supabase
  if (supabase) {
    try {
      const updateData = {
        status: novoStatus,
        updated_at: new Date().toISOString(),
        ...dadosAdicionais
      }
      
      const { error } = await supabase
        .from('atendimentos')
        .update(updateData)
        .eq('id', id)
      
      if (!error) {
        supabaseOk = true
        console.log(`✅ Supabase: Status ${id} atualizado para ${novoStatus}`)
      }
    } catch (e) {}
  }
  
  // 2. Atualizar JSON
  const atendimentos = readJSON('atendimentos.json')
  const index = atendimentos.findIndex(a => a.id === id)
  if (index >= 0) {
    atendimentos[index] = {
      ...atendimentos[index],
      status: novoStatus,
      updated_at: new Date().toISOString(),
      ...dadosAdicionais
    }
    writeJSON('atendimentos.json', atendimentos)
    console.log(`✅ JSON: Status ${id} atualizado para ${novoStatus}`)
  }
  
  return supabaseOk
}

// Atualizar status de pagamento
async function atualizarStatusPagamento(id, pagamento, novoStatus) {
  let supabaseOk = false
  
  // 1. Atualizar Supabase
  if (supabase) {
    try {
      const { error } = await supabase
        .from('atendimentos')
        .update({
          pagamento: pagamento,
          status: novoStatus,
          pago_em: pagamento ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
      
      if (!error) {
        supabaseOk = true
        console.log(`✅ Supabase: Pagamento ${id} atualizado para ${pagamento}`)
      }
    } catch (e) {}
  }
  
  // 2. Atualizar JSON
  const atendimentos = readJSON('atendimentos.json')
  const index = atendimentos.findIndex(a => a.id === id)
  if (index >= 0) {
    atendimentos[index] = {
      ...atendimentos[index],
      pagamento: pagamento,
      status: novoStatus,
      pago_em: pagamento ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    }
    writeJSON('atendimentos.json', atendimentos)
    console.log(`✅ JSON: Pagamento ${id} atualizado para ${pagamento}`)
  }
  
  return supabaseOk
}

// Get fila válida (pagamento true + elegivel true + status FILA)
async function getFilaValida() {
  const atendimentos = await getAtendimentos()
  return atendimentos.filter(a => 
    a.pagamento === true && 
    a.elegivel === true && 
    a.status === 'FILA'
  )
}

// ========================
// 2. ESTATÍSTICAS
// ========================
async function getEstatisticas() {
  const atendimentos = await getAtendimentos()
  
  return {
    total: atendimentos.length,
    naFila: atendimentos.filter(a => a.status === 'FILA' && a.pagamento).length,
    aprovados: atendimentos.filter(a => a.status === 'APROVADO' || a.status === 'RECEITA_EMITIDA').length,
    recusados: atendimentos.filter(a => a.status === 'RECUSADO').length,
    aguardandoPagamento: atendimentos.filter(a => a.status === 'AGUARDANDO_PAGAMENTO').length,
    prontoParaDecisao: atendimentos.filter(a => a.status === 'PRONTO_PARA_DECISAO').length
  }
}

// ========================
// 3. RECEITAS
// ========================
async function salvarReceita(receita) {
  const normalized = {
    ...receita,
    atendimentoId: receita.atendimentoId || receita.atendimento_id,
    pdf_url: receita.pdf_url || receita.pdfUrl || receita.url || receita.memed_pdf_url || null
  }

  // Salvar no JSON
  const receitas = readJSON('receitas.json')
  const existingIndex = receitas.findIndex(r => r.id === normalized.id)
  
  if (existingIndex >= 0) {
    receitas[existingIndex] = { ...receitas[existingIndex], ...normalized }
  } else {
    receitas.push(normalized)
  }
  
  writeJSON('receitas.json', receitas)
  
  // Tentar salvar no Supabase (se disponível)
  if (supabase) {
    try {
      await supabase.from('receitas').upsert({
        id: normalized.id,
        atendimento_id: normalized.atendimentoId,
        numero: normalized.numero,
        paciente: normalized.paciente,
        medicamentos: normalized.medicamentos,
        observacoes: normalized.observacoes,
        medico: normalized.medico,
        data_emissao: normalized.data_emissao,
        data_validade: normalized.data_validade,
        assinatura_digital: normalized.assinatura_digital,
        status: normalized.status,
        memed_prescription_id: normalized.memed_prescription_id,
        pdf_url: normalized.pdf_url,
        storage_path: normalized.storage_path,
        created_at: normalized.created_at || new Date().toISOString()
      }, { onConflict: 'id' })
    } catch (e) {
      console.error('⚠️ Erro ao salvar receita no Supabase:', e.message)
    }
  }
  
  return normalized
}

async function buscarReceitaPorId(id) {
  const receitas = readJSON('receitas.json')
  const localReceita = receitas.find(r => r.id === id)
    || receitas.filter(r => (r.atendimentoId || r.atendimento_id) === id).slice(-1)[0]
    || null

  // Tentar Supabase primeiro
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('receitas')
        .select('*')
        .eq('id', id)
        .single()
      
      if (!error && data) return localReceita ? { ...data, ...localReceita } : data
    } catch (e) {}

    try {
      const { data, error } = await supabase
        .from('receitas')
        .select('*')
        .eq('atendimento_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (!error && data) return localReceita ? { ...data, ...localReceita } : data
    } catch (e) {}
  }
  
  // Fallback JSON
  return localReceita
}

async function listarReceitasPorAtendimento(atendimentoId) {
  // Tentar Supabase primeiro
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('receitas')
        .select('*')
        .eq('atendimento_id', atendimentoId)
        .order('data_emissao', { ascending: false })
      
      if (!error && data) return data
    } catch (e) {}
  }
  
  // Fallback JSON
  const receitas = readJSON('receitas.json')
  return receitas.filter(r => (r.atendimentoId || r.atendimento_id) === atendimentoId)
}

async function atualizarStatusReceita(id, status, motivo = null) {
  // Atualizar JSON
  const receitas = readJSON('receitas.json')
  const index = receitas.findIndex(r => r.id === id)
  if (index >= 0) {
    receitas[index].status = status
    if (motivo) receitas[index].motivo_cancelamento = motivo
    writeJSON('receitas.json', receitas)
  }
  
  // Tentar Supabase
  if (supabase) {
    try {
      const updateData = { status }
      if (motivo) updateData.motivo_cancelamento = motivo
      await supabase.from('receitas').update(updateData).eq('id', id)
    } catch (e) {}
  }
}

// ========================
// 4. FILA DE SUPORTE
// ========================
async function adicionarFilaSuporte(telefone, nome, mensagem = '') {
  const suporte = readJSON('fila_suporte.json')
  const novo = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    telefone,
    nome,
    mensagem,
    status: 'PENDENTE',
    criado_em: new Date().toISOString()
  }
  suporte.push(novo)
  writeJSON('fila_suporte.json', suporte)
  
  // Tentar Supabase
  if (supabase) {
    try {
      await supabase.from('fila_suporte').insert(novo)
    } catch (e) {}
  }
  
  return novo
}

async function getFilaSuporte() {
  let suporte = []
  
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('fila_suporte')
        .select('*')
        .eq('status', 'PENDENTE')
        .order('criado_em', { ascending: true })
      
      if (!error && data) suporte = data
    } catch (e) {}
  }
  
  if (suporte.length === 0) {
    suporte = readJSON('fila_suporte.json').filter(s => s.status === 'PENDENTE')
  }
  
  return suporte
}

async function responderFilaSuporte(id) {
  // Atualizar JSON
  const suporte = readJSON('fila_suporte.json')
  const index = suporte.findIndex(s => s.id == id)
  
  if (index >= 0) {
    suporte[index].status = 'RESPONDIDO'
    suporte[index].respondido_em = new Date().toISOString()
    writeJSON('fila_suporte.json', suporte)
  }
  
  // Tentar Supabase
  if (supabase) {
    try {
      await supabase
        .from('fila_suporte')
        .update({ status: 'RESPONDIDO', respondido_em: new Date().toISOString() })
        .eq('id', id)
    } catch (e) {}
  }
  
  return suporte[index] || null
}

// ========================
// 5. LOGS DE DECISÃO
// ========================
async function salvarDecisaoLog(log) {
  const logs = readJSON('decisoes_log.json')
  logs.push({
    ...log,
    created_at: new Date().toISOString()
  })
  writeJSON('decisoes_log.json', logs)
  
  if (supabase) {
    try {
      await supabase.from('decisoes_log').insert(log)
    } catch (e) {}
  }
}

async function getDecisoesLog(atendimentoId = null) {
  let logs = []
  
  if (supabase) {
    try {
      let query = supabase.from('decisoes_log').select('*')
      if (atendimentoId) query = query.eq('atendimento_id', atendimentoId)
      const { data, error } = await query.order('created_at', { ascending: false })
      
      if (!error && data) logs = data
    } catch (e) {}
  }
  
  if (logs.length === 0) {
    logs = readJSON('decisoes_log.json')
    if (atendimentoId) {
      logs = logs.filter(l => l.atendimento_id === atendimentoId)
    }
  }
  
  return logs
}

// ========================
// 6. HEALTH CHECK
// ========================
async function healthCheck() {
  let supabaseOk = false
  
  if (supabase) {
    try {
      const { error } = await supabase.from('atendimentos').select('id', { count: 'exact', head: true })
      supabaseOk = !error
    } catch (e) {}
  }
  
  const jsonOk = fs.existsSync(path.join(DB_DIR, 'atendimentos.json'))
  
  return {
    supabase: supabaseOk,
    json: jsonOk,
    status: supabaseOk || jsonOk ? 'connected' : 'disconnected'
  }
}

// ========================
// 7. INICIALIZAÇÃO
// ========================
async function initDB() {
  console.log('🔌 Inicializando db-supabase-hybrid...')
  
  // Garantir que as tabelas existem no Supabase
  if (supabase) {
    try {
      const { error } = await supabase.from('atendimentos').select('id', { count: 'exact', head: true })
      if (error && error.message.includes('does not exist')) {
        console.warn('⚠️ Tabela "atendimentos" não existe no Supabase. Execute o SQL de criação.')
      } else {
        console.log('✅ Supabase: Tabelas verificadas')
      }
    } catch (e) {}
  }
  
  console.log('✅ db-supabase-hybrid inicializado (Supabase + JSON)')
}

async function closeConnection() {
  console.log('🔌 Fechando conexões...')
}

// ========================
// EXPORTS (COMPATÍVEL COM SEU server.js)
// ========================
module.exports = {
  // Atendimentos
  salvarAtendimento,
  buscarAtendimentoPorId,
  buscarAtendimentoPorMemedId,
  getAtendimentos,
  getAtendimentosPorStatus,
  atualizarStatus,
  atualizarStatusPagamento,
  getFilaValida,
  
  // Estatísticas
  getEstatisticas,
  
  // Receitas
  salvarReceita,
  salvarReceitaArquivo,
  gerarSignedUrl,
  buscarReceitaPorId,
  listarReceitasPorAtendimento,
  atualizarStatusReceita,
  
  // Fila suporte
  adicionarFilaSuporte,
  getFilaSuporte,
  responderFilaSuporte,
  
  // Logs
  salvarDecisaoLog,
  getDecisoesLog,
  
  // Sistema
  healthCheck,
  initDB,
  closeConnection
}

// Salvar arquivo de receita no Supabase Storage (ou local fallback)
async function salvarReceitaArquivo(atendimentoId, buffer, contentType = 'application/pdf') {
  const id = atendimentoId
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const filename = `receita-${atendimentoId}.pdf`
  const storagePath = `receitas/${year}/${month}/${filename}`

  let publicUrl = null

  if (supabase) {
    try {
      const { error: uploadError } = await supabase.storage.from('receitas').upload(storagePath, buffer, { contentType, upsert: false })
      if (uploadError) {
        console.error('⚠️ Supabase storage upload error:', uploadError.message)
      } else {
        try {
          const { data } = supabase.storage.from('receitas').getPublicUrl(storagePath)
          publicUrl = data && data.publicUrl ? data.publicUrl : null
        } catch (e) {
          console.error('⚠️ Erro ao obter publicUrl:', e.message)
        }
      }
    } catch (e) {
      console.error('⚠️ Supabase storage exception:', e.message)
    }
  } else {
    // fallback local
    try {
      const dir = path.join(DB_DIR, 'receitas', String(year), month)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const filePath = path.join(dir, filename)
      fs.writeFileSync(filePath, buffer)
      publicUrl = `file://${filePath}`
      console.log(`✅ Receita salva localmente: ${filePath}`)
    } catch (e) {
      console.error('❌ Erro ao salvar receita localmente:', e.message)
    }
  }

  const receitaMeta = {
    id,
    atendimentoId,
    atendimento_id: atendimentoId,
    pdf_url: publicUrl,
    url: publicUrl,
    storage_path: storagePath,
    created_at: now.toISOString()
  }

  // Persistir metadados (JSON sempre, Supabase se disponível)
  try {
    const receitas = readJSON('receitas.json')
    const index = receitas.findIndex(r => r.id === receitaMeta.id)
    if (index >= 0) {
      receitas[index] = { ...receitas[index], ...receitaMeta }
    } else {
      receitas.push(receitaMeta)
    }
    writeJSON('receitas.json', receitas)
  } catch (e) {
    console.error('❌ Erro ao persistir metadados de receita localmente:', e.message)
  }

  if (supabase) {
    try {
      await supabase.from('receitas').upsert({
        id: receitaMeta.id,
        atendimento_id: atendimentoId,
        pdf_url: receitaMeta.pdf_url,
        storage_path: receitaMeta.storage_path,
        created_at: receitaMeta.created_at
      }, { onConflict: 'id' })
    } catch (e) {
      console.error('⚠️ Erro ao persistir metadados de receita no Supabase:', e.message)
    }
  }

  return receitaMeta
}

// Gerar signed URL para um arquivo no storage (tempo em segundos)
async function gerarSignedUrl(storagePath, expiresSeconds = 3600) {
  if (supabase) {
    try {
      const { data, error } = await supabase.storage.from('receitas').createSignedUrl(storagePath, expiresSeconds)
      if (!error && data && data.signedURL) return data.signedURL
      if (!error && data && data.signedUrl) return data.signedUrl
    } catch (e) {
      console.error('⚠️ Erro ao gerar signed URL:', e.message)
    }
  }

  // fallback: tentar obter URL público ou file:// do JSON
  const receitas = readJSON('receitas.json')
  const meta = receitas.find(r => r.storage_path === storagePath || r.id === storagePath || r.atendimentoId === storagePath || r.atendimento_id === storagePath)
  if (meta && (meta.pdf_url || meta.url)) return meta.pdf_url || meta.url

  return null
}
