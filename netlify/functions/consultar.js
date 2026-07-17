const fetch = require('node-fetch');
const LIMITE_RESULTADOS = 200;
const ATRASO_ENTRE_BUSCAS = 300;

// ==============================
// AQUI FICAM AS CONFIGURAÇÕES DAS FONTES
// COLOQUE AQUI A URL E CHAVE DE CADA FONTE QUE VOCÊ USAR
// ==============================
const CONFIG = {
  // Exemplo: se você tiver uma fonte que substitui o Escavador
  // FONTE_PROCESSOS_URL: "https://api.sua-fonte.com.br/v1/buscar",
  // FONTE_PROCESSOS_CHAVE: "SUA_CHAVE_AQUI",

  // Exemplo: consulta OAB em conselho
  // OAB_CONSULTA_URL: "https://api.oabuf.br/consulta",
};

exports.handler = async (event) => {
  try {
    const { tipo, valor } = event.queryStringParameters;
    if (!tipo || !valor) throw new Error('Informe tipo e valor');
    
    let processos = [];

    // --- BUSCA PRINCIPAL (NO LUGAR DO ESCAVADOR) ---
    try {
      await new Promise(r => setTimeout(r, ATRASO_ENTRE_BUSCAS));
      const resPrincipal = await buscarFontePrincipal(tipo, valor);
      processos.push(...resPrincipal);
    } catch (e) { console.log('Fonte Principal:', e.message); }

    // --- OUTRAS FONTES SE PRECISAR ---
    try {
      await new Promise(r => setTimeout(r, ATRASO_ENTRE_BUSCAS));
      const resOab = await buscarDadosOab(tipo, valor);
      processos.push(...resOab);
    } catch (e) { console.log('OAB:', e.message); }

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
    return { statusCode: 400, body: JSON.stringify({ erro: erro.message }) };
  }
};

// ==============================
// FUNÇÃO NO LUGAR DO ESCAVADOR
// ==============================
async function buscarFontePrincipal(tipo, valor) {
  console.log(`Buscando fonte principal: ${tipo} = ${valor}`);

  // ✅ QUANDO VOCÊ TIVER A URL E CHAVE, É SÓ DESCOMENTAR E PREENCHER:
  /*
  const resposta = await fetch(`${CONFIG.FONTE_PROCESSOS_URL}?tipo=${tipo}&q=${encodeURIComponent(valor)}`, {
    headers: {
      'Authorization': `Bearer ${CONFIG.FONTE_PROCESSOS_CHAVE}`,
      'Content-Type': 'application/json'
    }
  });
  const dados = await resposta.json();
  
  // Converte para o formato que o bot já entende (igual Escavador)
  return dados.itens || dados.processos || [];
  */

  return [];
}

async function buscarDadosOab(tipo, valor) {
  console.log(`Buscando dados OAB: ${tipo} = ${valor}`);
  return [];
}
