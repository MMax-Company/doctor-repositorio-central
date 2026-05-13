// test-memed.js

require('dotenv').config()

const memed = require('./memed')

async function run() {

  const result =
    await memed.testarConexao()

  console.log(result)

}

run()