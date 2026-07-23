console.log("DATAJUD CARREGADO");

const fetch = require('node-fetch');

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const CHAVE_API = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const TRIBUNAIS = {
  tjsp: "api_publica_tjsp",
  tjms: "api_publica_tjms",
  tjmg: "api_publica_tjmg"
};

module.exports = async (parametros) => {
  try {
    console.log("DATAJUD — INICIANDO DESCOBERTA DA ESTRUTURA");

    // PASSO 1: Busca 1 processo qualquer para ver os campos reais
    const testeRes = await fetch(`${BASE_URL}/${TRIBUNAIS.tjsp}/_search`, {
      method: "POST",
      headers: {
        "Authorization": `APIKey ${CHAVE_API}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        size: 1,
        query: { match_all: {} }
      })
    });

    if (testeRes.ok) {
      const testeDados = await testeRes.json();
      if (testeDados.hits?.hits?.[0]?._source) {
        const amostra = testeDados.hits.hits[0]._source;
        console.log("=== ESTRUTURA REAL DO DATAJUD ===");
        console.log("Campos de advogados:", JSON.stringify(amostra.advogados || amostra.representantes || "NÃO ENCONTRADO", null, 2));
      }
    }

    // PASSO 2: A busca real (usaremos o campo correto depois da descoberta)
    const resultados = [];
    const { uf, numeroOAB } = parametros;
    if (!numeroOAB) return [];

    console.log(`Buscando OAB: ${numeroOAB} | UF: ${uf || 'todas'}`);
    // AQUI DEPOIS COLOCAREMOS O CAMPO EXATO QUE APARECER NO LOG
    // Por enquanto deixamos a estrutura pronta, mas só usaremos o correto

    return resultados;

  } catch (erro) {
    console.log(`DataJud ERRO: ${erro.message}`);
    return [];
  }
};
