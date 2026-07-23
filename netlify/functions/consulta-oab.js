// Usa APENAS as funções do arquivo central — sem duplicatas
const { limparOAB, separarOAB } = require('../utils/validar');

// Função auxiliar: busca com timeout de 10s
const buscarComTimeout = async (funcao, nome, ...args) => {
  console.log(`Iniciando: ${nome}`);
  try {
    const resultado = await Promise.race([
      funcao(...args),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`${nome} excedeu 10s`)), 10000)
      )
    ]);
    console.log(`Concluído: ${nome} | ${resultado.length || 0} itens`);
    return resultado;
  } catch (erro) {
    console.log(`Falha: ${nome} | ${erro.message}`);
    return [];
  }
};

const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const removerDuplicados = require('../utils/removerDuplicados');

exports.handler = async (event) => {
  const { valor } = event.queryStringParameters || {};
  const oabBruta = valor || '';
  const oabLimpa = limparOAB(oabBruta);
  const { uf, numero } = separarOAB(oabBruta);

  console.log(`=== INÍCIO CONSULTA OAB: ${oabLimpa} ===`);

  try {
    const [resTJSP, resTJMS, resTJMG, resDataJud] = await Promise.allSettled([
      buscarComTimeout(tjsp, "TJSP", oabLimpa),
      buscarComTimeout(tjms, "TJMS", oabLimpa),
      buscarComTimeout(tjmg, "TJMG", oabLimpa),
      buscarComTimeout(datajud, "DataJud", { uf, numeroOAB: numero })
    ]);

    const todos = [
      ...(resTJSP.status === 'fulfilled' ? resTJSP.value : []),
      ...(resTJMS.status === 'fulfilled' ? resTJMS.value : []),
      ...(resTJMG.status === 'fulfilled' ? resTJMG.value : []),
      ...(resDataJud.status === 'fulfilled' ? resDataJud.value : [])
    ];

    const processos = removerDuplicados(todos);
    console.log(`=== FIM CONSULTA | Total: ${processos.length} ===`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        total: processos.length,
        itens: processos,
        origem: "APIs Públicas de Tribunais + DataJud/CNJ"
      })
    };

  } catch (erro) {
    console.log(`ERRO GERAL: ${erro.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: erro.message })
    };
  }
};
