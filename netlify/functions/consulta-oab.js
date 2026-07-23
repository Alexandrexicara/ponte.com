const { limparOAB, separarOAB } = require('../utils/validar');
const { criarConsulta, atualizarConsulta } = require('../utils/fila');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');

// CONFIGURAÇÕES DE CONTROLE
const MAX_PROCESSOS = 200;
const MAX_TENTATIVAS = 3;
const MAX_WORKERS = 4; // 4 fontes = 4 ao mesmo tempo, sem excesso
const TIMEOUT_POR_FONTE = {
  TJSP: 20000,
  TJMS: 20000,
  TJMG: 15000,
  DataJud: 25000
};

// BUSCA COM TEMPO E TENTATIVAS POR FONTE
const buscarComControle = async (funcao, nome, args, consultaId) => {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      console.log(`[${consultaId}] ${nome} — tentativa ${tentativa}/${MAX_TENTATIVAS}`);
      const res = await Promise.race([
        funcao(...args),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), TIMEOUT_POR_FONTE[nome]))
      ]);
      return { ok: true, nome, dados: res };
    } catch (erro) {
      console.log(`[${consultaId}] ${nome} — falha ${tentativa}: ${erro.message}`);
      if (tentativa < MAX_TENTATIVAS) await new Promise(r => setTimeout(r, 1500));
    }
  }
  return { ok: false, nome, erro: "Indisponível após 3 tentativas" };
};

// EXECUÇÃO CONTROLADA
const processar = async (id, oab, uf, numero) => {
  const unicos = new Map();
  const add = (p) => p?.numero && !unicos.has(p.numero) && unicos.set(p.numero, p);

  const fontes = [
    { fn: tjsp, nome: "TJSP", args: [oab] },
    { fn: tjms, nome: "TJMS", args: [oab] },
    { fn: tjmg, nome: "TJMG", args: [oab] },
    { fn: datajud, nome: "DataJud", args: [{ uf, numeroOAB: numero }] }
  ];

  // RODA NO MÁXIMO MAX_WORKERS POR VEZ
  for (const fonte of fontes) {
    if (unicos.size >= MAX_PROCESSOS) break;
    atualizarConsulta(id, { etapa: `BUSCANDO ${fonte.nome}` });

    const res = await buscarComControle(fonte.fn, fonte.nome, fonte.args, id);
    if (res.ok) res.dados.forEach(add);
    else atualizarConsulta(id, { erros: [...(buscarConsulta(id).erros||[]), `${res.nome}: ${res.erro}`] });

    atualizarConsulta(id, { total: unicos.size, status: unicos.size > 0 ? "PARCIAL" : "PROCESSANDO" });
  }

  // GERA RESULTADO FINAL
  const lista = Array.from(unicos.values());
  let txt = `==================================\nCONSULTA OAB\n==================================\nOAB: ${oab}\nData: ${new Date().toLocaleDateString('pt-BR')}\nTotal encontrado: ${lista.length}\n\n`;
  lista.forEach((p, i) => {
    txt += `PROCESSO ${String(i+1).padStart(3,'0')}\nCNJ: ${p.numero}\nTribunal: ${p.tribunal}\nClasse: ${p.classe}\nAssunto: ${p.assunto}\nData: ${p.data}\n\n`;
  });

  atualizarConsulta(id, {
    status: lista.length > 0 ? "CONCLUÍDA" : "CONCLUÍDA",
    etapa: "FINALIZADO",
    processos: lista,
    txt
  });
};

exports.handler = async (event) => {
  const { valor } = event.queryStringParameters || {};
  const oabLimpa = limparOAB(valor);
  const { uf, numero } = separarOAB(valor);

  if (!numero) return { statusCode: 400, body: JSON.stringify({ erro: "OAB inválida" }) };

  const nova = criarConsulta(oabLimpa, MAX_PROCESSOS);

  // SE JÁ ESTIVER RODANDO, AVISA E RETORNA O ID
  if (nova.duplicada) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        aviso: "Essa OAB já está sendo consultada — aguarde finalizar",
        id: nova.id,
        status: "PROCESSANDO"
      })
    };
  }

  // INICIA E LIBERA A RESPOSTA
  processar(nova.id, oabLimpa, uf, numero).catch(e => console.log(`Erro ${nova.id}: ${e.message}`));

  return {
    statusCode: 202,
    body: JSON.stringify({
      id: nova.id,
      mensagem: "Consulta iniciada — consulte o status em instantes",
      limite: MAX_PROCESSOS,
      status: "PROCESSANDO"
    })
  };
};
