const fetch = require('node-fetch');

// ==============================================
// PADRÃO OFICIAL API PÚBLICA DATAJUD - CNJ
// ==============================================
const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
// COLOQUE SUA CHAVE DE ACESSO AQUI DEPOIS DO CADASTRO NO PORTAL CNJ
const CHAVE_API = "SUA_CHAVE_AQUI";

// Mapeamento dos tribunais que usamos
const TRIBUNAIS = {
  tjsp: "api_publica_tjsp",
  tjms: "api_publica_tjms",
  tjmg: "api_publica_tjmg",
  tjrj: "api_publica_tjrj",
  trf3: "api_publica_trf3"
};

module.exports = async (parametros) => {
  try {
    const resultados = [];

    // Busca em cada tribunal habilitado
    for (const [sigla, rota] of Object.entries(TRIBUNAIS)) {
      try {
        const res = await fetch(`${BASE_URL}/${rota}/_search`, {
          method: "POST",
          headers: {
            "Authorization": `APIKey ${CHAVE_API}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            size: 100,
            query: parametros.query || { match_all: {} },
            sort: [{ "@timestamp": { "order": "desc" } }]
          })
        });

        if (!res.ok) continue;
        const dados = await res.json();

        if (dados.hits?.hits) {
          dados.hits.hits.forEach(item => {
            const fonte = item._source;
            resultados.push({
              numero: fonte.numeroProcesso || "",
              tribunal: fonte.tribunal || sigla.toUpperCase(),
              classe: fonte.classe?.nome || "",
              assunto: fonte.assuntos?.[0]?.nome || "",
              data: fonte.dataAjuizamento || "",
              movimentacao: "",
              link: `https://datajud.cnj.jus.br/processo/${fonte.numeroProcesso || ""}`
            });
          });
        }
      } catch {
        continue; // Se um tribunal falhar, segue nos outros
      }
    }

    return resultados;
  } catch (erro) {
    console.log("DataJud indisponível:", erro.message);
    return [];
  }
};
