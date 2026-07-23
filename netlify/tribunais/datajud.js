console.log("DATAJUD CARREGADO — VARRER TODOS OS CAMPOS");

const fetch = require('node-fetch');

const BASE_URL = "https://api-publica.datajud.cnj.jus.br";
const CHAVE_API = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const TRIBUNAL = "api_publica_tjms";

// Função auxiliar: procura por qualquer termo relacionado a OAB em todo o objeto
const procurarOABemTudo = (obj, termo) => {
  const resultados = [];
  const percorrer = (dado, caminho = "") => {
    if (!dado || typeof dado !== "object") return;
    for (const [chave, valor] of Object.entries(dado)) {
      const caminhoAtual = caminho ? `${caminho}.${chave}` : chave;
      if (String(valor).toLowerCase().includes(termo.toLowerCase())) {
        resultados.push({ caminho: caminhoAtual, valor: valor });
      }
      if (Array.isArray(valor)) valor.forEach((item, i) => percorrer(item, `${caminhoAtual}[${i}]`));
      else if (typeof valor === "object") percorrer(valor, caminhoAtual);
    }
  };
  percorrer(obj);
  return resultados;
};

module.exports = async (parametros) => {
  try {
    console.log("=== BUSCANDO ESTRUTURA COMPLETA NO TJMS ===");

    const res = await fetch(`${BASE_URL}/${TRIBUNAL}/_search`, {
      method: "POST",
      headers: {
        "Authorization": `APIKey ${CHAVE_API}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ size: 1, query: { match_all: {} } })
    });

    if (!res.ok) { console.log("ERRO:", res.status); return []; }
    const dados = await res.json();
    const registro = dados.hits?.hits?.[0]?._source;

    if (!registro) { console.log("SEM REGISTRO"); return []; }

    // Mostra registro completo
    console.log("=== REGISTRO COMPLETO ===");
    console.log(JSON.stringify(registro, null, 2));

    // Procura por qualquer coisa que lembre advogado ou OAB
    console.log("=== LOCAIS COM ADVOGADO/OAB ===");
    const locais = procurarOABemTudo(registro, "oab");
    const locais2 = procurarOABemTudo(registro, "advog");
    const locais3 = procurarOABemTudo(registro, "3616");
    console.log("OAB:", locais);
    console.log("ADVOG:", locais2);
    console.log("NUMERO:", locais3);

    return [];
  } catch (e) {
    console.log("ERRO GERAL:", e.message);
    return [];
  }
};
