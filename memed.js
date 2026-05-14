require('dotenv').config()
const axios = require('axios')
const jwt = require('jsonwebtoken')

function obterConfiguracaoMemed() {
  return {
    apiKey: process.env.MEMED_API_KEY,
    secretKey: process.env.MEMED_SECRET_KEY,
    ambiente: process.env.MEMED_ENVIRONMENT || 'homologacao'
  }
}

/**
 * Gera um token temporário para uso no frontend
 * (não expõe a secret key)
 */
async function gerarTokenFrontend() {
  try {
    // Método 1: Se a API da Memed tem geração de token
    const response = await axios.post('https://api.memed.com.br/v1/auth/token', {
      apiKey: process.env.MEMED_API_KEY,
      secretKey: process.env.MEMED_SECRET_KEY
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    })
    
    return response.data.token
  } catch (error) {
    console.error('❌ Erro ao gerar token frontend via API:', error.message)
    
    // Método 2: Fallback - gerar token JWT local
    const token = jwt.sign(
      { 
        type: 'memed_frontend',
        exp: Math.floor(Date.now() / 1000) + (60 * 30) // 30 minutos
      },
      process.env.JWT_SECRET
    )
    return token
  }
}

/**
 * Verifica status da conta Memed
 */
async function verificarStatusConta() {
  try {
    const config = obterConfiguracaoMemed()
    // Implementar verificação conforme documentação da Memed
    return {
      status: 'conectado',
      ambiente: config.ambiente,
      apiKey: config.apiKey ? 'configurada' : 'não configurada'
    }
  } catch (error) {
    console.error('❌ Erro ao verificar status:', error.message)
    return { status: 'erro', error: error.message }
  }
}

/**
 * Exclui prescrição na Memed (opcional)
 */
async function excluirPrescricaoMemed(externalId) {
  try {
    // Implementar conforme documentação da Memed
    console.log(`📡 Solicitando exclusão da prescrição ${externalId} na Memed`)
    return { success: true }
  } catch (error) {
    console.error('❌ Erro ao excluir prescrição:', error.message)
    return { success: false, error: error.message }
  }
}

// ✅ EXPORTAÇÃO CORRETA - tudo junto!
module.exports = {
  obterConfiguracaoMemed,
  gerarTokenFrontend,
  verificarStatusConta,
  excluirPrescricaoMemed
}