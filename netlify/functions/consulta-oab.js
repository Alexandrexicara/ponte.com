const { limparOAB, separarOAB } = require('../utils/validar');
const banco = require('../utils/banco');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const CHAT_ID_TEMP = process.env.CHAT_ID_DESTINO || ''; // O bot vai passar esse valor

const CONFIG = {
  MAX_TOTAL: 200,
  LIMITE_POR_FONTE: 50,
  TIMEOUT: { TJSP:8000, TJMS:8000, TJMG:5000, DataJud:15000 }
};

async function avisarTelegram(chatId, texto) {
  if (!chatId) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
  }).catch(()=>{});
}

const buscarUmaVez = async (fn, nome, args, chatId) => {
  try {
    console.log(`í´ ${nome} â€” iniciando`);
    await avisarTelegram(chatId, `í´ Buscando no ${nome}...`);
    const res = await Promise.race([
      fn(...args),
      new Promise((_, r) => setTimeout(r, CONFIG.TIMEOUT[nome], []))
    ]);
    console.log(`âœ… ${nome} â€” ${res?.length||0} encontrados`);
    await avisarTelegram(chatId, `âœ… ${nome}: ${res?.length||0} processos encontrados`);
    return res || [];
  } catch (e) {
    console.log(`âš ï¸ ${nome} â€” falhou: ${e.message}`);
    await avisarTelegram(chatId, `âš ï¸ ${nome}: indisponÃ­vel no momento`);
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
      await new Promise(r => setTimeout(r, 800));
    }

    const lista = Array.from(unicos.values());
    const txt = `OAB: ${oab}\nTotal final: ${lista.length}\n\n` + lista.map((p,i) =>
      `${i+1}. ${p.numero} | ${p.tribunal||'Sem info'}`
    ).join('\n');

    await banco.atualizarConsulta(id, { status: "CONCLUÃDA", processos: lista, txt });
    await avisarTelegram(chatId, `í¿ **CONSULTA FINALIZADA!**\nTotal geral: ${lista.length} processos`);

    // Envia o arquivo TXT no final
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
      method: 'POST',
      body: `----ARQ----
Content-Disposition: form-data; name="chat_id"

${chatId}
----ARQ----
Content-Disposition: form-data; name="document"; filename="consulta-${oab}.txt"

${txt}
----ARQ----`
    }).catch(()=>{});

  } catch (erro) {
    await banco.atualizarConsulta(id, { status: "ERRO", erros: [`Geral: ${erro.message}`] });
    await avisarTelegram(chatId, `âŒ Erro na consulta: ${erro.message}`);
  }
};

exports.handler = async ev => {
  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  const chatId = qs.chat_id || ''; // Recebe o ID do chat do Telegram
  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);

  if (!numero || numero.length < 3) {
    return {statusCode:400, body:JSON.stringify({erro:"OAB invÃ¡lida"})};
  }

  await banco.pg.query(
    "DELETE FROM consultas WHERE oab=$1 AND status='PROCESSANDO' AND criado_em < NOW() - INTERVAL '90 SECONDS'",
    [oabLimpa]
  );

  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_TOTAL);
  if (res.duplicada) {
    return {statusCode:200, body:JSON.stringify({
      aviso:"JÃ¡ estou buscando essa OAB, jÃ¡ jÃ¡ te mostro tudo!",
      id: res.id,
      status:"PROCESSANDO"
    })};
  }

  // Avisa o cliente que comeÃ§ou
  await avisarTelegram(chatId, `í´ **INICIANDO CONSULTA PARA OAB ${oabLimpa}**\nVou te avisando cada passo...`);

  // Inicia o processamento e jÃ¡ responde â€” avisos vÃ£o chegando sozinhos
  processarRapido(res.id, oabLimpa, uf, numero, chatId).catch(e=>console.log(`Erro ${res.id}: ${e.message}`));

  return {statusCode:202, body:JSON.stringify({
    id: res.id,
    status:"PROCESSANDO",
    mensagem:"Estou buscando, em instantes te aviso cada resultado!"
  })};
};
