const fetch = require('node-fetch');
const LIMITE_RESULTADOS = 200;
const ATRASO_ENTRE_BUSCAS = 300;

exports.handler = async (event) => {
  try {
    const { tipo, valor } = event.queryStringParameters;
    if (!tipo || !valor) throw new Error('Informe tipo (oab/nome/cpf) e valor');
    
    let processos = [];

    // --- BUSCA REAL CNJ ---
    try {
      await new Promise(r => setTimeout(r, ATRASO_ENTRE_BUSCAS));
      const resCnj = await buscarCNJ(tipo, valor);
      processos.push(...resCnj);
    } catch (e) { console.log('CNJ:', e.message); }

    // --- BUSCA REAL OAB ---
    try {
      await new Promise(r => setTimeout(r, ATRASO_ENTRE_BUSCAS));
      const resOab = await buscarOAB(tipo, valor);
      processos.push(...resOab);
    } catch (e) { console.log('OAB:', e.message); }

    // Limpa duplicatas e limita
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

// ==============================
// AQUI VOCÊ COLOCA SUAS FONTES REAIS
// ==============================
async function buscarCNJ(tipo, valor) {
  console.log(`Buscando CNJ: ${tipo} = ${valor}`);
  
  // ✅ EXEMPLO PRONTO: COLOQUE AQUI A SUA CHAVE E URL
  /*
  const url = `URL_DA_SUA_FONTE_CNJ?tipo=${tipo}&q=${encodeURIComponent(valor)}`;
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer SUA_CHAVE_AQUI' }
  });
  const dados = await res.json();
  return dados.processos || [];
  */

  // Por enquanto retorna vazio — substitua acima quando tiver os dados
  return [];
}

async function buscarOAB(tipo, valor) {
  console.log(`Buscando OAB: ${tipo} = ${valor}`);

  // ✅ EXEMPLO PRONTO: COLOQUE AQUI A SUA CHAVE E URL
  /*
  const url = `URL_DA_SUA_FONTE_OAB?uf=${valor.split(' ')[0]}&numero=${valor.split(' ')[1]}`;
  const res = await fetch(url, {
    headers: { 'Authorization': 'Bearer SUA_CHAVE_AQUI' }
  });
  const dados = await res.json();
  return dados.processos || [];
  */

  // Por enquanto retorna vazio — substitua acima quando tiver os dados
  return [];
}
