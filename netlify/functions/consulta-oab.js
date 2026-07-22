const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const removerDuplicados = require('../utils/removerDuplicados');
const { limparOAB, separarOAB } = require('../utils/validar');

exports.handler = async (event) => {
  const { valor } = event.queryStringParameters || {};
  const oabBruta = valor || '';
  const oabLimpa = limparOAB(oabBruta);
  const { uf, numero } = separarOAB(oabBruta);

  console.log(`Requisição recebida: OAB ${oabLimpa}`);
  console.log(`CHAMANDO DATAJUD — UF: ${uf} | Número: ${numero}`);

  try {
    const [resTJSP, resTJMS, resTJMG, resDataJud] = await Promise.allSettled([
      tjsp(oabLimpa),
      tjms(oabLimpa),
      tjmg(oabLimpa),
      datajud({ uf, numeroOAB: numero })
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
