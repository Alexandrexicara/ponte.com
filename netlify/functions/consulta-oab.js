const { limparOAB, separarOAB } = require('../utils/validar');
const banco = require('../utils/banco');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');

const CONFIG = {
  MAX_PROCESSOS: 200,
  MAX_TENTATIVAS: 3,
  LOTE_TAMANHO: 2, // 2 fontes por vez = evita bloqueio
  LOTE_ESPERA: 1500,
  TIMEOUT: { TJSP:20000, TJMS:20000, TJMG:15000, DataJud:25000 }
};

const buscarComRetry = async (fn, nome, args, id) => {
  for (let t=1; t<=CONFIG.MAX_TENTATIVAS; t++) {
    try {
      console.log(`[${id}] ${nome} tentativa ${t}`);
      const res = await Promise.race([fn(...args), new Promise((_,r)=>setTimeout(r, CONFIG.TIMEOUT[nome], new Error("Timeout")))]);
      return {ok:true, dados:res};
    } catch (e) {
      console.log(`[${id}] ${nome} falha ${t}: ${e.message}`);
      if (t<CONFIG.MAX_TENTATIVAS) await new Promise(r=>setTimeout(r, 1200));
    }
  }
  return {ok:false, erro:"Indisponível"};
};

const processar = async (id, oab, uf, num) => {
  const unicos = new Map();
  const add = p => p?.numero && !unicos.has(p.numero) && unicos.set(p.numero, p);
  const fontes = [
    {fn:tjsp, nome:"TJSP", args:[oab]},
    {fn:tjms, nome:"TJMS", args:[oab]},
    {fn:tjmg, nome:"TJMG", args:[oab]},
    {fn:datajud, nome:"DataJud", args:[{uf, numeroOAB:num}]}
  ];

  for (let i=0; i<fontes.length && unicos.size<CONFIG.MAX_PROCESSOS; i+=CONFIG.LOTE_TAMANHO) {
    const lote = fontes.slice(i, i+CONFIG.LOTE_TAMANHO);
    await Promise.all(lote.map(async f => {
      const res = await buscarComRetry(f.fn, f.nome, f.args, id);
      if (res.ok) res.dados.forEach(add);
      else await banco.atualizarConsulta(id, { erros: [`${f.nome}: ${res.erro}`] });
    }));
    await banco.atualizarConsulta(id, { total: unicos.size, status: unicos.size?"PARCIAL":"PROCESSANDO" });
    await new Promise(r=>setTimeout(r, CONFIG.LOTE_ESPERA));
  }

  const lista = Array.from(unicos.values());
  let txt = `CONSULTA OAB ${oab}\nData: ${new Date().toLocaleDateString()}\nTotal: ${lista.length}\n\n`;
  lista.forEach((p,i)=>txt+=`PROC ${i+1}\nCNJ:${p.numero}\nTJ:${p.tribunal}\nClasse:${p.classe}\n\n`);
  
  await banco.atualizarConsulta(id, { status:"CONCLUÍDA", processos:lista, txt });
  console.log(`[${id}] FINALIZADO — ${lista.length} processos`);
};

exports.handler = async ev => {
  const {valor} = ev.queryStringParameters||{};
  const oab = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);
  if (!numero) return {statusCode:400, body:JSON.stringify({erro:"OAB inválida"})};

  const res = await banco.criarConsulta(oab, CONFIG.MAX_PROCESSOS);
  if (res.duplicada) return {statusCode:200, body:JSON.stringify({aviso:"Já em processamento", id:res.id, status:"PROCESSANDO"})};

  processar(res.id, oab, uf, numero).catch(e=>console.log(`ERRO ${res.id}: ${e.message}`));
  return {statusCode:202, body:JSON.stringify({id:res.id, status:"PROCESSANDO", limite:CONFIG.MAX_PROCESSOS})};
};
