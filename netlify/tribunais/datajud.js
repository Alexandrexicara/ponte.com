console.log("DATAJUD CARREGADO");

const fetch = require('node-fetch');

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const CHAVE_API = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

// Primeiro testamos o TJMS, que é o tribunal da OAB MS 3616
const TRIBUNAL_PRINCIPAL = "api_publica_tjms";

module.exports = async (parametros) => {
  try {
    console.log("DATAJUD — INICIANDO DESCOBERTA COMPLETA");

    // Busca 1 processo do TJMS para ver TODOS os campos
    const testeRes = await fetch(`${BASE_URL}/${TRIBUNAL_PRINCIPAL}/_search`, {
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

    if (!testeRes.ok) {
      console.log("ERRO NA REQUISIÇÃO:", testeRes.status, testeRes.statusText);
      return [];
    }

    const testeDados = await testeRes.json();
    console.log("=== REGISTRO COMPLETO DATAJUD/TJMS ===");
    console.log(JSON.stringify(testeDados.hits?.hits?.[0]?._source || "SEM DADOS", null, 2));

    return [];

  } catch (erro) {
    console.log(`DataJud ERRO GERAL: ${erro.message}`);
    return [];
  }
};
