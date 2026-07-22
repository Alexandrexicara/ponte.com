const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const removerDuplicados = require('../utils/removerDuplicados');
const { limparOAB } = require('../utils/validar');

exports.handler = async (event) => {
  const { valor } = event.queryStringParameters || {};
  const oab = limparOAB(valor || '');

  console.log(`Requisição recebida: OAB ${oab}`);

  try {
    // Busca PARALELA em todas as fontes
    const [resTJSP, resTJMS, resTJMG, resDataJud] = await Promise.allSettled([
      tjsp(oab),
      tjms(oab),
      tjmg(oab),
      datajud({ advogado: { numeroOAB: oab } })
    ]);

    const todos = [
      ...(resTJSP.status === 'fulfilled' ? resTJSP.value : []),
      ...(resTJMS.status === 'fulfilled' ? resTJMS.value : []),
      ...(resTJMG.status === 'fulfilled' ? resTJMG.value : []),
      ...(resDataJud.status === 'fulfilled' ? resDataJud.value : [])
    ];

    const processos = removerDuplicados(todos);

    console.log(`Total processos: ${processos.length}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        total: processos.length,
        itens: processos,
        origem: "APIs Públicas de Tribunais + DataJud/CNJ"
      })
    };

  } catch (erro) {
    console.log(`Erro geral: ${erro.message}`);
    return {
      statusCode: 500,
      body: JSON.stringify({ erro: erro.message })
    };
  }
};
