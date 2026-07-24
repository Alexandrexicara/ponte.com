const { limparOAB, separarOAB } = require('../utils/validar');
const banco = require('../utils/banco');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');

const CONFIG = {
  MAX_TOTAL: 200,
  LIMITE_POR_FONTE: 50,
  TIMEOUT: { TJSP:8000, TJMS:8000, TJMG:5000, DataJud:15000 }
};

const buscarUmaVez = async (fn, nome, args) => {
  try {
    console.log(`��� ${nome} — iniciando`);
    const res = await Promise.race([
      fn(...args),
      new Promise((_, r) => setTimeout(r, CONFIG.TIMEOUT[nome], []))
    ]);
    console.log(`✅ ${nome} — ${res?.length||0} encontrados`);
    return res || [];
  } catch (e) {
    console.log(`⚠️ ${nome} — falhou: ${e.message}`);
    await banco.atualizarConsulta(id, {
      erros: [`${nome}: ${e.message.slice(0,80)}`]
    });
    return [];
  }
};

const processarRapido = async (id, oab, uf, num) => {
  try {
    const unicos = new Map();
    const add = p => p?.numero && !unicos.has(p.numero) && unicos.set(p.numero, p);

    const fontes = [
      {fn: tjsp, nome: "TJSP", args: [oab]},
      {fn: tjms, nome: "TJMS", args: [oab]},
      {fn: tjmg, nome: "TJMG", args: [oab]},
      {fn: datajud, nome: "DataJud", args: [{uf, numeroOAB:num}]}
    ];

    for (const fonte of fontes) {
      if (unicos.size >= CONFIG.MAX_TOTAL) break;

      const dados = await buscarUmaVez(fonte.fn, fonte.nome, fonte.args);
      dados.slice(0, CONFIG.LIMITE_POR_FONTE).forEach(add);

      await banco.atualizarConsulta(id, { total: unicos.size });
      await new Promise(r => setTimeout(r, 800));
    }

    const lista = Array.from(unicos.values());
    const txt = `OAB: ${oab}\nTotal: ${lista.length}\n\n` + lista.map((p,i) =>
      `${i+1}. ${p.numero} | ${p.tribunal||'Sem info'}`
    ).join('\n');

    await banco.atualizarConsulta(id, { status: "CONCLUÍDA", processos: lista, txt });
    console.log(`��� FINALIZADO — ${lista.length} processos`);

  } catch (erro) {
    await banco.atualizarConsulta(id, { status: "ERRO", erros: [`Geral: ${erro.message}`] });
  }
};

exports.handler = async ev => {
  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);

  if (!numero || numero.length < 3) {
    return {statusCode:400, body:JSON.stringify({erro:"OAB inválida"})};
  }

  // Limpa consultas antigas travadas
  await banco.pg.query(
    "DELETE FROM consultas WHERE oab=$1 AND status='PROCESSANDO' AND criado_em < NOW() - INTERVAL '90 SECONDS'",
    [oabLimpa]
  );

  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_TOTAL);
  if (res.duplicada) {
    return {statusCode:200, body:JSON.stringify({
      aviso:"Já buscando — aguarde ~1min e consulte status",
      id: res.id,
      status:"PROCESSANDO"
    })};
  }

  // Inicia e responde logo — não estoura 30s
  processarRapido(res.id, oabLimpa, uf, numero).catch(console.error);

  return {statusCode:202, body:JSON.stringify({
    id: res.id,
    status:"PROCESSANDO",
    limite: CONFIG.MAX_TOTAL
  })};
};
