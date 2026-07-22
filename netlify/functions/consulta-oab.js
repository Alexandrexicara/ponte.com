const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const removerDuplicados = require('../utils/removerDuplicados');
const { validarOAB, limparOAB } = require('../utils/validar');
const cache = require('../utils/cache');
const logger = require('../utils/logger');

exports.handler = async (event) => {
  const { oab } = event.queryStringParameters || {};
  const chaveCache = `oab_${limparOAB(oab || '')}`;

  logger('INFO', `Requisição recebida: OAB ${oab || 'não informado'}`);

  // Validação básica
  if (!oab || !validarOAB(oab)) {
    return { statusCode: 400, body: JSON.stringify({ erro: 'OAB inválida. Use o formato: MS3616' }) };
  }

  // Verifica cache primeiro
  const cacheado = cache.get(chaveCache);
  if (cacheado) {
    logger('INFO', 'Retornando dados do cache');
    return { statusCode: 200, body: JSON.stringify(cacheado) };
  }

  try {
    // BUSCA PARALELA EM TODAS AS FONTES DISPONÍVEIS
    const [resTJSP, resTJMS, resTJMG, resDataJud] = await Promise.allSettled([
      tjsp(oab),
      tjms(oab),
      tjmg(oab),
      datajud({ advogado: { numeroOAB: limparOAB(oab) } })
    ]);

    // Junta todos os resultados
    const todosProcessos = [
      ...(resTJSP.status === 'fulfilled' ? resTJSP.value : []),
      ...(resTJMS.status === 'fulfilled' ? resTJMS.value : []),
      ...(resTJMG.status === 'fulfilled' ? resTJMG.value : []),
      ...(resDataJud.status === 'fulfilled' ? resDataJud.value : [])
    ];

    // Remove duplicatas
    const processosUnicos = removerDuplicados(todosProcessos);
    const resposta = { oab: limparOAB(oab), total: processosUnicos.length, processos: processosUnicos };

    // Salva no cache
    cache.set(chaveCache, resposta);
    logger('INFO', `Consulta concluída: ${processosUnicos.length} processos encontrados`);

    return { statusCode: 200, body: JSON.stringify(resposta) };
  } catch (erro) {
    logger('ERRO', 'Falha na consulta', { mensagem: erro.message });
    return { statusCode: 500, body: JSON.stringify({ erro: 'Falha ao consultar processos' }) };
  }
};
