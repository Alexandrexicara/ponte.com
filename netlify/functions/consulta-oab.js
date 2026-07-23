function limparOAB(valor) {
  if (!valor) return "";
  return String(valor).trim().toUpperCase().replace(/\s+/g, " ");
}

function separarOAB(valor) {
  if (!valor) return { uf: "", numero: "" };
  const partes = String(valor).trim().toUpperCase().split(/\s+/);
  if (partes.length >= 2) return { uf: partes[0], numero: partes.slice(1).join("") };
  return { uf: "", numero: partes[0] || "" };
}

function limparOAB(valor) {
  if (!valor) return "";
  return String(valor).trim().toUpperCase().replace(/\s+/g, " ");
}

function separarOAB(valor) {
  if (!valor) return { uf: "", numero: "" };
  const partes = String(valor).trim().toUpperCase().split(/\s+/);
  if (partes.length >= 2) return { uf: partes[0], numero: partes.slice(1).join("") };
  return { uf: "", numero: partes[0] || "" };
}

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
