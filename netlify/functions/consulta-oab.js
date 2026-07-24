const { limparOAB, separarOAB } = require('../utils/validar');
const banco = require('../utils/banco');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');

const CONFIG = {
  MAX_PROCESSOS: 200,
  MAX_TENTATIVAS: 3,
  LOTE_TAMANHO: 2,
  LOTE_ESPERA: 1500,
  TIMEOUT: { TJSP:18000, TJMS:18000, TJMG:12000, DataJud:22000 }
};

const buscarComRetry = async (fn, nome, args) => {
  for (let t=1; t<=CONFIG.MAX_TENTATIVAS; t++) {
    try {
      const res = await Promise.race([
        fn(...args),
        new Promise((_,r)=>setTimeout(r, CONFIG.TIMEOUT[nome], new Error("Timeout")))
      ]);
      return {ok:true, dados:res};
    } catch (e) {
      if (t<CONFIG.MAX_TENTATIVAS) await new Promise(r=>setTimeout(r,1000));
    }
  }
  return {ok:false, erro:"Indisponível"};
};

// FUNÇÃO DE PROCESSAMENTO — NÃO BLOQUEIA A RESPOSTA
const processarAsync = async (id, oab, uf, num) => {
  try {
    const unicos = new Map();
    const add = p => p?.numero && !unicos.has(p.numero) && unicos.set(p.numero,p);

    const fontes = [
      {fn:tjsp, nome:"TJSP", args:[oab]},
      {fn:tjms, nome:"TJMS", args:[oab]},
      {fn:tjmg, nome:"TJMG", args:[oab]},
      {fn:datajud, nome:"DataJud", args:[{uf, numeroOAB:num}]}
    ];

    for (let i=0; i<fontes.length && unicos.size<CONFIG.MAX_PROCESSOS; i+=CONFIG.LOTE_TAMANHO) {
      const lote = fontes.slice(i, i+CONFIG.LOTE_TAMANHO);
      await Promise.all(lote.map(async f=>{
        const res = await buscarComRetry(f.fn,f.nome,f.args);
        if (res.ok) res.dados.forEach(add);
        else await banco.atualizarConsulta(id, {erros:[`${f.nome}: ${res.erro}`]});
      }));
      await banco.atualizarConsulta(id, {total:unicos.size, status:"PARCIAL"});
      await new Promise(r=>setTimeout(r,CONFIG.LOTE_ESPERA));
    }

    const lista = Array.from(unicos.values());
    let txt = `CONSULTA OAB ${oab}\nData: ${new Date().toLocaleDateString()}\nTotal: ${lista.length}\n\n`;
    lista.forEach((p,i)=>txt+=`PROC ${i+1}\nCNJ:${p.numero}\nTJ:${p.tribunal}\nClasse:${p.classe}\n\n`);
    await banco.atualizarConsulta(id, {status:"CONCLUÍDA", processos:lista, txt});
  } catch (erro) {
    await banco.atualizarConsulta(id, {status:"ERRO", erros:[`Falha geral: ${erro.message}`]});
  }
};

exports.handler = async ev => {
  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);

  if (!numero || numero.length<3) {
    return {statusCode:400, body:JSON.stringify({erro:"OAB inválida"})};
  }

  // LIMPA CONSULTAS ANTIGAS TRAVADAS DA MESMA OAB
  await banco.pg.query("DELETE FROM consultas WHERE oab = $1 AND status = 'PROCESSANDO' AND criado_em < NOW() - INTERVAL '2 MINUTES'", [oabLimpa]);

  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_PROCESSOS);
  if (res.duplicada) {
    return {statusCode:200, body:JSON.stringify({aviso:"Já buscando — aguarde 1min e consulte status", id:res.id, status:"PROCESSANDO"})};
  }

  // INICIA E RESPONDE LOGO — O RESTO RODA ATÉ ACABAR
  processarAsync(res.id, oabLimpa, uf, numero).catch(e=>console.log(`Erro ${res.id}: ${e.message}`));

  return {statusCode:202, body:JSON.stringify({id:res.id, status:"PROCESSANDO", limite:CONFIG.MAX_PROCESSOS})};
};
