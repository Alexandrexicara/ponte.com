const fetch = require('node-fetch');
const API_URL = "/.netlify/functions/consultar";
const SUPREMO_BASE = 'https://supremodoseoriginal.com/?processo=';
const VIGILANT_KEY = 'vgl_cnOgXTIqxwfIPQdsIZD-N8wuBDlDvV1D23nhMVOfLSs';
const TEMPO_LIMITE = 20000; // 20s m√°ximo

const cabecalhos = { 'Content-Type': 'application/json' };
const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';

async function enviarMensagemTelegram(chatId, texto) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
  });
}

async function buscarVigilant(tipo, valor) {
  try {
    const url = `https://api.vigilant.com.br/v1/${tipo}/${encodeURIComponent(valor)}/processos`;
    return await fetch(url, {
      headers: { 'Authorization': `Bearer ${VIGILANT_KEY}` },
      timeout: TEMPO_LIMITE
    }).then(r => r.json());
  } catch { return { data: { courts: [] } }; }
}

function formatarProcessoVigilant(processo, tribunal) {
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_processo_unico||'');
  return `Ì≥ã **PROCESSO:** ${processo.numero_processo_unico||'‚Äî'}
Ì¥ó **LINK:** ${link}
‚öñÔ∏è **TRIBUNAL:** ${tribunal}
Ì≥Ç **CLASSE:** ${processo.classe||'N√£o informado'}
Ì≥å **SITUA√á√ÉO:** ${processo.situacao||'N√£o informado'}
Ì≤∞ **VALOR:** ${processo.valor_causa||'N√£o informado'}
Ì≥Ö **DATA:** ${processo.distribuido_em||'N√£o informado'}`;
}

exports.handler = async (event) => {
  // ‚úÖ RESPONDE DE IMEDIATO PARA N√ÉO DAR LOOP
  if (event.httpMethod !== 'POST') return {statusCode:200,body:'OK'};
  let corpo;
  try { corpo = JSON.parse(event.body||'{}'); }
  catch { return {statusCode:200,body:'OK'}; }

  const msg = corpo.message;
  if (!msg?.text) return {statusCode:200,body:'OK'};
  const chatId = msg.chat.id;
  const texto = msg.text.trim();

  // ‚úÖ /START ‚Äî APARECE PRIMEIRO, SEMPRE
  if (texto.toLowerCase() === '/start' || texto.toLowerCase() === '/help') {
    await enviarMensagemTelegram(chatId, `Ì≥ã **COMANDOS DISPON√çVEIS:**
‚Ä¢ Envie **CPF / CNPJ / Nome** para buscar processos
‚Ä¢ Use \`/oab UF N√öMERO\` (ex: \`/oab SP 12345\`)
‚Ä¢ Busca por CPF/CNPJ/Nome usa a Vigilante
‚Ä¢ Busca por OAB usa fontes nacionais`);
    return {statusCode:200,body:'OK'};
  }

  // ‚úÖ BUSCA CPF ‚Äî VIGILANTE, UMA VEZ S√ì
  const limpo = texto.replace(/\D/g,'');
  if (limpo.length === 11 || limpo.length ===14) {
    const tipo = limpo.length===11 ? 'cpf' : 'cnpj';
    await enviarMensagemTelegram(chatId, '‚è≥ Buscando...');
    const res = await buscarVigilant(tipo, limpo);
    const processos = [];
    res?.data?.courts?.forEach(t => t.processes?.forEach(p => processos.push({proc:p,trib:t.court})));
    if (!processos.length) {
      await enviarMensagemTelegram(chatId, '‚ùå Nenhum processo encontrado.');
    } else {
      await enviarMensagemTelegram(chatId, `‚úÖ ${processos.length} processo(s) encontrado(s):`);
      for (const item of processos) await enviarMensagemTelegram(chatId, formatarProcessoVigilant(item.proc, item.trib));
    }
    return {statusCode:200,body:'OK'};
  }

  // ‚úÖ BUSCA OAB ‚Äî AVISA E PARA
  if (texto.toLowerCase().startsWith('/oab')) {
    await enviarMensagemTelegram(chatId, 'Ì¥ß Busca por OAB em desenvolvimento ‚Äî por enquanto use CPF/CNPJ/Nome.');
    return {statusCode:200,body:'OK'};
  }

  // ‚úÖ BUSCA POR NOME
  await enviarMensagemTelegram(chatId, '‚è≥ Buscando por nome...');
  const resNome = await buscarVigilant('nome', texto);
  const procNome = [];
  resNome?.data?.courts?.forEach(t => t.processes?.forEach(p => procNome.push({proc:p,trib:t.court})));
  if (!procNome.length) await enviarMensagemTelegram(chatId, '‚ùå Nenhum processo encontrado.');
  else {
    await enviarMensagemTelegram(chatId, `‚úÖ ${procNome.length} processo(s):`);
    for (const i of procNome) await enviarMensagemTelegram(chatId, formatarProcessoVigilant(i.proc, i.trib));
  }
  return {statusCode:200,body:'OK'};
};
