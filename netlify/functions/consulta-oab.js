const { limparOAB, separarOAB } = require('../utils/validar');
const { criarConsulta, atualizarConsulta } = require('../utils/fila');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');

const MAX_PROCESSOS = 200;
const MAX_TENTATIVAS = 3;

// Função com tentativas automáticas
const buscarComTentativas = async (funcao, nome, args, consultaId) => {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      console.log(`[${consultaId}] ${nome} — tentativa ${tentativa}`);
      const res = await Promise.race([
        funcao(...args),
        new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout")), 20000))
      ]);
      return { sucesso: true, nome, dados: res };
    } catch (erro) {
      console.log(`[${consultaId}] ${nome} — falha ${tentativa}: ${erro.message}`);
      if (tentativa < MAX_TENTATIVAS) await new Promise(r => setTimeout(r, 2000));
    }
  }
  return { sucesso: false, nome, erro: "Todas tentativas falharam" };
};

// Execução em segundo plano — não bloqueia a resposta
const processarConsulta = async (id, oab, uf, numero) => {
  const processosUnicos = new Map();
  const adicionar = (p) => p?.numero && !processosUnicos.has(p.numero) && processosUnicos.set(p.numero, p);

  const fontes = [
    { fn: tjsp, nome: "TJSP", args: [oab] },
    { fn: tjms, nome: "TJMS", args: [oab] },
    { fn: tjmg, nome: "TJMG", args: [oab] },
    { fn: datajud, nome: "DataJud", args: [{ uf, numeroOAB: numero }] }
  ];

  for (const fonte of fontes) {
    if (processosUnicos.size >= MAX_PROCESSOS) break;
    atualizarConsulta(id, { etapa: `BUSCANDO ${fonte.nome}` });
    
    const res = await buscarComTentativas(fonte.fn, fonte.nome, fonte.args, id);
    if (res.sucesso) res.dados.forEach(adicionar);
    else atualizarConsulta(id, { erros: [...(buscarConsulta(id).erros || []), `${res.nome}: ${res.erro}`] });

    atualizarConsulta(id, { total: processosUnicos.size });
  }

  // Gera TXT final
  const lista = Array.from(processosUnicos.values());
  let txt = `==================================\nCONSULTA OAB\n==================================\nOAB: ${oab}\nData: ${new Date().toLocaleDateString('pt-BR')}\nTotal: ${lista.length}\n\n`;
  lista.forEach((p, i) => {
    txt += `PROCESSO ${String(i+1).padStart(3,'0')}\nCNJ: ${p.numero}\nTribunal: ${p.tribunal}\nClasse: ${p.classe}\nAssunto: ${p.assunto}\nData: ${p.data}\n\n`;
  });

  atualizarConsulta(id, {
    status: "CONCLUÍDA",
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

  const id = criarConsulta(oabLimpa, MAX_PROCESSOS);
  
  // LIBERA A RESPOSTA AGORA — O RESTO CONTINUA RODANDO
  processarConsulta(id, oabLimpa, uf, numero).catch(e => console.log(`Erro na fila ${id}: ${e.message}`));

  return {
    statusCode: 202,
    body: JSON.stringify({
      id,
      mensagem: "Consulta iniciada — aguarde alguns instantes e consulte o status",
      limite: MAX_PROCESSOS,
      status: "PROCESSANDO"
    })
  };
};
