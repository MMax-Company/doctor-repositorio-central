require('dotenv').config()

function obterConfiguracaoMemed() {

  return {
    apiKey: process.env.MEMED_API_KEY,
    secretKey: process.env.MEMED_SECRET_KEY,
    ambiente:
      process.env.MEMED_ENVIRONMENT || 'homologacao'
  }

}

module.exports = {
  obterConfiguracaoMemed
}