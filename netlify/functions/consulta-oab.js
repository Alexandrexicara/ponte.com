const { limparOAB, separarOAB } = require('../utils/validar');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');

// CONFIGURAÇÕES GERAIS
const MAX_PROCESSOS = 200;
const processosUnicos = new Map(); // Chave = número CNJ, valor = processo completo

const adicionarSemDuplicar = (processo) => {
  if (!processo?.numero || processosUnicos.size >= MAX_PROCESSOS) return;
  if (!processosUnicos.has(processo.numero)) {
    processosUnicos.set(processo.numero, processo);
  }
};

const buscarComControle = async (funcao, nome, ...args) => {
  try {
    console.log(`Iniciando: ${nome} | Total até agora: ${processosUnicos.size}`);
    const resultado = await Promise.race([
      funcao(...args),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`${nome} demorou`)), 25000))
    ]);
    resultado.forEach(adicionarSemDuplicar);
    console.log(`Concluído: ${nome} | Novos: ${resultado.length} | Total: ${processosUnicos.size}`);
    return resultado;
  } catch (erro) {
    console.log(`Falha: ${nome} | ${erro.message}`);
    return [];
  }
};

exports.handler = async (event) => {
  const { valor } = event.queryStringParameters || {};
  const oabLimpa = limparOAB(valor || '');
  const { uf, numero } = separarOAB(valor || '');

  console.log(`=== CONSULTA OAB: ${oabLimpa} | LIMITE: ${MAX_PROCESSOS} ===`);

  // Busca em lote controlado
  await Promise.allSettled([
    buscarComControle(tjsp, "TJSP", oabLimpa),
    buscarComControle(tjms, "TJMS", oabLimpa),
    buscarComControle(tjmg, "TJMG", oabLimpa),
    buscarComControle(datajud, "DataJud", { uf, numeroOAB: numero })
  ]);

  const listaFinal = Array.from(processosUnicos.values());

  // GERA O CONTEÚDO DO TXT PRONTO PARA DOWNLOAD
  const gerarTXT = () => {
    let txt = `==================================\nCONSULTA OAB\n==================================\n\n`;
    txt += `OAB: ${oabLimpa}\nData: ${new Date().toLocaleDateString('pt-BR')}\nTotal encontrado: ${listaFinal.length} processos\n\n`;
    
    listaFinal.forEach((proc, idx) => {
      txt += `==================================\nPROCESSO ${String(idx+1).padStart(3,'0')}\n==================================\n`;
      txt += `CNJ: ${proc.numero || "Não informado"}\n`;
      txt += `Tribunal: ${proc.tribunal || "Não informado"}\n`;
      txt += `Classe: ${proc.classe || "Não informado"}\n`;
      txt += `Assunto: ${proc.assunto || "Não informado"}\n`;
      txt += `Data Distribuição: ${proc.data || "Não informado"}\n\n`;
    });
    return txt;
  };

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      total: listaFinal.length,
      limite: MAX_PROCESSOS,
      itens: listaFinal,
      txt: gerarTXT(),
      origem: "APIs Públicas + DataJud/CNJ"
    })
  };
};
