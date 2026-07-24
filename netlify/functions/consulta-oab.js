const { limparOAB, separarOAB } = require('../utils/validar');
const banco = require('../utils/banco');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const CONFIG = {
  MAX_TOTAL: 200,
  LIMITE_POR_FONTE: 50,
  TIMEOUT: { TJSP:15000, TJMS:15000, TJMG:10000, DataJud:20000 }
};

// ‚ö†Ô∏è COM TENTATIVA NOVAMENTE SE FALHAR
async function avisarTelegram(chatId, texto, tentativa=1) {
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
      timeout: 10000
    });
  } catch (e) {
    if (tentativa < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return avisarTelegram(chatId, texto, tentativa+1);
    }
    console.log(`Falha Telegram: ${e.message}`);
  }
}

async function enviarArquivoFinal(chatId, nome, conteudo, tentativa=1) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
      method: 'POST',
      body: `----ARQ----
Content-Disposition: form-data; name="chat_id"

${chatId}
----ARQ----
Content-Disposition: form-data; name="document"; filename="${nome}"

${conteudo}
----ARQ----`,
      timeout: 15000
    });
  } catch {
    if (tentativa < 3) {
      await new Promise(r => setTimeout(r, 3000));
      return enviarArquivoFinal(chatId, nome, conteudo, tentativa+1);
    }
  }
}

const buscarUmaVez = async (fn, nome, args, chatId) => {
  try {
    console.log(`Ì¥ç ${nome} ‚Äî iniciando`);
    await avisarTelegram(chatId, `Ì¥ç Buscando no ${nome}...`);
    const res = await Promise.race([
      fn(...args),
      new Promise((_, r) => setTimeout(r, CONFIG.TIMEOUT[nome], []))
    ]);
    console.log(`‚úÖ ${nome} ‚Äî ${res?.length||0} encontrados`);
    await avisarTelegram(chatId, `‚úÖ ${nome}: ${res?.length||0} processos encontrados`);
    return res || [];
  } catch (e) {
    console.log(`‚ö†Ô∏è ${nome} ‚Äî falhou: ${e.message}`);
    await avisarTelegram(chatId, `‚ö†Ô∏è ${nome}: indispon√≠vel no momento`);
    return [];
  }
};

const processarRapido = async (id, oab, uf, num, chatId) => {
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
      const dados = await buscarUmaVez(fonte.fn, fonte.nome, fonte.args, chatId);
      dados.slice(0, CONFIG.LIMITE_POR_FONTE).forEach(add);
      await banco.atualizarConsulta(id, { total: unicos.size });
      await new Promise(r => setTimeout(r, 1000));
    }

    const lista = Array.from(unicos.values());
    const txt = `OAB: ${oab}\nTotal final: ${lista.length}\n\n` + lista.map((p,i) =>
      `${i+1}. ${p.numero} | ${p.tribunal||'Sem informa√ß√£o'}`
    ).join('\n');

    await banco.atualizarConsulta(id, { status: "CONCLU√çDA", processos: lista, txt });
    await avisarTelegram(chatId, `ÌøÅ **CONSULTA FINALIZADA!**\nTotal geral: ${lista.length} processos`);
    await enviarArquivoFinal(chatId, `consulta-${oab}.txt`, txt);

  } catch (erro) {
    await banco.atualizarConsulta(id, { status: "ERRO", erros: [`Geral: ${erro.message}`] });
    await avisarTelegram(chatId, `‚ùå Erro na consulta: ${erro.message}`);
  }
};

exports.handler = async ev => {
  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  const chatId = qs.chat_id || '';
  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);

  if (!numero || numero.length < 3) {
    return {statusCode:400, body:JSON.stringify({erro:"OAB inv√°lida"})};
  }

  await banco.pg.query(
    "DELETE FROM consultas WHERE oab=$1 AND status='PROCESSANDO' AND criado_em < NOW() - INTERVAL '90 SECONDS'",
    [oabLimpa]
  );

  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_TOTAL);
  if (res.duplicada) {
    return {statusCode:200, body:JSON.stringify({
      aviso:"J√° estou buscando essa OAB, j√° j√° te mostro tudo!",
      id: res.id,
      status:"PROCESSANDO"
    })};
  }

  await avisarTelegram(chatId, `Ì¥ç **INICIANDO CONSULTA PARA OAB ${oabLimpa}**\nVou te avisando cada passo...`);
  processarRapido(res.id, oabLimpa, uf, numero, chatId).catch(e=>console.log(`Erro ${res.id}: ${e.message}`));

  return {statusCode:202, body:JSON.stringify({
    id: res.id,
    status:"PROCESSANDO",
    mensagem:"Estou buscando, em instantes te aviso cada resultado!"
  })};
};
