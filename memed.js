require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')

// Configuração
const MEMED_API_URL = process.env.MEMED_API_URL || 'https://integrations.api.memed.com.br/v1'
let cachedToken = null
let tokenExpiry = null

/**
 * Gera token do prescritor (médico) para usar no frontend
 */
async function gerarTokenPrescritor(somenteTeste = false) {
  try {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry && !somenteTeste) {
      return cachedToken
    }

    console.log('🔐 Gerando token do prescritor...')
    
    const payload = {
      cpf: process.env.MEMED_PRESCRITOR_CPF,
      boardNumber: process.env.MEMED_PRESCRITOR_BOARD_NUMBER,
      boardState: process.env.MEMED_PRESCRITOR_BOARD_STATE
    }
    
    const response = await axios.post(`${MEMED_API_URL}/prescribers/token`, payload, {
      headers: { 
        'Content-Type': 'application/json',
        'X-API-Key': process.env.MEMED_API_KEY
      },
      timeout: 15000
    })

    cachedToken = response.data.token
    tokenExpiry = Date.now() + (55 * 60 * 1000) // 55 minutos
    
    console.log('✅ Token do prescritor gerado com sucesso')
    return cachedToken
  } catch (error) {
    console.error('❌ Erro ao gerar token do prescritor:', error.response?.data || error.message)
    return null
  }
}

/**
 * Verifica status da conta na Memed
 */
async function verificarStatusConta() {
  try {
    const token = await gerarTokenPrescritor(true)
    if (!token) {
      return { status: 'erro', mensagem: 'Falha na autenticação' }
    }
    
    return {
      status: 'ok',
      prescritor: {
        nome: process.env.MEMED_PRESCRITOR_NOME,
        sobrenome: process.env.MEMED_PRESCRITOR_SOBRENOME,
        cpf: process.env.MEMED_PRESCRITOR_CPF,
        crm: `${process.env.MEMED_PRESCRITOR_BOARD_NUMBER}/${process.env.MEMED_PRESCRITOR_BOARD_STATE}`
      },
      ambiente: process.env.MEMED_ENVIRONMENT || 'homologacao'
    }
  } catch (error) {
    return { status: 'erro', mensagem: error.message }
  }
}

/**
 * Obter token para o frontend (usado pelo script MdHub)
 */
async function obterTokenMemed(req, res) {
  try {
    const token = await gerarTokenPrescritor()
    if (!token) {
      throw new Error('Não foi possível obter token')
    }
    return { success: true, token }
  } catch (error) {
    console.error('❌ Erro ao obter token Memed:', error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Salvar receita gerada pela Memed
 */
async function salvarReceitaMemed(atendimentoId, memedData) {
  try {
    const receita = {
      id: crypto.randomUUID(),
      atendimentoId: atendimentoId,
      numero: memedData.prescription_number || `MEM-${Date.now()}`,
      pdfUrl: memedData.pdf_url,
      prescriptionId: memedData.id,
      status: 'ATIVA',
      data_emissao: new Date().toISOString(),
      data_validade: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      memed_payload: memedData
    }
    
    // Salvar no banco (implementar conforme seu db)
    // await db.salvarReceita(receita)
    
    console.log(`✅ Receita Memed salva para atendimento ${atendimentoId}`)
    return receita
  } catch (error) {
    console.error('❌ Erro ao salvar receita:', error.message)
    return null
  }
}

/**
 * Testar conexão completa
 */
async function testarConexao() {
  console.log('🚀 Testando integração Memed...')
  
  // Verificar variáveis
  const vars = {
    MEMED_API_KEY: process.env.MEMED_API_KEY ? '✅' : '❌',
    MEMED_PRESCRITOR_CPF: process.env.MEMED_PRESCRITOR_CPF ? '✅' : '❌',
    MEMED_PRESCRITOR_BOARD_NUMBER: process.env.MEMED_PRESCRITOR_BOARD_NUMBER ? '✅' : '❌',
    MEMED_PRESCRITOR_BOARD_STATE: process.env.MEMED_PRESCRITOR_BOARD_STATE ? '✅' : '❌'
  }
  
  console.table(vars)
  
  if (!process.env.MEMED_API_KEY) {
    console.error('❌ MEMED_API_KEY não configurada')
    return false
  }
  
  const token = await gerarTokenPrescritor(true)
  if (token) {
    console.log('✅ Token gerado com sucesso!')
    return true
  } else {
    console.error('❌ Falha na geração do token')
    return false
  }
}

module.exports = {
  gerarTokenPrescritor,
  verificarStatusConta,
  obterTokenMemed,
  salvarReceitaMemed,
  testarConexao
}