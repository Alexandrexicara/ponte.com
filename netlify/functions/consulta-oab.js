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
  TIMEOUT: { TJSP:20000, TJMS:20000, TJMG:15000, DataJud:25000 }
};

console.log("=== [DEBUG] ARQUIVO consulta-oab.js CARREGADO ===");

const buscarComRetry = async (fn, nome, args, id) => {
  console.log(`[${id}] [DEBUG] INICIANDO BUSCA: ${nome} | ARGS:`, args);
  for (let t=1; t<=CONFIG.MAX_TENTATIVAS; t++) {
    try {
      console.log(`[${id}] [DEBUG] ${nome} — tentativa ${t}/${CONFIG.MAX_TENTATIVAS}`);
      const res = await Promise.race([
        fn(...args),
        new Promise((_,r)=>setTimeout(r, CONFIG.TIMEOUT[nome], new Error("Timeout")))
      ]);
      console.log(`[${id}] [DEBUG] ${nome} — SUCESSO | ${res?.length || 0} itens`);
      return {ok:true, dados:res};
    } catch (e) {
      console.log(`[${id}] [ERRO] ${nome} — falha ${t}: ${e.message}`);
      if (t<CONFIG.MAX_TENTATIVAS) await new Promise(r=>setTimeout(r, 1200));
    }
  }
  console.log(`[${id}] [ERRO] ${nome} — TODAS TENTATIVAS FALHARAM`);
  return {ok:false, erro:"Indisponível"};
};

const processar = async (id, oab, uf, num) => {
  console.log(`[${id}] [DEBUG] INICIANDO PROCESSAMENTO | OAB:${oab} | UF:${uf} | Nº:${num}`);
  const unicos = new Map();
  const add = p => {
    if (p?.numero && !unicos.has(p.numero)) {
      unicos.set(p.numero, p);
      console.log(`[${id}] [DEBUG] PROCESSO ADICIONADO: ${p.numero}`);
    }
  };
  const fontes = [
    {fn:tjsp, nome:"TJSP", args:[oab]},
    {fn:tjms, nome:"TJMS", args:[oab]},
    {fn:tjmg, nome:"TJMG", args:[oab]},
    {fn:datajud, nome:"DataJud", args:[{uf, numeroOAB:num}]}
  ];

  for (let i=0; i<fontes.length && unicos.size<CONFIG.MAX_PROCESSOS; i+=CONFIG.LOTE_TAMANHO) {
    const lote = fontes.slice(i, i+CONFIG.LOTE_TAMANHO);
    console.log(`[${id}] [DEBUG] PROCESSANDO LOTE ${Math.floor(i/CONFIG.LOTE_TAMANHO)+1}:`, lote.map(f=>f.nome));
    
    await Promise.all(lote.map(async f => {
      const res = await buscarComRetry(f.fn, f.nome, f.args, id);
      if (res.ok) res.dados.forEach(add);
      else await banco.atualizarConsulta(id, { erros: [`${f.nome}: ${res.erro}`] });
    }));

    await banco.atualizarConsulta(id, { total: unicos.size, status: unicos.size?"PARCIAL":"PROCESSANDO" });
    console.log(`[${id}] [DEBUG] APÓS LOTE — TOTAL PARCIAL: ${unicos.size}`);
    await new Promise(r=>setTimeout(r, CONFIG.LOTE_ESPERA));
  }

  const lista = Array.from(unicos.values());
  console.log(`[${id}] [DEBUG] FINALIZADO — TOTAL FINAL: ${lista.length}`);
  
  let txt = `CONSULTA OAB ${oab}\nData: ${new Date().toLocaleDateString()}\nTotal: ${lista.length}\n\n`;
  lista.forEach((p,i)=>txt+=`PROC ${i+1}\nCNJ:${p.numero}\nTJ:${p.tribunal}\nClasse:${p.classe}\n\n`);
  
  await banco.atualizarConsulta(id, { status:"CONCLUÍDA", processos:lista, txt });
  console.log(`[${id}] [DEBUG] STATUS ATUALIZADO PARA CONCLUÍDA`);
};

exports.handler = async ev => {
  console.log("=== [DEBUG] REQUISIÇÃO RECEBIDA ===");
  console.log("[DEBUG] QUERY PARAMS:", ev.queryStringParameters);

  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  console.log("[DEBUG] VALOR BRUTO RECEBIDO:", valor);

  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);
  console.log(`[DEBUG] TRATADO → Limpo:"${oabLimpa}" | UF:"${uf}" | NÚMERO:"${numero}"`);

  if (!numero || numero.length < 3) {
    console.log("[ERRO] VALIDAÇÃO FALHOU — OAB INVÁLIDA");
    return {
      statusCode:400,
      body:JSON.stringify({
        erro:"OAB inválida",
        recebido: valor,
        limpo: oabLimpa,
        uf,
        numero,
        formato_correto: "MS3616 ou MS 3616"
      })
    };
  }

  console.log("[DEBUG] VALIDAÇÃO OK — CRIANDO CONSULTA");
  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_PROCESSOS);
  if (res.duplicada) {
    console.log(`[DEBUG] CONSULTA DUPLICADA — RETORNANDO ID:${res.id}`);
    return {statusCode:200, body:JSON.stringify({aviso:"Já em processamento", id:res.id, status:"PROCESSANDO"})};
  }

  console.log(`[DEBUG] CONSULTA CRIADA — ID:${res.id}`);
  processar(res.id, oabLimpa, uf, numero).catch(e=>console.log(`[ERRO GERAL] ${res.id}: ${e.message}`, e.stack));
  
  return {statusCode:202, body:JSON.stringify({id:res.id, status:"PROCESSANDO", limite:CONFIG.MAX_PROCESSOS})};
};
