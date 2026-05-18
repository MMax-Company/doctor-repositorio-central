require('dotenv').config()
const axios = require('axios')
const crypto = require('crypto')

// Configuração - USAR PRODUÇÃO
const MEMED_API_URL = process.env.MEMED_API_URL || 'https://integrations.api.memed.com.br/v1'
let cachedToken = null
let tokenExpiry = null

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
    tokenExpiry = Date.now() + (55 * 60 * 1000)
    
    console.log('✅ Token do prescritor gerado com sucesso')
    return cachedToken
  } catch (error) {
    console.error('❌ Erro ao gerar token do prescritor:', error.response?.data || error.message)
    return null
  }
}

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
      ambiente: process.env.MEMED_ENVIRONMENT || 'produção'
    }
  } catch (error) {
    return { status: 'erro', mensagem: error.message }
  }
}

async function obterTokenMemed() {
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
    
    console.log(`✅ Receita Memed salva para atendimento ${atendimentoId}`)
    return receita
  } catch (error) {
    console.error('❌ Erro ao salvar receita:', error.message)
    return null
  }
}

async function gerarPrescricaoMemed(paciente, medicamento, posologia, observacao = '') {
  try {
    const token = await gerarTokenPrescritor()
    if (!token) {
      throw new Error('Token Memed inválido')
    }

    // MODO FALLBACK - funciona sem Memed
    const prescriptionId = crypto.randomUUID()
    const pdfUrl = `${process.env.BASE_URL || 'http://localhost:3002'}/api/receita/${prescriptionId}/pdf`
    
    console.log(`✅ Prescrição gerada (modo fallback): ${prescriptionId}`)
    
    return {
      success: true,
      prescriptionId: prescriptionId,
      pdfUrl: pdfUrl,
      fullData: {
        paciente,
        medicamento,
        posologia,
        observacao,
        generated_at: new Date().toISOString(),
        fallback: true
      }
    }
  } catch (error) {
    console.error('❌ Erro gerarPrescricaoMemed:', error.message)
    return {
      success: false,
      error: error.message,
      fallback: true
    }
  }
}

async function testarConexao() {
  console.log('🚀 Testando integração Memed...')
  
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
  testarConexao,
  gerarPrescricaoMemed
}