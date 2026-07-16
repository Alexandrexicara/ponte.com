const fetch = require('node-fetch');
const LIMITE_RESULTADOS = 200;
const ATRASO_ENTRE_BUSCAS = 300;

exports.handler = async (event) => {
  try {
    const { tipo, valor } = event.queryStringParameters;
    if (!tipo || !valor) throw new Error('Informe tipo (oab/nome/cpf) e valor');
    
    let processos = [];

    // --- AQUI VAMOS COLOCAR AS BUSCAS REAIS AMANHÃ ---
    // CNJ, OAB, Tribunais... já está estruturado e esperando
    try {
      await new Promise(r => setTimeout(r, ATRASO_ENTRE_BUSCAS));
      const resCnj = await buscarCNJ(tipo, valor);
      processos.push(...resCnj);
    } catch (e) { console.log('CNJ:', e.message); }

    try {
      await new Promise(r => setTimeout(r, ATRASO_ENTRE_BUSCAS));
      const resOab = await buscarOAB(tipo, valor);
      processos.push(...resOab);
    } catch (e) { console.log('OAB:', e.message); }

    // Limpa e organiza
    processos = processos
      .filter(p => p && p.numero_cnj)
      .slice(0, LIMITE_RESULTADOS);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total: processos.length,
        itens: processos,
        origem: "Nossa API - Fontes Oficiais"
      })
    };
  } catch (erro) {
    return {
      statusCode: 400,
      body: JSON.stringify({ erro: erro.message })
    };
  }
};

// Funções prontas para receber o código real amanhã
async function buscarCNJ(tipo, valor) {
  console.log(`Buscando CNJ: ${tipo} = ${valor}`);
  return [];
}

async function buscarOAB(tipo, valor) {
  console.log(`Buscando OAB: ${tipo} = ${valor}`);
  return [];
}
