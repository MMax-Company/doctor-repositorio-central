require('dotenv').config()

const path = require('path')
const fs = require('fs')

const ESTADOS_FLUXO = {
  TRIAGEM: 'TRIAGEM',
  INELEGIVEL: 'INELEGIVEL',
  AGUARDANDO_PAGAMENTO: 'AGUARDANDO_PAGAMENTO',
  FILA: 'FILA',
  EM_ATENDIMENTO: 'EM_ATENDIMENTO',
  PRONTO_PARA_DECISAO: 'PRONTO_PARA_DECISAO',
  APROVADO: 'APROVADO',
  RECUSADO: 'RECUSADO',
  RECEITA_EMITIDA: 'RECEITA_EMITIDA'
}

Object.freeze(ESTADOS_FLUXO)

const TRANSICOES_VALIDAS = {
  [ESTADOS_FLUXO.TRIAGEM]: [
    ESTADOS_FLUXO.AGUARDANDO_PAGAMENTO,
    ESTADOS_FLUXO.INELEGIVEL
  ],

  [ESTADOS_FLUXO.AGUARDANDO_PAGAMENTO]: [
    ESTADOS_FLUXO.FILA
  ],

  [ESTADOS_FLUXO.FILA]: [
    ESTADOS_FLUXO.EM_ATENDIMENTO
  ],

  [ESTADOS_FLUXO.EM_ATENDIMENTO]: [
    ESTADOS_FLUXO.PRONTO_PARA_DECISAO
  ],

  [ESTADOS_FLUXO.PRONTO_PARA_DECISAO]: [
    ESTADOS_FLUXO.APROVADO,
    ESTADOS_FLUXO.RECUSADO
  ],

  [ESTADOS_FLUXO.APROVADO]: [
    ESTADOS_FLUXO.RECEITA_EMITIDA,
    ESTADOS_FLUXO.RECUSADO
  ],

  [ESTADOS_FLUXO.RECUSADO]: [
    ESTADOS_FLUXO.APROVADO
  ]
}

Object.freeze(TRANSICOES_VALIDAS)

function transicaoValida(statusAtual, novoStatus) {
  const permitidos = TRANSICOES_VALIDAS[statusAtual]

  if (!permitidos) {
    return false
  }

  return permitidos.includes(novoStatus)
}

const NODE_ENV = process.env.NODE_ENV || 'development'

const IS_PRODUCTION = NODE_ENV === 'production'
const IS_DEVELOPMENT = NODE_ENV !== 'production'

const PORT = process.env.PORT || 3002

const BASE_URL =
  process.env.BASE_URL ||
  (
    process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : `http://localhost:${PORT}`
  )

const WHATSAPP_MODE =
  process.env.WHATSAPP_MODE || 'test'

const DB_DIR = path.join(
  __dirname,
  '..',
  'data'
)

const PUBLIC_DIR = path.join(
  __dirname,
  '..',
  'public'
)

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, {
    recursive: true
  })
}

const requiredEnvVars = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
]

module.exports = {
  ESTADOS_FLUXO,
  TRANSICOES_VALIDAS,
  transicaoValida,
  NODE_ENV,
  IS_PRODUCTION,
  IS_DEVELOPMENT,
  PORT,
  BASE_URL,
  WHATSAPP_MODE,
  DB_DIR,
  PUBLIC_DIR,
  requiredEnvVars
}

const crypto = require('crypto')

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY

if (!ENCRYPTION_KEY) {
  throw new Error('❌ ENCRYPTION_KEY não configurada')
}

if (!/^[a-fA-F0-9]{64}$/.test(ENCRYPTION_KEY)) {
  throw new Error('❌ ENCRYPTION_KEY deve conter 64 caracteres hexadecimais')
}

const ENCRYPTION_KEY_BUFFER = Buffer.from(
  ENCRYPTION_KEY,
  'hex'
)

function encrypt(text) {

  if (
    text === null ||
    text === undefined
  ) {
    return ''
  }

  const value = String(text)

  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY_BUFFER,
    iv
  )

  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ])

  const authTag = cipher.getAuthTag()

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex')
  ].join(':')
}

function decrypt(text) {

  if (!text) {
    return ''
  }

  try {

    const parts = text.split(':')

    if (parts.length !== 3) {
      throw new Error('Formato inválido')
    }

    const [
      ivHex,
      authTagHex,
      encryptedHex
    ] = parts

    const iv = Buffer.from(ivHex, 'hex')

    const authTag = Buffer.from(
      authTagHex,
      'hex'
    )

    const encryptedText = Buffer.from(
      encryptedHex,
      'hex'
    )

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY_BUFFER,
      iv
    )

    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final()
    ])

    return decrypted.toString('utf8')

  } catch (e) {

    console.error(
      '❌ Erro ao descriptografar:',
      e.message
    )

    return ''
  }
}

function safeDecrypt(
  text,
  fallback = ''
) {

  try {
    return decrypt(text)
  } catch {
    return fallback
  }
}

function encryptObject(obj) {

  if (
    !obj ||
    typeof obj !== 'object'
  ) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item =>
      encryptObject(item)
    )
  }

  const result = {}

  for (const [key, value] of Object.entries(obj)) {

    if (typeof value === 'string') {

      result[key] = encrypt(value)

    } else if (
      value &&
      typeof value === 'object'
    ) {

      result[key] = encryptObject(value)

    } else {

      result[key] = value
    }
  }

  return result
}

function decryptObject(obj) {

  if (
    !obj ||
    typeof obj !== 'object'
  ) {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(item =>
      decryptObject(item)
    )
  }

  const result = {}

  for (const [key, value] of Object.entries(obj)) {

    if (typeof value === 'string') {

      result[key] = safeDecrypt(
        value,
        value
      )

    } else if (
      value &&
      typeof value === 'object'
    ) {

      result[key] = decryptObject(value)

    } else {

      result[key] = value
    }
  }

  return result
}

module.exports = {
  encrypt,
  decrypt,
  safeDecrypt,
  encryptObject,
  decryptObject
}

const Joi = require('joi')

function validarTelefone(telefone) {

  if (!telefone) {
    return false
  }

  const limpo = String(telefone)
    .replace(/\D/g, '')

  return (
    limpo.length >= 10 &&
    limpo.length <= 13
  )
}

function validarCPF(cpf) {

  if (!cpf) {
    return false
  }

  cpf = String(cpf)
    .replace(/\D/g, '')

  if (cpf.length !== 11) {
    return false
  }

  if (/^(\d)\1+$/.test(cpf)) {
    return false
  }

  let soma = 0
  let resto

  for (let i = 1; i <= 9; i++) {
    soma += parseInt(
      cpf.substring(i - 1, i)
    ) * (11 - i)
  }

  resto = (soma * 10) % 11

  if (
    resto === 10 ||
    resto === 11
  ) {
    resto = 0
  }

  if (
    resto !==
    parseInt(cpf.substring(9, 10))
  ) {
    return false
  }

  soma = 0

  for (let i = 1; i <= 10; i++) {
    soma += parseInt(
      cpf.substring(i - 1, i)
    ) * (12 - i)
  }

  resto = (soma * 10) % 11

  if (
    resto === 10 ||
    resto === 11
  ) {
    resto = 0
  }

  return (
    resto ===
    parseInt(cpf.substring(10, 11))
  )
}

function sanitizarHTML(texto) {

  if (
    !texto ||
    typeof texto !== 'string'
  ) {
    return ''
  }

  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .trim()
}

function sanitizeForLog(obj) {

  try {

    const copy = JSON.parse(
      JSON.stringify(obj)
    )

    const secretKeys = [
      /key/i,
      /token/i,
      /secret/i,
      /senha/i,
      /password/i,
      /authorization/i,
      /cookie/i,
      /bearer/i,
      /api[_-]?key/i
    ]

    function walk(target) {

      if (
        !target ||
        typeof target !== 'object'
      ) {
        return
      }

      for (const key of Object.keys(target)) {

        const value = target[key]

        if (
          value &&
          typeof value === 'object'
        ) {

          walk(value)

        } else {

          const isSecret =
            secretKeys.some(regex =>
              regex.test(key)
            )

          if (isSecret) {
            target[key] =
              '***REDACTED***'
          }
        }
      }
    }

    walk(copy)

    return copy

  } catch {

    return {
      error:
        'failed_to_sanitize_log'
    }
  }
}

const textoSeguro = Joi.string()
  .trim()
  .max(5000)

const textoCurto = Joi.string()
  .trim()
  .max(255)

const triagemSchema = Joi.object({

  paciente: Joi.object({

    nome: textoCurto
      .min(3)
      .required(),

    telefone: Joi.string()
      .pattern(/^\d{10,13}$/)
      .required(),

    cpf: Joi.string()
      .allow('', null),

    email: Joi.string()
      .email()
      .allow('', null),

    data_nascimento: Joi.string()
      .allow('', null)

  }).required(),

  triagem: Joi.object({

    doencas: textoSeguro
      .required(),

    medicacao_em_uso:
      textoSeguro.required(),

    tempo_doenca: Joi.number()
      .min(1)
      .max(50000)
      .required(),

    posologia_atual:
      textoSeguro.allow(
        '',
        null
      ),

    receita_vencida_dias:
      Joi.number()
        .min(0)
        .max(3650)
        .allow(null),

    ultima_consulta:
      textoCurto.allow(
        '',
        null
      ),

    comorbidades:
      textoSeguro.allow(
        '',
        null
      ),

    alergias:
      textoSeguro.allow(
        '',
        null
      )

  }).required()

})

const decisaoSchema = Joi.object({

  decisao: Joi.string()
    .valid(
      'APROVAR',
      'RECUSAR',
      'APROVADO',
      'RECUSADO'
    )
    .required(),

  orientacoes:
    textoSeguro.allow(
      '',
      null
    ),

  medicamento:
    textoCurto.allow(
      '',
      null
    ),

  posologia:
    textoSeguro.allow(
      '',
      null
    ),

  receita_memed_id:
    textoCurto.allow(
      '',
      null
    ),

  memed_payload: Joi.object()
    .unknown(true)
    .allow(null)

})

const revisaoSchema = Joi.object({

  novaDecisao: Joi.string()
    .valid(
      'APROVAR',
      'RECUSAR',
      'APROVADO',
      'RECUSADO'
    )
    .required(),

  motivoRevisao:
    textoSeguro.allow(
      '',
      null
    ),

  observacao:
    textoSeguro.allow(
      '',
      null
    ),

  medicamento:
    textoCurto.allow(
      '',
      null
    ),

  posologia:
    textoSeguro.allow(
      '',
      null
    )

})

module.exports = {
  validarTelefone,
  validarCPF,
  sanitizarHTML,
  sanitizeForLog,
  triagemSchema,
  decisaoSchema,
  revisaoSchema
}

const jwt = require('jsonwebtoken')

const JWT_SECRET =
  process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error(
    '❌ JWT_SECRET não configurado'
  )
}

function gerarToken(payload = {}) {

  return jwt.sign(
    {
      role: 'medico',
      timestamp: Date.now(),
      ...payload
    },
    JWT_SECRET,
    {
      expiresIn: '8h'
    }
  )
}

function auth(req, res, next) {

  try {

    const authHeader =
      req.headers.authorization

    if (
      !authHeader ||
      !authHeader.startsWith(
        'Bearer '
      )
    ) {

      return res.status(401).json({
        error:
          'Token não fornecido'
      })
    }

    const token =
      authHeader.split(' ')[1]

    if (!token) {

      return res.status(401).json({
        error: 'Token inválido'
      })
    }

    const decoded = jwt.verify(
      token,
      JWT_SECRET
    )

    req.usuario = decoded

    next()

  } catch (e) {

    if (
      e.name ===
      'TokenExpiredError'
    ) {

      return res.status(401).json({
        error:
          'Token expirado'
      })
    }

    if (
      e.name ===
      'JsonWebTokenError'
    ) {

      return res.status(401).json({
        error:
          'Token inválido'
      })
    }

    console.error(
      '❌ Auth middleware:',
      e.message
    )

    return res.status(401).json({
      error:
        'Não autorizado'
    })
  }
}

function webhookAuth(
  req,
  res,
  next
) {

  const apiKey =
    req.headers['x-api-key']

  const expectedKey =
    process.env.INTERNAL_API_KEY

  if (!expectedKey) {

    return res.status(500).json({
      error:
        'Webhook auth não configurado'
    })
  }

  if (!apiKey) {

    return res.status(401).json({
      error:
        'API key ausente'
    })
  }

  if (apiKey !== expectedKey) {

    return res.status(401).json({
      error:
        'API key inválida'
    })
  }

  next()
}

function requireRole(role) {

  return (
    req,
    res,
    next
  ) => {

    if (!req.usuario) {

      return res.status(401).json({
        error:
          'Usuário não autenticado'
      })
    }

    if (
      req.usuario.role !== role
    ) {

      return res.status(403).json({
        error:
          'Acesso negado'
      })
    }

    next()
  }
}

module.exports = {
  gerarToken,
  auth,
  webhookAuth,
  requireRole
}

const { IS_PRODUCTION } =
  require('../config')

function errorHandler(
  err,
  req,
  res,
  next
) {

  const statusCode =
    err.statusCode || 500

  const errorPayload = {
    message: err.message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent:
      req.headers['user-agent']
  }

  if (!IS_PRODUCTION) {
    errorPayload.stack =
      err.stack
  }

  console.error(
    '❌ [ERROR]',
    errorPayload
  )

  if (err.isJoi) {

    return res.status(400).json({
      error:
        'Dados inválidos',

      detalhes:
        err.details.map(d => ({
          campo:
            d.path.join('.'),
          mensagem:
            d.message
        }))
    })
  }

  if (
    err instanceof SyntaxError &&
    err.status === 400 &&
    'body' in err
  ) {

    return res.status(400).json({
      error:
        'JSON inválido',

      mensagem:
        'Corpo da requisição mal formatado'
    })
  }

  if (
    err.name ===
    'JsonWebTokenError'
  ) {

    return res.status(401).json({
      error:
        'Token inválido'
    })
  }

  if (
    err.name ===
    'TokenExpiredError'
  ) {

    return res.status(401).json({
      error:
        'Token expirado'
    })
  }

  if (
    err.type ===
    'entity.too.large'
  ) {

    return res.status(413).json({
      error:
        'Payload muito grande'
    })
  }

  return res.status(statusCode).json({

    error:
      IS_PRODUCTION &&
      statusCode === 500
        ? 'Erro interno do servidor'
        : err.message ||
          'Erro desconhecido',

    ...(IS_PRODUCTION
      ? {}
      : {
          stack: err.stack
        })
  })
}

function notFoundHandler(
  req,
  res
) {

  return res.status(404).json({
    error:
      'Rota não encontrada',

    method:
      req.method,

    path:
      req.originalUrl
  })
}

function asyncHandler(fn) {

  return function (
    req,
    res,
    next
  ) {

    Promise.resolve(
      fn(req, res, next)
    ).catch(next)
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler
}

function detectarTipo(texto) {

  if (!texto) {
    return 'OUTRO'
  }

  const lowerText = String(texto)
    .toLowerCase()

  if (
    lowerText.includes('hipert') ||
    lowerText.includes('pressão') ||
    lowerText.includes('pressao') ||
    lowerText.includes('has')
  ) {
    return 'HAS'
  }

  if (
    lowerText.includes('diabetes') ||
    lowerText.includes('açucar') ||
    lowerText.includes('acucar')
  ) {
    return 'DIABETES'
  }

  if (
    lowerText.includes('tireo') ||
    lowerText.includes('hipotireoidismo')
  ) {
    return 'HIPOTIREOIDISMO'
  }

  if (
    lowerText.includes('colesterol') ||
    lowerText.includes('dislipidemia')
  ) {
    return 'DISLIPIDEMIA'
  }

  if (
    lowerText.includes('ansiedade') ||
    lowerText.includes('depressão') ||
    lowerText.includes('depressao')
  ) {
    return 'SAUDE_MENTAL'
  }

  return 'OUTRO'
}

function gerarQueixa(tipo) {

  const base = {

    HAS:
      'Paciente em acompanhamento por hipertensão arterial sistêmica, solicita renovação de receita.',

    DIABETES:
      'Paciente em acompanhamento por diabetes mellitus tipo 2, solicita continuidade do tratamento.',

    HIPOTIREOIDISMO:
      'Paciente com hipotireoidismo em tratamento, solicita renovação de medicação.',

    DISLIPIDEMIA:
      'Paciente com dislipidemia em tratamento, solicita renovação de medicação.',

    SAUDE_MENTAL:
      'Paciente em acompanhamento por transtorno de ansiedade/depressão, solicita renovação.',

    OUTRO:
      'Paciente em acompanhamento clínico, solicita renovação de medicação de uso contínuo.'
  }

  return base[tipo] || base.OUTRO
}

function gerarHistoria(tipo) {

  const historias = {

    HAS:
      'Paciente refere estabilidade do quadro pressórico. Nega cefaleia, tontura ou palpitações. Sem internações recentes. Adesão ao tratamento relatada.',

    DIABETES:
      'Paciente nega poliúria, polidipsia ou polifagia. Refere seguimento com nutricionista. Realiza monitorização glicêmica.',

    HIPOTIREOIDISMO:
      'Paciente nega ganho ponderal excessivo, astenia ou intolerância ao frio. Refere boa energia para atividades diárias.',

    DISLIPIDEMIA:
      'Paciente relata dieta hipolipídica. Nega eventos cardiovasculares prévios.',

    SAUDE_MENTAL:
      'Paciente relata melhora do humor e ansiedade com medicação atual. Nega ideação suicida.',

    OUTRO:
      'Paciente refere-se assintomático no momento. Sem intercorrências desde o último atendimento.'
  }

  return historias[tipo] || historias.OUTRO
}

function gerarExameFisico(tipo) {

  const exames = {

    HAS:
      'PA informada pelo paciente como controlada. FC dentro da normalidade.',

    DIABETES:
      'Paciente eutrófico. Sem lesões de pele. Extremidades preservadas.',

    HIPOTIREOIDISMO:
      'Sem sinais clínicos evidentes de descompensação tireoidiana.',

    DISLIPIDEMIA:
      'Sem alterações clínicas relevantes ao exame remoto.',

    SAUDE_MENTAL:
      'Paciente contactuante, orientado em tempo e espaço, sem sinais aparentes de agitação.',

    OUTRO:
      'Consulta remota. Exame físico limitado sem alterações relevantes relatadas.'
  }

  return exames[tipo] || exames.OUTRO
}

function gerarConduta(tipo) {

  const condutas = {

    HAS:
      'Manter tratamento anti-hipertensivo atual. Orientado controle pressórico domiciliar e retorno em 3 meses.',

    DIABETES:
      'Manter hipoglicemiante oral. Reforçadas orientações dietéticas e atividade física regular.',

    HIPOTIREOIDISMO:
      'Manter levotiroxina na dose habitual. Solicitar TSH para acompanhamento.',

    DISLIPIDEMIA:
      'Manter estatina e medidas não farmacológicas.',

    SAUDE_MENTAL:
      'Manter medicação atual. Orientado acompanhamento psicológico.',

    OUTRO:
      'Manter tratamento habitual e retornar em caso de intercorrências.'
  }

  return condutas[tipo] || condutas.OUTRO
}

function gerarRecomendacoes(tipo) {

  const recomendacoes = {

    HAS:
      '- Redução do sal\n- Exercícios físicos\n- Controle pressórico regular',

    DIABETES:
      '- Controle alimentar\n- Monitorização glicêmica\n- Atividade física',

    HIPOTIREOIDISMO:
      '- Uso em jejum\n- Evitar medicação concomitante\n- Controle laboratorial',

    DISLIPIDEMIA:
      '- Dieta hipolipídica\n- Atividade física\n- Controle periódico',

    SAUDE_MENTAL:
      '- Higiene do sono\n- Psicoterapia\n- Redução de estresse',

    OUTRO:
      '- Hidratação adequada\n- Hábitos saudáveis\n- Retorno se necessário'
  }

  return recomendacoes[tipo] || recomendacoes.OUTRO
}

function normalizarDoencas(doencas) {

  if (Array.isArray(doencas)) {
    return doencas
      .join(', ')
      .toLowerCase()
  }

  if (typeof doencas === 'string') {
    return doencas.toLowerCase()
  }

  return String(
    doencas || ''
  ).toLowerCase()
}

function normalizarMedicamentosReceita(
  receita = {},
  atendimento = null
) {

  let medicamentos =
    receita.medicamentos

  if (
    typeof medicamentos ===
    'string'
  ) {

    try {

      medicamentos =
        JSON.parse(medicamentos)

    } catch {

      medicamentos = null
    }
  }

  if (
    Array.isArray(medicamentos) &&
    medicamentos.length > 0
  ) {
    return medicamentos
  }

  const dadosClinicos =
    atendimento?.dados_clinicos ||
    atendimento?.triagem ||
    {}

  const decisao =
    atendimento?.decisao ||
    {}

  return [{
    nome:
      decisao.medicamento_prescrito ||
      dadosClinicos.medicacao_em_uso ||
      receita.medicamento ||
      'Medicamento não informado',

    posologia:
      decisao.posologia ||
      dadosClinicos.posologia_atual ||
      receita.posologia ||
      'Uso conforme orientação médica',

    quantidade:
      receita.quantidade || 30,

    duracao:
      receita.duracao || '30 dias'
  }]
}

module.exports = {
  detectarTipo,
  gerarQueixa,
  gerarHistoria,
  gerarExameFisico,
  gerarConduta,
  gerarRecomendacoes,
  normalizarDoencas,
  normalizarMedicamentosReceita
}

const { v4: uuidv4 } =
  require('uuid')

const db =
  require('../db-supabase-hybrid')

const {
  ESTADOS_FLUXO,
  BASE_URL
} = require('../config')

const {
  encrypt
} = require('../utils/crypto')

const {
  validarTelefone,
  validarCPF,
  sanitizarHTML,
  triagemSchema
} = require('../utils/validators')

const {
  detectarTipo,
  normalizarDoencas
} = require('../services/clinicalEngine')

const {
  enviarWhatsAppOficial
} = require('../services/whatsappService')

function validarInputTriagem(
  paciente,
  triagem
) {

  const erros = []

  if (
    !paciente.nome ||
    String(
      paciente.nome || ''
    ).trim().length < 3
  ) {

    erros.push(
      'Nome do paciente inválido'
    )
  }

  if (
    !paciente.telefone ||
    !validarTelefone(
      paciente.telefone
    )
  ) {

    erros.push(
      'Telefone inválido'
    )
  }

  if (
    paciente.cpf &&
    !validarCPF(
      paciente.cpf
    )
  ) {

    erros.push(
      'CPF inválido'
    )
  }

  if (
    !triagem.doencas
  ) {

    erros.push(
      'Doença não informada'
    )
  }

  if (
    !triagem.medicacao_em_uso
  ) {

    erros.push(
      'Medicação em uso obrigatória'
    )
  }

  if (
    !triagem.tempo_doenca ||
    parseInt(
      triagem.tempo_doenca
    ) < 30
  ) {

    erros.push(
      'Tempo de doença inválido'
    )
  }

  return erros
}

async function triagem(
  req,
  res
) {

  try {

    const body =
      req.body || {}

    let paciente =
      body.paciente || {}

    let triagem =
      body.triagem || {}

    if (
      !body.paciente &&
      (
        body.nome ||
        body.telefone ||
        body.cpf ||
        body.doencas ||
        body.medicacao_em_uso
      )
    ) {

      paciente = {
        nome:
          body.nome,

        telefone:
          body.telefone,

        cpf:
          body.cpf,

        email:
          body.email,

        data_nascimento:
          body.data_nascimento
      }

      triagem = {
        doencas:
          body.doencas ||
          body.condicao,

        medicacao_em_uso:
          body.medicacao_em_uso ||
          body.medicacao ||
          '',

        posologia_atual:
          body.posologia_atual ||
          null,

        tempo_doenca:
          body.tempo_doenca ||
          body.tempo_doenca_dias ||
          null,

        receita_vencida_dias:
          body.receita_vencida_dias ||
          null,

        ultima_consulta:
          body.ultima_consulta ||
          null,

        comorbidades:
          body.comorbidades ||
          null,

        alergias:
          body.alergias ||
          null
      }
    }

    const { error } =
      triagemSchema.validate({
        paciente,
        triagem
      })

    if (error) {

      const errosLegado =
        validarInputTriagem(
          paciente,
          triagem
        )

      if (
        errosLegado.length > 0
      ) {

        return res.status(400)
          .json({
            error:
              'Dados inválidos',

            detalhes:
              errosLegado
          })
      }
    }

    paciente.nome =
      sanitizarHTML(
        paciente.nome
      )

    triagem.doencas =
      sanitizarHTML(
        triagem.doencas
      )

    triagem.medicacao_em_uso =
      sanitizarHTML(
        triagem.medicacao_em_uso
      )

    const id =
      uuidv4()

    const texto =
      normalizarDoencas(
        triagem.doencas
      )

    const tipo =
      detectarTipo(texto)

    const doencasElegiveis = [
      'has',
      'diabetes',
      'hipertensão',
      'hipertensao',
      'pressão',
      'pressao',
      'hipotireoidismo',
      'dislipidemia'
    ]

    const elegivel =
      doencasElegiveis.some(
        d => texto.includes(d)
      )

    const atendimento = {

      id,

      paciente: {

        nome: encrypt(
          paciente.nome
        ),

        cpf: encrypt(
          paciente.cpf || ''
        ),

        telefone: encrypt(
          paciente.telefone || ''
        ),

        email: encrypt(
          paciente.email || ''
        ),

        data_nascimento:
          paciente.data_nascimento ||
          null
      },

      dados_clinicos: {

        doenca:
          texto,

        tipo,

        medicacao_em_uso:
          triagem.medicacao_em_uso ||
          null,

        posologia_atual:
          triagem.posologia_atual ||
          null,

        tempo_doenca:
          triagem.tempo_doenca ||
          null,

        receita_vencida_dias:
          triagem.receita_vencida_dias ||
          null,

        ultima_consulta:
          triagem.ultima_consulta ||
          null,

        comorbidades:
          triagem.comorbidades ||
          null,

        alergias:
          triagem.alergias ||
          null,

        elegivel_protocolo:
          elegivel,

        risco:
          'baixo'
      },

      elegivel,

      motivo:
        elegivel
          ? 'Condição elegível para renovação remota'
          : 'Condição não elegível para renovação remota',

      status:
        elegivel
          ? ESTADOS_FLUXO.AGUARDANDO_PAGAMENTO
          : ESTADOS_FLUXO.INELEGIVEL,

      pagamento: false,

      criadoEm:
        new Date()
          .toISOString()
    }

    const salvarResult =
      await db.salvarAtendimento(
        atendimento
      )

    if (elegivel) {

      const url =
        `${BASE_URL}/api/payment/${id}`

      const mensagem =
`👋 Olá ${paciente.nome}!

✅ Sua triagem foi aprovada!

💳 Clique para pagar:
${url}

💰 R$ 69,90

🔐 Consulta Assíncrona Segura`

      enviarWhatsAppOficial(
        paciente.telefone,
        mensagem
      ).catch(console.error)

    } else {

      const mensagem =
`❌ Infelizmente sua condição não se qualifica para renovação remota.

Procure atendimento presencial.`

      enviarWhatsAppOficial(
        paciente.telefone,
        mensagem
      ).catch(console.error)
    }

    return res.status(201)
      .json({

        success: true,

        id,

        elegivel,

        atendimentoId: id,

        mensagem:
          elegivel
            ? 'Elegível. Link enviado por WhatsApp'
            : 'Não elegível',

        persisted: {

          supabase:
            salvarResult?.supabase === true,

          json:
            salvarResult?.json === true
        }
      })

  } catch (e) {

    console.error(
      '❌ Triagem:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro interno na triagem'
      })
  }
}

module.exports = {
  triagem
}

const db =
  require('../db-supabase-hybrid')

const {
  ESTADOS_FLUXO,
  BASE_URL
} = require('../config')

const {
  safeDecrypt
} = require('../utils/crypto')

const {
  enviarWhatsAppOficial
} = require('../services/whatsappService')

if (
  !process.env.STRIPE_SECRET_KEY
) {

  console.warn(
    '⚠️ STRIPE_SECRET_KEY não configurada'
  )
}

const stripe =
  process.env.STRIPE_SECRET_KEY
    ? require('stripe')(
        process.env.STRIPE_SECRET_KEY
      )
    : null

async function criarPagamento(
  req,
  res
) {

  try {

    if (!stripe) {

      return res.status(500)
        .json({
          error:
            'Stripe não configurado'
        })
    }

    const atendimentoId =
      req.params.id

    const at =
      await db.buscarAtendimentoPorId(
        atendimentoId
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    if (
      at.status !==
      ESTADOS_FLUXO.AGUARDANDO_PAGAMENTO
    ) {

      return res.status(400)
        .json({
          error:
            `Status inválido: ${at.status}`
        })
    }

    if (at.pagamento) {

      return res.status(400)
        .json({
          error:
            'Pagamento já realizado'
        })
    }

    const session =
      await stripe.checkout.sessions.create({

        mode: 'payment',

        payment_method_types: [
          'card'
        ],

        metadata: {
          atendimentoId
        },

        line_items: [{
          price_data: {

            currency:
              process.env.CURRENCY ||
              'brl',

            product_data: {

              name:
                process.env.PRODUCT_NAME ||
                'Consulta Assíncrona - Doctor Prescreve',

              description:
                'Renovação de receita médica com avaliação médica'
            },

            unit_amount:
              parseInt(
                process.env.PRODUCT_PRICE
              ) || 6990
          },

          quantity: 1
        }],

        success_url:
          `${BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${BASE_URL}/cancel`
      })

    console.log(
      `💳 Stripe Session: ${session.id}`
    )

    return res.json({

      url:
        session.url,

      sessionId:
        session.id,

      paymentId:
        session.id
    })

  } catch (e) {

    console.error(
      '❌ Stripe:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao criar pagamento'
      })
  }
}

async function statusPagamento(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    return res.json({

      atendimentoId:
        at.id,

      pago:
        at.pagamento || false,

      status:
        at.status,

      criado_em:
        at.criado_em,

      pago_em:
        at.pago_em || null
    })

  } catch (e) {

    console.error(
      '❌ Status pagamento:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao consultar pagamento'
      })
  }
}

const processedStripeEvents =
  new Set()

async function webhookStripe(
  req,
  res
) {

  const sig =
    req.headers[
      'stripe-signature'
    ]

  if (
    !process.env
      .STRIPE_WEBHOOK_SECRET
  ) {

    return res.status(500)
      .json({
        error:
          'Webhook Stripe não configurado'
      })
  }

  try {

    const rawBody =
      Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from(
            req.body || ''
          )

    const event =
      stripe.webhooks.constructEvent(
        rawBody,
        sig,
        process.env
          .STRIPE_WEBHOOK_SECRET
      )

    if (
      processedStripeEvents.has(
        event.id
      )
    ) {

      return res.json({
        received: true,
        duplicate: true
      })
    }

    processedStripeEvents.add(
      event.id
    )

    console.log(
      `📡 Stripe Event: ${event.type}`
    )

    if (
      event.type ===
      'checkout.session.completed'
    ) {

      const session =
        event.data.object

      const atendimentoId =
        session.metadata
          ?.atendimentoId

      if (!atendimentoId) {

        return res.json({
          received: true
        })
      }

      const at =
        await db.buscarAtendimentoPorId(
          atendimentoId
        )

      if (!at) {

        return res.json({
          received: true
        })
      }

      if (
        at.pagamento
      ) {

        return res.json({
          received: true,
          alreadyPaid: true
        })
      }

      if (
        at.status !==
        ESTADOS_FLUXO.AGUARDANDO_PAGAMENTO
      ) {

        return res.json({
          received: true,
          invalidStatus: true
        })
      }

      await db.atualizarStatusPagamento(
        atendimentoId,
        true,
        ESTADOS_FLUXO.FILA
      )

      const telefone =
        safeDecrypt(
          at.paciente_telefone
        )

      const nome =
        safeDecrypt(
          at.paciente_nome
        )

      if (telefone) {

        const mensagem =
`✅ Pagamento confirmado, ${nome}!

👨‍⚕️ Seu atendimento entrou na fila.

⏳ Você receberá a resposta em até 24h.`

        enviarWhatsAppOficial(
          telefone,
          mensagem
        ).catch(console.error)
      }

      console.log(
        `✅ Pagamento confirmado: ${atendimentoId}`
      )
    }

    return res.json({
      received: true
    })

  } catch (e) {

    console.error(
      '❌ Webhook Stripe:',
      e.message
    )

    return res.status(400)
      .send(
        `Webhook Error: ${e.message}`
      )
  }
}

module.exports = {
  criarPagamento,
  statusPagamento,
  webhookStripe
}

const db =
  require('../db-supabase-hybrid')

const {
  ESTADOS_FLUXO
} = require('../config')

const {
  safeDecrypt
} = require('../utils/crypto')

function mascararTelefone(
  telefone
) {

  if (!telefone) {
    return ''
  }

  return telefone.replace(
    /(\d{2})\d{5}(\d{4})/,
    '$1*****$2'
  )
}

function mascararCPF(cpf) {

  if (!cpf) {
    return ''
  }

  return cpf.replace(
    /(\d{3})\d{3}(\d{3}\d{2})/,
    '$1***$2'
  )
}

function formatarAtendimento(
  a,
  mascarar = true
) {

  const dadosClinicos =
    a.dados_clinicos ||
    a.triagem ||
    {}

  const telefone =
    safeDecrypt(
      a.paciente_telefone
    )

  const cpf =
    safeDecrypt(
      a.paciente_cpf
    )

  return {

    id:
      a.id,

    paciente_nome:
      safeDecrypt(
        a.paciente_nome
      ),

    paciente_telefone:
      mascarar
        ? mascararTelefone(
            telefone
          )
        : telefone,

    paciente_cpf:
      mascarar
        ? mascararCPF(cpf)
        : cpf,

    paciente_email:
      safeDecrypt(
        a.paciente_email
      ),

    doencas:
      dadosClinicos.doenca ||
      dadosClinicos.condicao ||
      'N/A',

    medicacao_em_uso:
      dadosClinicos.medicacao_em_uso ||
      'N/A',

    tempo_doenca:
      dadosClinicos.tempo_doenca ||
      'N/A',

    receita_vencida_dias:
      dadosClinicos.receita_vencida_dias ||
      'N/A',

    tipo:
      dadosClinicos.tipo ||
      'OUTRO',

    elegivel:
      a.elegivel,

    elegivel_protocolo:
      dadosClinicos.elegivel_protocolo ||
      false,

    status:
      a.status,

    pagamento:
      a.pagamento,

    decisao:
      a.decisao || null,

    criado_em:
      a.criado_em,

    pago_em:
      a.pago_em || null
  }
}

async function iniciarAtendimento(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    if (
      at.status !==
      ESTADOS_FLUXO.FILA
    ) {

      return res.status(400)
        .json({
          error:
            `Status inválido: ${at.status}`
        })
    }

    await db.atualizarStatus(
      req.params.id,
      ESTADOS_FLUXO.EM_ATENDIMENTO
    )

    return res.json({
      success: true,
      message:
        'Atendimento iniciado'
    })

  } catch (e) {

    console.error(
      '❌ iniciarAtendimento:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao iniciar atendimento'
      })
  }
}

async function moverParaProntoDecisao(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    if (
      at.status !==
      ESTADOS_FLUXO.EM_ATENDIMENTO
    ) {

      return res.status(400)
        .json({
          error:
            `Status inválido: ${at.status}`
        })
    }

    await db.atualizarStatus(
      req.params.id,
      ESTADOS_FLUXO.PRONTO_PARA_DECISAO
    )

    return res.json({
      success: true,
      message:
        'Paciente movido para PRONTO_PARA_DECISAO'
    })

  } catch (e) {

    console.error(
      '❌ moverParaProntoDecisao:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao atualizar status'
      })
  }
}

async function listarFila(
  req,
  res
) {

  try {

    const fila =
      await db.getFilaValida()

    const atendimentos =
      fila.map(a =>
        formatarAtendimento(
          a,
          false
        )
      )

    return res.json({

      total:
        atendimentos.length,

      atendimentos
    })

  } catch (e) {

    console.error(
      '❌ listarFila:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao listar fila'
      })
  }
}

async function listarAtendimentos(
  req,
  res
) {

  try {

    const atendimentos =
      await db.getAtendimentos()

    const formatados =
      atendimentos.map(a =>
        formatarAtendimento(
          a,
          true
        )
      )

    return res.json(
      formatados
    )

  } catch (e) {

    console.error(
      '❌ listarAtendimentos:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao listar atendimentos'
      })
  }
}

async function buscarAtendimento(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    return res.json(
      formatarAtendimento(
        at,
        false
      )
    )

  } catch (e) {

    console.error(
      '❌ buscarAtendimento:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao buscar atendimento'
      })
  }
}

async function estatisticas(
  req,
  res
) {

  try {

    const stats =
      await db.getEstatisticas()

    return res.json(
      stats
    )

  } catch (e) {

    console.error(
      '❌ estatisticas:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao carregar estatísticas'
      })
  }
}

async function pegarProximo(
  req,
  res
) {

  try {

    const atendimentos =
      await db.getAtendimentos()

    const proximo =
      atendimentos.find(
        a =>
          a.pagamento &&
          a.status ===
            ESTADOS_FLUXO.FILA
      )

    if (!proximo) {

      return res.status(404)
        .json({
          error:
            'Nenhum paciente na fila'
        })
    }

    await db.atualizarStatus(
      proximo.id,
      ESTADOS_FLUXO.EM_ATENDIMENTO
    )

    return res.json({

      success: true,

      atendimento:
        formatarAtendimento(
          proximo,
          false
        )
    })

  } catch (e) {

    console.error(
      '❌ pegarProximo:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao pegar próximo atendimento'
      })
  }
}

module.exports = {
  iniciarAtendimento,
  moverParaProntoDecisao,
  listarFila,
  listarAtendimentos,
  buscarAtendimento,
  estatisticas,
  pegarProximo
}

const axios = require('axios')

const WHATSAPP_MODE =
  process.env.WHATSAPP_MODE ||
  'test'

const WEBHOOK_URL =
  process.env
    .N8N_WHATSAPP_WEBHOOK_URL

async function enviarWhatsAppOficial(
  telefone,
  mensagem,
  tipo = 'notificacao'
) {

  if (
    !telefone ||
    !mensagem
  ) {

    console.warn(
      '⚠️ WhatsApp payload inválido'
    )

    return false
  }

  const telefoneLimpo =
    String(telefone)
      .replace(/\D/g, '')

  setImmediate(async () => {

    try {

      if (!WEBHOOK_URL) {

        console.warn(
          '⚠️ N8N_WHATSAPP_WEBHOOK_URL não configurado'
        )

        return
      }

      await axios.post(

        WEBHOOK_URL,

        {
          telefone:
            telefoneLimpo,

          mensagem,

          tipo,

          timestamp:
            new Date()
              .toISOString(),

          mode:
            WHATSAPP_MODE
        },

        {
          timeout: 10000,

          headers: {
            'Content-Type':
              'application/json'
          }
        }
      )

      console.log(
        `✅ WhatsApp enviado: ${telefoneLimpo}`
      )

    } catch (error) {

      console.error(
        '❌ WhatsApp:',
        error.message
      )
    }
  })

  return true
}

module.exports = {
  enviarWhatsAppOficial
}

const db =
  require('../db-supabase-hybrid')

const {
  ESTADOS_FLUXO
} = require('../config')

const {
  safeDecrypt
} = require('../utils/crypto')

const {
  sanitizarHTML,
  decisaoSchema,
  revisaoSchema
} = require('../utils/validators')

const {
  enviarWhatsAppOficial
} = require('../services/whatsappService')

async function logDecisoes(
  req,
  res
) {

  try {

    const logs =
      await db.getDecisoesLog()

    return res.json(logs)

  } catch (e) {

    console.error(
      '❌ logDecisoes:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao carregar logs'
      })
  }
}

async function registrarDecisao(
  req,
  res
) {

  try {

    const { error } =
      decisaoSchema.validate(
        req.body
      )

    if (error) {

      return res.status(400)
        .json({
          error:
            error.details[0]
              .message
        })
    }

    const { id } =
      req.params

    const {
      decisao,
      orientacoes,
      medicamento,
      posologia,
      receita_memed_id,
      memed_payload
    } = req.body

    const at =
      await db.buscarAtendimentoPorId(
        id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const statusPermitidos = [
      ESTADOS_FLUXO.PRONTO_PARA_DECISAO,
      ESTADOS_FLUXO.EM_ATENDIMENTO,
      ESTADOS_FLUXO.APROVADO,
      ESTADOS_FLUXO.RECUSADO
    ]

    if (
      !statusPermitidos.includes(
        at.status
      )
    ) {

      return res.status(400)
        .json({
          error:
            `Status inválido: ${at.status}`
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const aprovacao =
      decisao === 'APROVAR' ||
      decisao ===
        ESTADOS_FLUXO.APROVADO

    const novoStatus =
      aprovacao
        ? ESTADOS_FLUXO.APROVADO
        : ESTADOS_FLUXO.RECUSADO

    const medicamentoFinal =
      medicamento ||
      dadosClinicos
        .medicacao_em_uso ||
      null

    const posologiaFinal =
      posologia ||
      dadosClinicos
        .posologia_atual ||
      null

    const decisaoData = {

      status:
        novoStatus,

      data:
        new Date()
          .toISOString(),

      medico:
        req.usuario?.role ||
        'medico',

      observacao:
        orientacoes
          ? sanitizarHTML(
              orientacoes
            )
          : '',

      medicamento_prescrito:
        medicamentoFinal
          ? sanitizarHTML(
              medicamentoFinal
            )
          : null,

      posologia:
        posologiaFinal,

      receita_memed_id:
        receita_memed_id ||
        null,

      memed_payload:
        memed_payload ||
        null
    }

    await db.atualizarStatus(
      id,
      novoStatus,
      decisaoData
    )

    await db.salvarDecisaoLog({

      atendimento_id:
        id,

      medico:
        req.usuario?.role ||
        'medico',

      decisao:
        novoStatus,

      medicamento:
        medicamentoFinal,

      posologia:
        posologiaFinal,

      observacao:
        decisaoData.observacao,

      dados_clinicos:
        dadosClinicos
    })

    const telefone =
      safeDecrypt(
        at.paciente_telefone
      )

    const nome =
      safeDecrypt(
        at.paciente_nome
      )

    if (telefone) {

      const mensagem =
        novoStatus ===
        ESTADOS_FLUXO.APROVADO

          ? `✅ Olá ${nome}, sua receita foi aprovada com sucesso!`

          : `❌ Olá ${nome}, sua solicitação não foi aprovada.\n\nMotivo: ${orientacoes || 'Análise médica'}`

      enviarWhatsAppOficial(
        telefone,
        mensagem
      ).catch(console.error)
    }

    return res.json({

      success: true,

      status:
        novoStatus
    })

  } catch (e) {

    console.error(
      '❌ registrarDecisao:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao registrar decisão'
      })
  }
}

async function revisarDecisao(
  req,
  res
) {

  try {

    const { error } =
      revisaoSchema.validate(
        req.body
      )

    if (error) {

      return res.status(400)
        .json({
          error:
            error.details[0]
              .message
        })
    }

    const { id } =
      req.params

    const {
      novaDecisao,
      motivoRevisao,
      observacao,
      medicamento,
      posologia
    } = req.body

    const at =
      await db.buscarAtendimentoPorId(
        id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    if (
      at.status !==
        ESTADOS_FLUXO.APROVADO &&
      at.status !==
        ESTADOS_FLUXO.RECUSADO
    ) {

      return res.status(400)
        .json({
          error:
            `Status inválido: ${at.status}`
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const statusAnterior =
      at.status

    const aprovacao =
      novaDecisao ===
        'APROVAR' ||
      novaDecisao ===
        ESTADOS_FLUXO.APROVADO

    const novoStatus =
      aprovacao
        ? ESTADOS_FLUXO.APROVADO
        : ESTADOS_FLUXO.RECUSADO

    const medicamentoFinal =
      medicamento ||
      dadosClinicos
        .medicacao_em_uso ||
      null

    const posologiaFinal =
      posologia ||
      dadosClinicos
        .posologia_atual ||
      'Uso conforme orientação médica'

    const decisaoData = {

      status:
        novoStatus,

      data:
        new Date()
          .toISOString(),

      medico:
        req.usuario?.role ||
        'medico',

      observacao:
        observacao
          ? sanitizarHTML(
              observacao
            )
          : sanitizarHTML(
              motivoRevisao ||
              'Revisão médica'
            ),

      medicamento_prescrito:
        medicamentoFinal,

      posologia:
        posologiaFinal
    }

    await db.atualizarStatus(
      id,
      novoStatus,
      decisaoData
    )

    await db.salvarDecisaoLog({

      atendimento_id:
        id,

      medico:
        req.usuario?.role ||
        'medico',

      decisao:
        aprovacao
          ? 'REVISAO_APROVAR'
          : 'REVISAO_RECUSAR',

      medicamento:
        medicamentoFinal,

      posologia:
        posologiaFinal,

      observacao:
        `Revisão de ${statusAnterior} para ${novoStatus}. Motivo: ${motivoRevisao || 'Reanálise médica'}`,

      dados_clinicos:
        dadosClinicos
    })

    const telefone =
      safeDecrypt(
        at.paciente_telefone
      )

    const nome =
      safeDecrypt(
        at.paciente_nome
      )

    if (telefone) {

      const mensagem =
`🔄 REVISÃO MÉDICA

Olá ${nome}.

Status anterior: ${statusAnterior}
Novo status: ${novoStatus}

📝 Motivo:
${motivoRevisao || 'Reanálise médica'}

👨‍⚕️ Doctor Prescreve`

      enviarWhatsAppOficial(
        telefone,
        mensagem
      ).catch(console.error)
    }

    return res.json({

      success: true,

      atendimentoId:
        id,

      status_anterior:
        statusAnterior,

      status_novo:
        novoStatus,

      notificacao_enviada:
        !!telefone
    })

  } catch (e) {

    console.error(
      '❌ revisarDecisao:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao revisar decisão'
      })
  }
}

async function estatisticasDecisoes(
  req,
  res
) {

  try {

    const logs =
      await db.getDecisoesLog()

    const aprovados =
      logs.filter(
        l =>
          l.decisao ===
            'APROVADO' ||
          l.decisao ===
            'APROVAR'
      )

    const recusados =
      logs.filter(
        l =>
          l.decisao ===
            'RECUSADO' ||
          l.decisao ===
            'RECUSAR'
      )

    return res.json({

      total_decisoes:
        logs.length,

      aprovados: {

        total:
          aprovados.length,

        percentual:
          logs.length > 0
            ? (
                aprovados.length /
                logs.length *
                100
              ).toFixed(2)
            : 0
      },

      recusados: {

        total:
          recusados.length,

        percentual:
          logs.length > 0
            ? (
                recusados.length /
                logs.length *
                100
              ).toFixed(2)
            : 0
      }
    })

  } catch (e) {

    console.error(
      '❌ estatisticasDecisoes:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao carregar estatísticas'
      })
  }
}

module.exports = {
  logDecisoes,
  registrarDecisao,
  revisarDecisao,
  estatisticasDecisoes
}

// ========================
// 🧠 ROTAS DE TRIAGEM
// ========================

const express = require('express')
const router = express.Router()
const { triagem } = require('../controllers/triagemController')

// POST /api/webhook/triagem - Receber triagem do paciente
router.post('/webhook/triagem', triagem)

module.exports = router

const express =
  require('express')

const router =
  express.Router()

const {
  criarPagamento,
  statusPagamento,
  webhookStripe
} = require(
  '../controllers/paymentController'
)

router.get(
  '/payment/:id',
  criarPagamento
)

router.get(
  '/payment/status/:id',
  statusPagamento
)

module.exports = router

// ========================
// 📋 ROTAS DE ATENDIMENTOS (FILA, STATUS, LISTAGENS)
// ========================

const express = require('express')
const router = express.Router()
const { auth } = require('../middlewares/auth')
const {
  iniciarAtendimento,
  moverParaProntoDecisao,
  listarFila,
  listarAtendimentos,
  buscarAtendimento,
  estatisticas,
  pegarProximo
} = require('../controllers/atendimentoController')

// Todas as rotas abaixo exigem autenticação
router.use(auth)

// POST /api/atendimento/:id/iniciar - Iniciar atendimento (FILA → EM_ATENDIMENTO)
router.post('/atendimento/:id/iniciar', iniciarAtendimento)

// POST /api/atendimento/:id/pronto-decisao - Mover para pronto decisão
router.post('/atendimento/:id/pronto-decisao', moverParaProntoDecisao)

// GET /api/fila - Listar fila válida
router.get('/fila', listarFila)

// GET /api/atendimentos - Listar todos os atendimentos (com mascaramento)
router.get('/atendimentos', listarAtendimentos)

// GET /api/atendimento/:id - Buscar atendimento específico
router.get('/atendimento/:id', buscarAtendimento)

// GET /api/estatisticas - Estatísticas gerais
router.get('/estatisticas', estatisticas)

// POST /api/fila/pegar-proximo - Pegar próximo paciente da fila
router.post('/fila/pegar-proximo', pegarProximo)

module.exports = router

// ========================
// 📄 ROTAS DE RECEITAS MÉDICAS
// ========================

const express = require('express')
const router = express.Router()
const { auth } = require('../middlewares/auth')
const {
  criarReceita,
  buscarReceita,
  gerarPDFReceita,
  emitirReceita,
  enviarWhatsAppReceita,
  gerarSignedUrl,
  validarReceita,
  listarReceitasPaciente,
  cancelarReceita,
  renovarReceita
} = require('../controllers/receitaController')

// Rota pública (QR Code) - NÃO requer autenticação
router.get('/receita/:id/validar', validarReceita)

// Rotas protegidas (requerem autenticação)
router.use(auth)

// POST /api/receita - Criar nova receita
router.post('/receita', criarReceita)

// GET /api/receita/:id - Buscar receita por ID
router.get('/receita/:id', buscarReceita)

// GET /api/receita/:id/pdf - Gerar PDF da receita
router.get('/receita/:id/pdf', gerarPDFReceita)

// POST /api/receita/:id/emitir - Emitir PDF e salvar no storage
router.post('/receita/:id/emitir', emitirReceita)

// POST /api/receita/:id/enviar-whatsapp - Enviar receita por WhatsApp
router.post('/receita/:id/enviar-whatsapp', enviarWhatsAppReceita)

// GET /api/receita/:id/signed - Gerar signed URL segura
router.get('/receita/:id/signed', gerarSignedUrl)

// GET /api/receitas/paciente/:atendimentoId - Listar receitas do paciente
router.get('/receitas/paciente/:atendimentoId', listarReceitasPaciente)

// POST /api/receita/:id/cancelar - Cancelar receita
router.post('/receita/:id/cancelar', cancelarReceita)

// POST /api/receita/:id/renovar - Renovar receita
router.post('/receita/:id/renovar', renovarReceita)

module.exports = router

// ========================
// 👨‍⚕️ ROTAS DE DECISÕES MÉDICAS
// ========================

const express = require('express')
const router = express.Router()
const { auth } = require('../middlewares/auth')
const {
  logDecisoes,
  registrarDecisao,
  revisarDecisao,
  estatisticasDecisoes
} = require('../controllers/decisaoController')

// Todas as rotas abaixo exigem autenticação
router.use(auth)

// GET /api/decisoes/log - Histórico de decisões
router.get('/decisoes/log', logDecisoes)

// POST /api/decisao/:id - Registrar decisão (aprovar/recusar)
router.post('/decisao/:id', registrarDecisao)

// PUT /api/decisao/:id/revisar - Revisar decisão anterior
router.put('/decisao/:id/revisar', revisarDecisao)

// GET /api/estatisticas/decisoes - Estatísticas de decisões
router.get('/estatisticas/decisoes', estatisticasDecisoes)

module.exports = router

// ========================
// 📋 ROTAS DE PRONTUÁRIO
// ========================

const express = require('express')
const router = express.Router()
const { auth } = require('../middlewares/auth')
const {
  getProntuario,
  getProntuarioResumido,
  getProntuarioPDF,
  exportProntuario
} = require('../controllers/prontuarioController')

// Todas as rotas abaixo exigem autenticação
router.use(auth)

// GET /api/prontuario/:id - Buscar prontuário completo
router.get('/prontuario/:id', getProntuario)

// GET /api/prontuario/:id/resumido - Buscar prontuário resumido
router.get('/prontuario/:id/resumido', getProntuarioResumido)

// GET /api/prontuario/:id/pdf - Gerar PDF do prontuário
router.get('/prontuario/:id/pdf', getProntuarioPDF)

// GET /api/prontuario/:id/export - Exportar prontuário em JSON
router.get('/prontuario/:id/export', exportProntuario)

module.exports = router

// ========================
// 🔐 ROTAS DO MEMED (INTEGRAÇÃO)
// ========================

const express = require('express')
const router = express.Router()
const { auth } = require('../middlewares/auth')
const {
  getTokenMemed,
  getStatusMemed,
  criarPrescricaoMemed,
  salvarReceitaMemed
} = require('../controllers/memedController')

// Todas as rotas abaixo exigem autenticação
router.use(auth)

// GET /api/memed/token - Obter token para frontend
router.get('/memed/token', getTokenMemed)

// GET /api/memed/status - Verificar status da conta Memed
router.get('/memed/status', getStatusMemed)

// POST /api/memed/prescricao - Criar prescrição no Memed
router.post('/memed/prescricao', criarPrescricaoMemed)

// POST /api/memed/receita - Salvar receita do Memed
router.post('/memed/receita', salvarReceitaMemed)

module.exports = router

// ========================
// 🎧 ROTAS DE SUPORTE
// ========================

const express = require('express')
const router = express.Router()
const { auth } = require('../middlewares/auth')
const {
  adicionarFilaSuporte,
  listarFilaSuporte,
  responderSuporte,
  listarPendentes,
  atenderChamado
} = require('../controllers/suporteController')

// Rota pública (paciente pode adicionar à fila sem auth)
router.post('/suporte/fila', adicionarFilaSuporte)

// Rotas protegidas (requerem autenticação)
router.use(auth)

// GET /api/suporte/fila - Listar fila de suporte
router.get('/suporte/fila', listarFilaSuporte)

// POST /api/suporte/fila/:id/responder - Responder paciente da fila
router.post('/suporte/fila/:id/responder', responderSuporte)

// GET /api/suporte/pendentes - Listar chamados pendentes
router.get('/suporte/pendentes', listarPendentes)

// POST /api/suporte/atender/:id - Atender chamado
router.post('/suporte/atender/:id', atenderChamado)

module.exports = router

const express =
  require('express')

const router =
  express.Router()

const expressRaw =
  express.raw({
    type:
      'application/json'
  })

const {
  webhookStripe
} = require(
  '../controllers/paymentController'
)

const {
  webhookMemed
} = require(
  '../controllers/memedController'
)

const {
  webhookAtualizarStatus
} = require(
  '../controllers/webhookController'
)

const {
  webhookAuth
} = require(
  '../middlewares/auth'
)

router.post(
  '/webhook/stripe',
  expressRaw,
  webhookStripe
)

router.post(
  '/webhooks/memed',
  express.json(),
  webhookMemed
)

router.post(
  '/api/webhook/atualizar-status',
  webhookAuth,
  webhookAtualizarStatus
)

router.post(
  '/api/webhook/receita',
  webhookAuth,
  webhookMemed
)

module.exports = router

// ========================
// 📦 CENTRALIZADOR DE ROTAS
// ========================

const express = require('express')
const router = express.Router()

// Importar todas as rotas
const triagemRoutes = require('./triagemRoutes')
const paymentRoutes = require('./paymentRoutes')
const atendimentoRoutes = require('./atendimentoRoutes')
const decisaoRoutes = require('./decisaoRoutes')
const receitaRoutes = require('./receitaRoutes')
const prontuarioRoutes = require('./prontuarioRoutes')
const memedRoutes = require('./memedRoutes')
const suporteRoutes = require('./suporteRoutes')
const webhookRoutes = require('./webhookRoutes')

// Registrar todas as rotas
router.use(triagemRoutes)
router.use(paymentRoutes)
router.use(atendimentoRoutes)
router.use(decisaoRoutes)
router.use(receitaRoutes)
router.use(prontuarioRoutes)
router.use(memedRoutes)
router.use(suporteRoutes)
router.use(webhookRoutes)

module.exports = router

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const PDFDocument = require('pdfkit')
const QRCode = require('qrcode')

const db = require('../db-supabase-hybrid')

const {
  BASE_URL,
  DB_DIR,
  ESTADOS_FLUXO
} = require('../config')

const {
  safeDecrypt
} = require('../utils/crypto')

const {
  sanitizarHTML
} = require('../utils/validators')

const {
  normalizarMedicamentosReceita
} = require('../services/clinicalEngine')

const {
  enviarWhatsAppOficial
} = require('../services/whatsappService')

async function criarReceita(
  req,
  res
) {

  try {

    const payload =
      req.body || {}

    const atendimentoId =
      payload.atendimentoId ||
      payload.id

    if (!atendimentoId) {

      return res.status(400)
        .json({
          error:
            'atendimentoId obrigatório'
        })
    }

    const at =
      await db.buscarAtendimentoPorId(
        atendimentoId
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const decisao =
      at.decisao || {}

    const medicamentoFinal =
      payload.medicamento ||
      decisao
        .medicamento_prescrito ||
      dadosClinicos
        .medicacao_em_uso

    if (!medicamentoFinal) {

      return res.status(400)
        .json({
          error:
            'Medicamento não definido'
        })
    }

    const receita = {

      id:
        uuidv4(),

      numero:
        `REC-${Date.now()}`,

      atendimentoId,

      paciente: {

        nome:
          safeDecrypt(
            at.paciente_nome
          ),

        cpf:
          safeDecrypt(
            at.paciente_cpf
          )
      },

      medicamentos: [

        {
          nome:
            sanitizarHTML(
              medicamentoFinal
            ),

          posologia:
            sanitizarHTML(
              payload.posologia ||
              decisao.posologia ||
              dadosClinicos.posologia_atual ||
              'Uso conforme orientação médica'
            ),

          quantidade:
            payload.quantidade ||
            30,

          duracao:
            payload.duracao ||
            '30 dias'
        }
      ],

      observacoes:
        sanitizarHTML(
          payload.observacoes ||
          ''
        ),

      medico: {

        nome:
          process.env.MEDICO_NOME ||
          'Dr. Plantonista',

        registro:
          `${process.env.MEDICO_CONSELHO || 'CRM'} ${process.env.MEDICO_NUMERO || '00000'}`,

        especialidade:
          process.env.MEDICO_ESPECIALIDADE ||
          'Clínica Geral'
      },

      data_emissao:
        new Date()
          .toISOString(),

      data_validade:
        new Date(
          Date.now() +
          (
            parseInt(
              process.env.RECEITA_VALIDADE_DIAS
            ) || 90
          ) *
          86400000
        ).toISOString(),

      assinatura_digital:
        crypto
          .createHash('sha256')
          .update(
            atendimentoId +
            Date.now()
          )
          .digest('hex'),

      status:
        'ATIVA',

      created_at:
        new Date()
          .toISOString()
    }

    await db.salvarReceita(
      receita
    )

    if (
      at.status ===
      ESTADOS_FLUXO.APROVADO
    ) {

      await db.atualizarStatus(
        atendimentoId,
        ESTADOS_FLUXO.RECEITA_EMITIDA
      )
    }

    return res.json({

      success: true,

      receita,

      links: {

        pdf:
          `${BASE_URL}/api/receita/${receita.id}/pdf`,

        validar:
          `${BASE_URL}/api/receita/${receita.id}/validar`
      }
    })

  } catch (e) {

    console.error(
      '❌ criarReceita:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao criar receita'
      })
  }
}

async function buscarReceita(
  req,
  res
) {

  try {

    const receita =
      await db.buscarReceitaPorId(
        req.params.id
      )

    if (!receita) {

      return res.status(404)
        .json({
          error:
            'Receita não encontrada'
        })
    }

    return res.json(
      receita
    )

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao buscar receita'
      })
  }
}

async function gerarPDFReceita(
  req,
  res
) {

  try {

    const receita =
      await db.buscarReceitaPorId(
        req.params.id
      )

    if (!receita) {

      return res.status(404)
        .json({
          error:
            'Receita não encontrada'
        })
    }

    const atendimento =
      await db.buscarAtendimentoPorId(
        receita.atendimentoId
      ).catch(() => null)

    const medicamentos =
      normalizarMedicamentosReceita(
        receita,
        atendimento
      )

    res.setHeader(
      'Content-Type',
      'application/pdf'
    )

    const doc =
      new PDFDocument({
        margin: 50,
        size: 'A4'
      })

    doc.pipe(res)

    doc.fontSize(20)
      .text(
        'DOCTOR PRESCREVE',
        {
          align:
            'center'
        }
      )

    doc.moveDown()

    doc.fontSize(16)
      .text(
        'RECEITA MÉDICA',
        {
          align:
            'center'
        }
      )

    doc.moveDown()

    doc.fontSize(10)
      .text(
        `Número: ${receita.numero}`
      )

    doc.text(
      `Data: ${new Date(receita.data_emissao).toLocaleDateString('pt-BR')}`
    )

    doc.moveDown()

    doc.fontSize(12)
      .text(
        `Paciente: ${receita.paciente?.nome || 'N/A'}`
      )

    doc.text(
      `CPF: ${receita.paciente?.cpf || 'N/A'}`
    )

    doc.moveDown()

    medicamentos.forEach(
      (med, index) => {

        doc.fontSize(11)
          .text(
            `${index + 1}. ${med.nome}`
          )

        doc.fontSize(10)
          .text(
            `Posologia: ${med.posologia}`
          )

        doc.text(
          `Quantidade: ${med.quantidade}`
        )

        doc.moveDown()
      }
    )

    if (
      receita.observacoes
    ) {

      doc.moveDown()

      doc.fontSize(11)
        .text(
          'Observações'
        )

      doc.fontSize(10)
        .text(
          receita.observacoes
        )
    }

    try {

      const qr =
        await QRCode.toBuffer(
          `${BASE_URL}/api/receita/${receita.id}/validar`
        )

      doc.image(
        qr,
        450,
        650,
        {
          width: 80
        }
      )

    } catch (e) {

      console.warn(
        '⚠️ QRCode:',
        e.message
      )
    }

    doc.end()

  } catch (e) {

    console.error(
      '❌ gerarPDFReceita:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao gerar PDF'
      })
  }
}

async function emitirReceita(
  req,
  res
) {

  try {

    const receita =
      await db.buscarReceitaPorId(
        req.params.id
      )

    if (!receita) {

      return res.status(404)
        .json({
          error:
            'Receita não encontrada'
        })
    }

    return res.json({

      success: true,

      pdf_url:
        `${BASE_URL}/api/receita/${receita.id}/pdf`
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao emitir receita'
      })
  }
}

async function enviarWhatsAppReceita(
  req,
  res
) {

  try {

    const receita =
      await db.buscarReceitaPorId(
        req.params.id
      )

    if (!receita) {

      return res.status(404)
        .json({
          error:
            'Receita não encontrada'
        })
    }

    const at =
      await db.buscarAtendimentoPorId(
        receita.atendimentoId
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const telefone =
      safeDecrypt(
        at.paciente_telefone
      )

    const nome =
      safeDecrypt(
        at.paciente_nome
      )

    if (!telefone) {

      return res.status(400)
        .json({
          error:
            'Paciente sem telefone'
        })
    }

    const url =
      `${BASE_URL}/api/receita/${receita.id}/pdf`

    const mensagem =
`📄 Receita Médica

Olá ${nome}!

Sua receita está disponível:

${url}

👨‍⚕️ Doctor Prescreve`

    await enviarWhatsAppOficial(
      telefone,
      mensagem
    )

    return res.json({

      success: true,

      enviado: true
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao enviar receita'
      })
  }
}

async function gerarSignedUrl(
  req,
  res
) {

  try {

    return res.json({

      url:
        `${BASE_URL}/api/receita/${req.params.id}/pdf`
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao gerar signed url'
      })
  }
}

async function validarReceita(
  req,
  res
) {

  try {

    const receita =
      await db.buscarReceitaPorId(
        req.params.id
      )

    if (!receita) {

      return res.status(404)
        .json({
          valido: false
        })
    }

    const valida =
      receita.status ===
      'ATIVA'

    return res.json({

      valido:
        valida,

      numero:
        receita.numero,

      emissao:
        receita.data_emissao,

      validade:
        receita.data_validade
    })

  } catch (e) {

    return res.status(500)
      .json({
        valido: false
      })
  }
}

async function listarReceitasPaciente(
  req,
  res
) {

  try {

    const receitas =
      await db.listarReceitasPorAtendimento(
        req.params.atendimentoId
      )

    return res.json({

      total:
        receitas.length,

      receitas
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao listar receitas'
      })
  }
}

async function cancelarReceita(
  req,
  res
) {

  try {

    await db.atualizarStatusReceita(
      req.params.id,
      'CANCELADA'
    )

    return res.json({

      success: true
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao cancelar receita'
      })
  }
}

async function renovarReceita(
  req,
  res
) {

  try {

    const receita =
      await db.buscarReceitaPorId(
        req.params.id
      )

    if (!receita) {

      return res.status(404)
        .json({
          error:
            'Receita não encontrada'
        })
    }

    const novaReceita = {
      ...receita,
      id: uuidv4(),
      numero:
        `REC-${Date.now()}`,
      data_emissao:
        new Date()
          .toISOString()
    }

    await db.salvarReceita(
      novaReceita
    )

    return res.json({

      success: true,

      receita:
        novaReceita
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao renovar receita'
      })
  }
}

module.exports = {
  criarReceita,
  buscarReceita,
  gerarPDFReceita,
  emitirReceita,
  enviarWhatsAppReceita,
  gerarSignedUrl,
  validarReceita,
  listarReceitasPaciente,
  cancelarReceita,
  renovarReceita
}

// ========================
// 📋 CONTROLLER DE PRONTUÁRIO
// ========================

const db = require('../db-supabase-hybrid')
const { safeDecrypt } = require('../utils/crypto')
const {
  detectarTipo,
  gerarQueixa,
  gerarHistoria,
  gerarExameFisico,
  gerarConduta,
  gerarRecomendacoes
} = require('../services/clinicalEngine')

// ========================
// 📄 BUSCAR PRONTUÁRIO COMPLETO
// ========================
async function getProntuario(req, res) {
  try {
    const at = await db.buscarAtendimentoPorId(req.params.id)
    if (!at) {
      return res.status(404).json({ error: 'Atendimento não encontrado' })
    }

    const dadosClinicos = at.dados_clinicos || at.triagem || {}
    const tipo = dadosClinicos.tipo || detectarTipo(dadosClinicos.doenca || '')
    const decisao = at.decisao || {}

    const dadosPaciente = {
      nome: safeDecrypt(at.paciente_nome),
      cpf: safeDecrypt(at.paciente_cpf),
      telefone: safeDecrypt(at.paciente_telefone),
      email: safeDecrypt(at.paciente_email)
    }

    const prontuario = {
      queixa: gerarQueixa(tipo),
      historia: gerarHistoria(tipo),
      exame_fisico: gerarExameFisico(tipo),
      conduta: gerarConduta(tipo),
      medicacao: decisao.medicamento_prescrito || dadosClinicos.medicacao_em_uso || 'Não definida',
      posologia: decisao.posologia || dadosClinicos.posologia_atual || 'Não definida',
      recomendacoes: gerarRecomendacoes(tipo),
      data_atendimento: new Date().toISOString(),
      validade_receita: new Date(Date.now() + (parseInt(process.env.RECEITA_VALIDADE_DIAS) || 90) * 24 * 60 * 60 * 1000).toISOString()
    }

    res.json({
      paciente: dadosPaciente,
      dados_clinicos: dadosClinicos,
      prontuario: prontuario,
      decisao_medica: decisao,
      atendimento: {
        id: at.id,
        status: at.status,
        criado_em: at.criado_em,
        pago_em: at.pago_em
      }
    })
  } catch (e) {
    console.error('❌ Erro ao gerar prontuário:', e.message)
    res.status(500).json({ error: 'Erro ao gerar prontuário' })
  }
}

// ========================
:// PRONTUÁRIO RESUMIDO
// ========================
async function getProntuarioResumido(req, res) {
  try {
    const at = await db.buscarAtendimentoPorId(req.params.id)
    if (!at) {
      return res.status(404).json({ error: 'Atendimento não encontrado' })
    }

    const dadosClinicos = at.dados_clinicos || at.triagem || {}
    const decisao = at.decisao || {}

    res.json({
      paciente: safeDecrypt(at.paciente_nome),
      doenca: dadosClinicos.doenca || 'Não especificada',
      medicacao: decisao.medicamento_prescrito || dadosClinicos.medicacao_em_uso || 'Não definida',
      posologia: decisao.posologia || dadosClinicos.posologia_atual || 'Não definida',
      conduta_resumida: gerarConduta(dadosClinicos.tipo || 'OUTRO'),
      proximo_retorno: "3 meses"
    })
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar resumo' })
  }
}

// ========================
// 📄 PRONTUÁRIO PDF (HTML)
// ========================
async function getProntuarioPDF(req, res) {
  try {
    const at = await db.buscarAtendimentoPorId(req.params.id)
    if (!at) {
      return res.status(404).json({ error: 'Atendimento não encontrado' })
    }

    const dadosClinicos = at.dados_clinicos || at.triagem || {}
    const tipo = dadosClinicos.tipo || detectarTipo(dadosClinicos.doenca || '')
    const decisao = at.decisao || {}

    const prontuario = {
      paciente_nome: safeDecrypt(at.paciente_nome),
      paciente_cpf: safeDecrypt(at.paciente_cpf),
      queixa: gerarQueixa(tipo),
      historia: gerarHistoria(tipo),
      exame_fisico: gerarExameFisico(tipo),
      conduta: gerarConduta(tipo),
      medicacao: decisao.medicamento_prescrito || dadosClinicos.medicacao_em_uso || 'Não definida',
      posologia: decisao.posologia || dadosClinicos.posologia_atual || 'Não definida',
      recomendacoes: gerarRecomendacoes(tipo)
    }

    const html = `<!DOCTYPE html>
    <html><head><meta charset="UTF-8"><title>Prontuário - ${prontuario.paciente_nome}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 40px; }
      .header { text-align: center; margin-bottom: 30px; }
      .title { color: #1a6b8a; }
      .section { margin-bottom: 20px; }
      .section-title { background: #f0f2f5; padding: 8px; font-weight: bold; }
      .content { padding: 10px; }
      .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
    </style></head><body>
      <div class="header"><h1 class="title">Doctor Prescreve</h1><h3>Prontuário Médico</h3><p>Data: ${new Date().toLocaleDateString('pt-BR')}</p></div>
      <div class="section"><div class="section-title">Dados do Paciente</div><div class="content"><strong>Nome:</strong> ${prontuario.paciente_nome}<br><strong>CPF:</strong> ${prontuario.paciente_cpf || 'Não informado'}</div></div>
      <div class="section"><div class="section-title">Queixa Principal</div><div class="content">${prontuario.queixa}</div></div>
      <div class="section"><div class="section-title">História Clínica</div><div class="content">${prontuario.historia}</div></div>
      <div class="section"><div class="section-title">Exame Físico</div><div class="content">${prontuario.exame_fisico}</div></div>
      <div class="section"><div class="section-title">Conduta e Prescrição</div><div class="content"><strong>Medicação:</strong> ${prontuario.medicacao}<br><strong>Posologia:</strong> ${prontuario.posologia}<br><strong>Conduta:</strong> ${prontuario.conduta}</div></div>
      <div class="section"><div class="section-title">Recomendações</div><div class="content">${prontuario.recomendacoes.replace(/\n/g, '<br>')}</div></div>
      <div class="footer"><p>Documento gerado eletronicamente - Válido em todo território nacional</p><p>Doctor Prescreve - Telemedicina com responsabilidade</p></div>
    </body></html>`

    res.setHeader('Content-Type', 'text/html')
    res.send(html)
  } catch (e) {
    res.status(500).json({ error: 'Erro ao gerar PDF do prontuário' })
  }
}

// ========================
:// EXPORTAR PRONTUÁRIO JSON
// ========================
async function exportProntuario(req, res) {
  try {
    const at = await db.buscarAtendimentoPorId(req.params.id)
    if (!at) {
      return res.status(404).json({ error: 'Atendimento não encontrado' })
    }

    const dadosClinicos = at.dados_clinicos || at.triagem || {}
    const tipo = dadosClinicos.tipo || detectarTipo(dadosClinicos.doenca || '')
    const decisao = at.decisao || {}

    res.json({
      metadata: { id: at.id, exportado_em: new Date().toISOString(), versao: "4.0", sistema: "Doctor Prescreve" },
      paciente: {
        nome: safeDecrypt(at.paciente_nome),
        cpf: safeDecrypt(at.paciente_cpf),
        telefone: safeDecrypt(at.paciente_telefone),
        email: safeDecrypt(at.paciente_email)
      },
      clinico: {
        condicao: dadosClinicos.doenca,
        tipo: tipo,
        medicacao_em_uso: dadosClinicos.medicacao_em_uso,
        queixa: gerarQueixa(tipo),
        historia: gerarHistoria(tipo),
        exame_fisico: gerarExameFisico(tipo),
        conduta: gerarConduta(tipo),
        medicacao_prescrita: decisao.medicamento_prescrito || dadosClinicos.medicacao_em_uso,
        posologia: decisao.posologia || dadosClinicos.posologia_atual,
        recomendacoes: gerarRecomendacoes(tipo)
      },
      decisao_medica: decisao,
      status: at.status,
      datas: { criacao: at.criado_em, pagamento: at.pago_em }
    })
  } catch (e) {
    res.status(500).json({ error: 'Erro ao exportar prontuário' })
  }
}

// ========================
// 📦 EXPORTS
// ========================
module.exports = {
  getProntuario,
  getProntuarioResumido,
  getProntuarioPDF,
  exportProntuario
}

const db =
  require('../db-supabase-hybrid')

const {
  safeDecrypt
} = require('../utils/crypto')

const {
  detectarTipo,
  gerarQueixa,
  gerarHistoria,
  gerarExameFisico,
  gerarConduta,
  gerarRecomendacoes
} = require('../services/clinicalEngine')

async function getProntuario(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const tipo =
      dadosClinicos.tipo ||
      detectarTipo(
        dadosClinicos.doenca ||
        ''
      )

    const decisao =
      at.decisao || {}

    return res.json({

      paciente: {

        nome:
          safeDecrypt(
            at.paciente_nome
          ),

        cpf:
          safeDecrypt(
            at.paciente_cpf
          ),

        telefone:
          safeDecrypt(
            at.paciente_telefone
          ),

        email:
          safeDecrypt(
            at.paciente_email
          )
      },

      dados_clinicos:
        dadosClinicos,

      prontuario: {

        queixa:
          gerarQueixa(
            tipo
          ),

        historia:
          gerarHistoria(
            tipo
          ),

        exame_fisico:
          gerarExameFisico(
            tipo
          ),

        conduta:
          gerarConduta(
            tipo
          ),

        medicacao:
          decisao
            .medicamento_prescrito ||
          dadosClinicos
            .medicacao_em_uso ||
          'Não definida',

        posologia:
          decisao.posologia ||
          dadosClinicos
            .posologia_atual ||
          'Não definida',

        recomendacoes:
          gerarRecomendacoes(
            tipo
          ),

        data_atendimento:
          new Date()
            .toISOString()
      },

      decisao_medica:
        decisao,

      atendimento: {

        id:
          at.id,

        status:
          at.status,

        criado_em:
          at.criado_em,

        pago_em:
          at.pago_em
      }
    })

  } catch (e) {

    console.error(
      '❌ getProntuario:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao carregar prontuário'
      })
  }
}

async function getProntuarioResumido(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const decisao =
      at.decisao || {}

    return res.json({

      paciente:
        safeDecrypt(
          at.paciente_nome
        ),

      doenca:
        dadosClinicos.doenca ||
        'Não especificada',

      medicacao:
        decisao
          .medicamento_prescrito ||
        dadosClinicos
          .medicacao_em_uso ||
        'Não definida',

      posologia:
        decisao.posologia ||
        dadosClinicos
          .posologia_atual ||
        'Não definida',

      conduta:
        gerarConduta(
          dadosClinicos.tipo ||
          'OUTRO'
        )
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao gerar resumo'
      })
  }
}

async function getProntuarioPDF(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const tipo =
      dadosClinicos.tipo ||
      detectarTipo(
        dadosClinicos.doenca ||
        ''
      )

    const decisao =
      at.decisao || {}

    const html =
`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Prontuário Médico</title>

<style>

body{
  font-family:Arial;
  margin:40px;
}

h1{
  color:#1a6b8a;
}

.section{
  margin-bottom:20px;
}

.title{
  background:#f2f2f2;
  padding:8px;
  font-weight:bold;
}

.content{
  padding:10px;
}

</style>

</head>

<body>

<h1>Doctor Prescreve</h1>

<h3>Prontuário Médico</h3>

<div class="section">
<div class="title">Paciente</div>
<div class="content">

<strong>Nome:</strong>
${safeDecrypt(at.paciente_nome)}

<br>

<strong>CPF:</strong>
${safeDecrypt(at.paciente_cpf)}

</div>
</div>

<div class="section">
<div class="title">Queixa</div>
<div class="content">
${gerarQueixa(tipo)}
</div>
</div>

<div class="section">
<div class="title">História Clínica</div>
<div class="content">
${gerarHistoria(tipo)}
</div>
</div>

<div class="section">
<div class="title">Exame Físico</div>
<div class="content">
${gerarExameFisico(tipo)}
</div>
</div>

<div class="section">
<div class="title">Conduta</div>
<div class="content">

<strong>Medicação:</strong>
${decisao.medicamento_prescrito || dadosClinicos.medicacao_em_uso || 'Não definida'}

<br><br>

<strong>Posologia:</strong>
${decisao.posologia || dadosClinicos.posologia_atual || 'Não definida'}

<br><br>

<strong>Conduta:</strong>
${gerarConduta(tipo)}

</div>
</div>

<div class="section">
<div class="title">Recomendações</div>
<div class="content">
${gerarRecomendacoes(tipo).replace(/\n/g, '<br>')}
</div>
</div>

</body>
</html>
`

    res.setHeader(
      'Content-Type',
      'text/html'
    )

    return res.send(
      html
    )

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao gerar prontuário'
      })
  }
}

async function exportProntuario(
  req,
  res
) {

  try {

    const at =
      await db.buscarAtendimentoPorId(
        req.params.id
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const tipo =
      dadosClinicos.tipo ||
      detectarTipo(
        dadosClinicos.doenca ||
        ''
      )

    const decisao =
      at.decisao || {}

    return res.json({

      metadata: {

        id:
          at.id,

        exportado_em:
          new Date()
            .toISOString(),

        sistema:
          'Doctor Prescreve'
      },

      paciente: {

        nome:
          safeDecrypt(
            at.paciente_nome
          ),

        cpf:
          safeDecrypt(
            at.paciente_cpf
          ),

        telefone:
          safeDecrypt(
            at.paciente_telefone
          ),

        email:
          safeDecrypt(
            at.paciente_email
          )
      },

      clinico: {

        tipo,

        condicao:
          dadosClinicos.doenca,

        medicacao:
          dadosClinicos
            .medicacao_em_uso,

        queixa:
          gerarQueixa(
            tipo
          ),

        historia:
          gerarHistoria(
            tipo
          ),

        exame_fisico:
          gerarExameFisico(
            tipo
          ),

        conduta:
          gerarConduta(
            tipo
          ),

        recomendacoes:
          gerarRecomendacoes(
            tipo
          ),

        medicacao_prescrita:
          decisao
            .medicamento_prescrito,

        posologia:
          decisao.posologia
      },

      decisao_medica:
        decisao,

      status:
        at.status
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          'Erro ao exportar prontuário'
      })
  }
}

module.exports = {
  getProntuario,
  getProntuarioResumido,
  getProntuarioPDF,
  exportProntuario
}

const crypto =
  require('crypto')

const db =
  require('../db-supabase-hybrid')

const memed =
  require('../memed')

const {
  ESTADOS_FLUXO
} = require('../config')

const {
  safeDecrypt
} = require('../utils/crypto')

const {
  enviarWhatsAppOficial
} = require('../services/whatsappService')

async function getTokenMemed(
  req,
  res
) {

  try {

    if (
      !memed ||
      typeof memed
        .gerarTokenFrontend !==
      'function'
    ) {

      return res.json({
        token:
          crypto
            .randomBytes(32)
            .toString('hex'),

        fallback:
          true
      })
    }

    const token =
      await memed
        .gerarTokenFrontend()

    return res.json({
      token
    })

  } catch (e) {

    console.error(
      '❌ getTokenMemed:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao gerar token'
      })
  }
}

async function getStatusMemed(
  req,
  res
) {

  try {

    if (
      !memed ||
      typeof memed
        .verificarStatusConta !==
      'function'
    ) {

      return res.json({
        online: false,
        fallback: true
      })
    }

    const status =
      await memed
        .verificarStatusConta()

    return res.json(
      status
    )

  } catch (e) {

    return res.status(500)
      .json({
        error:
          e.message
      })
  }
}

async function criarPrescricaoMemed(
  req,
  res
) {

  try {

    const {
      atendimentoId,
      medicamento,
      posologia,
      observacao
    } = req.body

    if (!atendimentoId) {

      return res.status(400)
        .json({
          error:
            'atendimentoId obrigatório'
        })
    }

    const at =
      await db.buscarAtendimentoPorId(
        atendimentoId
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    const dadosClinicos =
      at.dados_clinicos ||
      at.triagem ||
      {}

    const decisao =
      at.decisao || {}

    const paciente = {

      paciente_nome:
        safeDecrypt(
          at.paciente_nome
        ),

      paciente_telefone:
        safeDecrypt(
          at.paciente_telefone
        ),

      paciente_cpf:
        safeDecrypt(
          at.paciente_cpf
        )
    }

    const medicamentoFinal =
      medicamento ||
      decisao
        .medicamento_prescrito ||
      dadosClinicos
        .medicacao_em_uso

    const posologiaFinal =
      posologia ||
      decisao.posologia ||
      dadosClinicos
        .posologia_atual ||
      'Uso conforme orientação médica'

    if (
      !medicamentoFinal
    ) {

      return res.status(400)
        .json({
          error:
            'Medicamento não definido'
        })
    }

    if (
      !memed ||
      typeof memed
        .gerarPrescricaoMemed !==
      'function'
    ) {

      return res.status(500)
        .json({
          error:
            'Integração Memed indisponível'
        })
    }

    const resultado =
      await memed
        .gerarPrescricaoMemed(
          paciente,
          medicamentoFinal,
          posologiaFinal,
          observacao
        )

    if (
      !resultado ||
      !resultado.success
    ) {

      return res.status(500)
        .json({
          error:
            resultado?.error ||
            'Erro ao gerar prescrição'
        })
    }

    await db.atualizarStatus(
      atendimentoId,
      ESTADOS_FLUXO.RECEITA_EMITIDA,
      {

        memed_prescription_id:
          resultado.prescriptionId,

        memed_pdf_url:
          resultado.pdfUrl,

        memed_payload:
          resultado.fullData ||
          null
      }
    )

    const telefone =
      paciente
        .paciente_telefone

    const nome =
      paciente
        .paciente_nome

    if (
      telefone &&
      resultado.pdfUrl
    ) {

      const mensagem =
`📄 Receita Digital

Olá ${nome}!

Sua receita foi emitida:

${resultado.pdfUrl}

👨‍⚕️ Doctor Prescreve`

      enviarWhatsAppOficial(
        telefone,
        mensagem
      ).catch(console.error)
    }

    return res.json({

      success: true,

      prescriptionId:
        resultado.prescriptionId,

      pdfUrl:
        resultado.pdfUrl
    })

  } catch (e) {

    console.error(
      '❌ criarPrescricaoMemed:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          e.message
      })
  }
}

async function salvarReceitaMemed(
  req,
  res
) {

  try {

    const {
      atendimentoId,
      memedData
    } = req.body

    if (
      !atendimentoId
    ) {

      return res.status(400)
        .json({
          error:
            'atendimentoId obrigatório'
        })
    }

    if (
      !memed ||
      typeof memed
        .salvarReceitaMemed !==
      'function'
    ) {

      return res.status(500)
        .json({
          error:
            'Memed indisponível'
        })
    }

    const receita =
      await memed
        .salvarReceitaMemed(
          atendimentoId,
          memedData
        )

    await db.atualizarStatus(
      atendimentoId,
      ESTADOS_FLUXO.RECEITA_EMITIDA,
      {

        memed_prescription_id:
          receita.prescriptionId,

        memed_pdf_url:
          receita.pdfUrl
      }
    )

    const at =
      await db.buscarAtendimentoPorId(
        atendimentoId
      )

    if (at) {

      const telefone =
        safeDecrypt(
          at.paciente_telefone
        )

      const nome =
        safeDecrypt(
          at.paciente_nome
        )

      if (
        telefone &&
        receita.pdfUrl
      ) {

        const mensagem =
`✅ Receita aprovada

Olá ${nome}!

${receita.pdfUrl}

👨‍⚕️ Doctor Prescreve`

        enviarWhatsAppOficial(
          telefone,
          mensagem
        ).catch(console.error)
      }
    }

    return res.json({

      success: true,

      receita
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          e.message
      })
  }
}

async function webhookMemed(
  req,
  res
) {

  try {

    const body =
      req.body || {}

    const signature =
      req.headers[
        'x-memed-signature'
      ]

    if (
      process.env
        .MEMED_WEBHOOK_SECRET
    ) {

      const expected =
        crypto
          .createHmac(
            'sha256',
            process.env
              .MEMED_WEBHOOK_SECRET
          )
          .update(
            JSON.stringify(
              body
            )
          )
          .digest('hex')

      if (
        signature !==
        expected
      ) {

        return res.status(401)
          .json({
            error:
              'Assinatura inválida'
          })
      }
    }

    const tipo =
      body.type ||
      body.event

    if (
      tipo ===
      'prescription.completed'
    ) {

      const data =
        body.data ||
        body.prescription ||
        {}

      const atendimentoId =
        data.patient_external_id

      const atendimento =
        await db.buscarAtendimentoPorId(
          atendimentoId
        )

      if (atendimento) {

        await db.atualizarStatus(
          atendimento.id,
          ESTADOS_FLUXO.RECEITA_EMITIDA,
          {

            memed_prescription_id:
              data.external_id,

            memed_pdf_url:
              data.pdf_url,

            receita_emitida_em:
              new Date()
                .toISOString()
          }
        )

        const telefone =
          safeDecrypt(
            atendimento.paciente_telefone
          )

        const nome =
          safeDecrypt(
            atendimento.paciente_nome
          )

        if (
          telefone &&
          data.pdf_url
        ) {

          const mensagem =
`📄 Receita Assinada

Olá ${nome}!

${data.pdf_url}

👨‍⚕️ Doctor Prescreve`

          enviarWhatsAppOficial(
            telefone,
            mensagem
          ).catch(console.error)
        }
      }
    }

    return res.status(200)
      .send('OK')

  } catch (e) {

    console.error(
      '❌ webhookMemed:',
      e.message
    )

    return res.status(400)
      .send('Bad Request')
  }
}

module.exports = {
  getTokenMemed,
  getStatusMemed,
  criarPrescricaoMemed,
  salvarReceitaMemed,
  webhookMemed
}

const db =
  require('../db-supabase-hybrid')

const {
  enviarWhatsAppOficial
} = require('../services/whatsappService')

const chamadosSuporte = []

async function adicionarFilaSuporte(
  req,
  res
) {

  try {

    const {
      telefone,
      nome,
      mensagem
    } = req.body || {}

    if (
      !telefone ||
      !nome
    ) {

      return res.status(400)
        .json({
          error:
            'telefone e nome são obrigatórios'
        })
    }

    const chamado = {

      id:
        Date.now()
          .toString(),

      telefone,

      nome,

      mensagem:
        mensagem || '',

      status:
        'PENDENTE',

      criado_em:
        new Date()
          .toISOString(),

      atendido_em:
        null
    }

    if (
      typeof db
        .adicionarFilaSuporte ===
      'function'
    ) {

      try {

        const registro =
          await db
            .adicionarFilaSuporte(
              chamado
            )

        return res.status(201)
          .json({

            success: true,

            chamado:
              registro
          })

      } catch (e) {

        console.warn(
          '⚠️ fallback suporte memória'
        )
      }
    }

    chamadosSuporte.push(
      chamado
    )

    return res.status(201)
      .json({

        success: true,

        chamado
      })

  } catch (e) {

    console.error(
      '❌ adicionarFilaSuporte:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao adicionar suporte'
      })
  }
}

async function listarFilaSuporte(
  req,
  res
) {

  try {

    if (
      typeof db
        .getFilaSuporte ===
      'function'
    ) {

      try {

        const fila =
          await db
            .getFilaSuporte()

        return res.json({

          total:
            fila.length,

          fila
        })

      } catch (e) {

        console.warn(
          '⚠️ fallback fila suporte'
        )
      }
    }

    const pendentes =
      chamadosSuporte.filter(
        c =>
          c.status ===
          'PENDENTE'
      )

    return res.json({

      total:
        pendentes.length,

      fila:
        pendentes
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          e.message
      })
  }
}

async function responderSuporte(
  req,
  res
) {

  try {

    const {
      resposta
    } = req.body || {}

    let chamado = null

    if (
      typeof db
        .responderFilaSuporte ===
      'function'
    ) {

      try {

        chamado =
          await db
            .responderFilaSuporte(
              req.params.id,
              resposta
            )

      } catch (e) {}
    }

    if (!chamado) {

      chamado =
        chamadosSuporte.find(
          c =>
            c.id ===
            req.params.id
        )

      if (!chamado) {

        return res.status(404)
          .json({
            error:
              'Chamado não encontrado'
          })
      }

      if (
        chamado.status ===
        'RESPONDIDO'
      ) {

        return res.status(400)
          .json({
            error:
              'Chamado já respondido'
          })
      }

      chamado.status =
        'RESPONDIDO'

      chamado.resposta =
        resposta || ''

      chamado.atendido_em =
        new Date()
          .toISOString()
    }

    if (
      chamado.telefone &&
      resposta
    ) {

      enviarWhatsAppOficial(
        chamado.telefone,
        `🎧 Suporte Doctor Prescreve\n\n${resposta}`,
        'suporte'
      ).catch(console.error)
    }

    return res.json({

      success: true,

      chamado
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          e.message
      })
  }
}

async function listarPendentes(
  req,
  res
) {

  try {

    const pendentes =
      chamadosSuporte.filter(
        c =>
          c.status ===
          'PENDENTE'
      )

    return res.json({

      total:
        pendentes.length,

      chamados:
        pendentes
    })

  } catch (e) {

    return res.status(500)
      .json({
        error:
          e.message
      })
  }
}

async function atenderChamado(
  req,
  res
) {

  try {

    const chamado =
      chamadosSuporte.find(
        c =>
          c.id ===
          req.params.id
      )

    if (!chamado) {

      return res.status(404)
        .json({
          error:
            'Chamado não encontrado'
        })
    }

    chamado.status =
      'ATENDIDO'

    chamado.atendido_em =
      new Date()
        .toISOString()

    return res.json({

      success: true,

      chamado
    })

  } catch (e) {

    console.error(
      '❌ atenderChamado:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao atender chamado'
      })
  }
}

module.exports = {
  adicionarFilaSuporte,
  listarFilaSuporte,
  responderSuporte,
  listarPendentes,
  atenderChamado
}

const db =
  require('../db-supabase-hybrid')

const {
  transicaoValida,
  TRANSICOES_VALIDAS
} = require('../config')

async function webhookAtualizarStatus(
  req,
  res
) {

  try {

    const {
      atendimentoId,
      status,
      observacao,
      payload
    } = req.body || {}

    if (
      !atendimentoId ||
      !status
    ) {

      return res.status(400)
        .json({
          error:
            'atendimentoId e status são obrigatórios'
        })
    }

    const at =
      await db.buscarAtendimentoPorId(
        atendimentoId
      )

    if (!at) {

      return res.status(404)
        .json({
          error:
            'Atendimento não encontrado'
        })
    }

    if (
      !transicaoValida(
        at.status,
        status
      )
    ) {

      return res.status(400)
        .json({

          error:
            `Transição inválida: ${at.status} → ${status}`,

          permitidos:
            TRANSICOES_VALIDAS[
              at.status
            ] || []
        })
    }

    const metadata = {

      webhook:
        true,

      atualizado_em:
        new Date()
          .toISOString(),

      observacao:
        observacao || null,

      payload:
        payload || null
    }

    await db.atualizarStatus(
      atendimentoId,
      status,
      metadata
    )

    console.log(
      `✅ Status atualizado: ${atendimentoId} → ${status}`
    )

    return res.json({

      success: true,

      atendimentoId,

      status_anterior:
        at.status,

      status_novo:
        status
    })

  } catch (e) {

    console.error(
      '❌ webhookAtualizarStatus:',
      e.message
    )

    return res.status(500)
      .json({
        error:
          'Erro ao atualizar status'
      })
  }
}

module.exports = {
  webhookAtualizarStatus
}

require('dotenv').config()

const express =
  require('express')

const cors =
  require('cors')

const helmet =
  require('helmet')

const path =
  require('path')

const rateLimit =
  require('express-rate-limit')

const {
  PORT,
  BASE_URL,
  WHATSAPP_MODE,
  PUBLIC_DIR,
  requiredEnvVars,
  IS_PRODUCTION
} = require('./config')

const {
  errorHandler,
  notFoundHandler
} = require(
  './middlewares/errorHandler'
)

const allRoutes =
  require('./routes')

const {
  gerarToken
} = require(
  './middlewares/auth'
)

const missingEnvVars =
  requiredEnvVars.filter(
    envVar =>
      !process.env[envVar]
  )

if (
  missingEnvVars.length > 0
) {

  console.error(
    `❌ Variáveis faltando: ${missingEnvVars.join(', ')}`
  )

  process.exit(1)
}

try {

  const keyBuffer =
    Buffer.from(
      process.env.ENCRYPTION_KEY,
      'hex'
    )

  if (
    keyBuffer.length !== 32
  ) {

    throw new Error(
      'ENCRYPTION_KEY inválida'
    )
  }

} catch (e) {

  console.error(
    '❌ ENCRYPTION_KEY:',
    e.message
  )

  process.exit(1)
}

const app =
  express()

app.set(
  'trust proxy',
  1
)

app.use(cors({

  origin:
    process.env.CORS_ORIGIN
      ? process.env
          .CORS_ORIGIN
          .split(',')
      : '*',

  credentials:
    true
}))

app.use(helmet({

  contentSecurityPolicy: {

    directives: {

      defaultSrc: [
        "'self'"
      ],

      scriptSrc: [

        "'self'",

        "blob:",

        "https://sandbox.memed.com.br",

        "https://cdn.memed.com.br",

        "https://integrations.memed.com.br"
      ],

      styleSrc: [

        "'self'",

        "'unsafe-inline'",

        "https://fonts.googleapis.com"
      ],

      fontSrc: [

        "'self'",

        "https://fonts.gstatic.com",

        "data:"
      ],

      imgSrc: [

        "'self'",

        "data:",

        "https:"
      ],

      connectSrc: [

        "'self'",

        "https://sandbox.memed.com.br",

        "https://integrations.memed.com.br"
      ],

      frameSrc: [

        "'self'",

        "https://sandbox.memed.com.br"
      ]
    }
  },

  crossOriginEmbedderPolicy:
    false
}))

app.use(
  express.static(
    PUBLIC_DIR
  )
)

app.use(express.json({
  limit: '2mb'
}))

app.use(express.urlencoded({
  extended: true
}))

const apiLimiter =
  rateLimit({

    windowMs:
      60 * 1000,

    max: 100,

    standardHeaders:
      true,

    legacyHeaders:
      false,

    message: {
      error:
        'Muitas requisições'
    }
  })

app.use(
  '/api',
  apiLimiter
)

app.get(
  '/healthz',

  async (
    req,
    res
  ) => {

    try {

      const db =
        require(
          './db-supabase-hybrid'
        )

      const health =
        await db.healthCheck()

      return res.json({

        status:
          health?.supabase ||
          health?.json
            ? 'online'
            : 'offline',

        env:
          IS_PRODUCTION
            ? 'production'
            : 'development',

        uptime:
          process.uptime(),

        timestamp:
          new Date()
            .toISOString(),

        database:
          health
      })

    } catch (e) {

      return res.status(503)
        .json({

          status:
            'error',

          error:
            e.message
        })
    }
  }
)

const loginLimiter =
  rateLimit({

    windowMs:
      15 * 60 * 1000,

    max: 5,

    message: {
      error:
        'Muitas tentativas'
    }
  })

app.post(
  '/login',

  loginLimiter,

  (
    req,
    res
  ) => {

    try {

      const {
        senha
      } = req.body || {}

      if (!senha) {

        return res.status(400)
          .json({
            error:
              'Senha obrigatória'
          })
      }

      if (
        senha !==
        process.env.MEDICO_PASS
      ) {

        return res.status(401)
          .json({
            error:
              'Senha inválida'
          })
      }

      const token =
        gerarToken()

      return res.json({

        success:
          true,

        token,

        expiresIn:
          '8h'
      })

    } catch (e) {

      return res.status(500)
        .json({
          error:
            'Erro no login'
        })
    }
  }
)

app.get(
  '/success',

  (
    req,
    res
  ) => {

    return res.sendFile(
      path.join(
        PUBLIC_DIR,
        'success.html'
      )
    )
  }
)

app.get(
  '/cancel',

  (
    req,
    res
  ) => {

    return res.sendFile(
      path.join(
        PUBLIC_DIR,
        'cancel.html'
      )
    )
  }
)

app.get(
  '/painel-medico',

  (
    req,
    res
  ) => {

    return res.sendFile(
      path.join(
        PUBLIC_DIR,
        'painel-medico.html'
      )
    )
  }
)

app.use('/api', allRoutes)

app.use(notFoundHandler)

app.use(errorHandler)

let server = null

async function startServer() {

  try {

    const db =
      require(
        './db-supabase-hybrid'
      )

    await db.initDB()

    console.log(
      '✅ Banco inicializado'
    )

    server =
      app.listen(
        PORT,
        '0.0.0.0',

        () => {

          console.log(
            `🚀 Porta ${PORT}`
          )

          console.log(
            `🌐 ${BASE_URL}`
          )

          console.log(
            `📱 WhatsApp ${WHATSAPP_MODE}`
          )

          console.log(
            `📦 ${IS_PRODUCTION ? 'production' : 'development'}`
          )
        }
      )

  } catch (e) {

    console.error(
      '❌ startServer:',
      e.message
    )

    process.exit(1)
  }
}

async function shutdown(
  signal
) {

  console.log(
    `🛑 ${signal}`
  )

  if (!server) {
    return process.exit(0)
  }

  server.close(
    async () => {

      try {

        const db =
          require(
            './db-supabase-hybrid'
          )

        if (
          typeof db.closeConnection ===
          'function'
        ) {

          await db.closeConnection()
        }

      } catch (e) {

        console.warn(
          '⚠️ closeConnection:',
          e.message
        )
      }

      process.exit(0)
    }
  )

  setTimeout(
    () => {

      console.error(
        '❌ shutdown timeout'
      )

      process.exit(1)

    },
    10000
  )
}

process.on(
  'SIGTERM',
  () =>
    shutdown(
      'SIGTERM'
    )
)

process.on(
  'SIGINT',
  () =>
    shutdown(
      'SIGINT'
    )
)

startServer()