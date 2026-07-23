console.log("DATAJUD — BUSCA POR TEXTO LIVRE");

const fetch = require('node-fetch');

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const CHAVE_API = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const TRIBUNAIS = {
  tjms: "api_publica_tjms",
  tjsp: "api_publica_tjsp",
  tjmg: "api_publica_tjmg"
};

// Delay simples para evitar erro 429 (muitas requisições)
const esperar = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = async (parametros) => {
  try {
    const { numeroOAB } = parametros;
    if (!numeroOAB) return [];
    console.log(`Buscando OAB ${numeroOAB} em todos os campos`);

    const resultados = [];

    for (const [sigla, rota] of Object.entries(TRIBUNAIS)) {
      try {
        // Espera 1 segundo entre tribunais para não bater no limite
        await esperar(1000);

        const res = await fetch(`${BASE_URL}/${rota}/_search`, {
          method: "POST",
          headers: {
            "Authorization": `APIKey ${CHAVE_API}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            size: 50,
            // BUSCA POR TEXTO LIVRE EM TODO O REGISTRO
            query: {
              query_string: {
                query: `*${numeroOAB}*`,
                default_operator: "AND"
              }
            }
          })
        });

        if (res.status === 429) {
          console.log(`Limite atingido em ${sigla}, tentando novamente em 3s...`);
          await esperar(3000);
          // Tenta mais uma vez
          const res2 = await fetch(`${BASE_URL}/${rota}/_search`, {
            method: "POST",
            headers: res.headers,
            body: JSON.stringify({ size: 50, query: { query_string: { query: `*${numeroOAB}*` } } })
          });
          if (!res2.ok) continue;
          const dados2 = await res2.json();
          if (dados2.hits?.hits) adicionarProcessos(dados2.hits.hits, sigla, resultados);
          continue;
        }

        if (!res.ok) continue;
        const dados = await res.json();
        if (dados.hits?.hits) adicionarProcessos(dados.hits.hits, sigla, resultados);

      } catch { continue; }
    }

    console.log(`DataJud total encontrado: ${resultados.length}`);
    return resultados;

  } catch (erro) {
    console.log(`DataJud ERRO: ${erro.message}`);
    return [];
  }
};

function adicionarProcessos(hits, sigla, lista) {
  hits.forEach(item => {
    const f = item._source;
    lista.push({
      numero: f.numeroProcesso || "",
      tribunal: f.tribunal || sigla.toUpperCase(),
      classe: f.classe?.nome || "",
      assunto: f.assuntos?.[0]?.nome || "",
      data: f.dataAjuizamento || "",
      movimentacao: "",
      link: `https://datajud.cnj.jus.br/processo/${f.numeroProcesso || ""}`
    });
  });
}
