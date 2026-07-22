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
    const resultados = [];
    const { uf, numeroOAB } = parametros;

    if (!numeroOAB) return [];
    console.log(`Buscando DataJud — OAB: ${numeroOAB} | UF: ${uf || 'todas'}`);

    for (const [sigla, rota] of Object.entries(TRIBUNAIS)) {
      try {
        const resposta = await fetch(`${BASE_URL}/${rota}/_search`, {
          method: "POST",
          headers: {
            "Authorization": `APIKey ${CHAVE_API}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            size: 100,
            query: {
              bool: {
                must: [
                  { match: { "advogados.numeroOAB": numeroOAB } }
                ]
              }
            }
          })
        });

        if (!resposta.ok) continue;
        const dados = await resposta.json();

        if (dados.hits?.hits) {
          dados.hits.hits.forEach(item => {
            const f = item._source;
            resultados.push({
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
      } catch {
        continue;
      }
    }

    return resultados;
  } catch (erro) {
    console.log(`DataJud: ${erro.message}`);
    return [];
  }
};
