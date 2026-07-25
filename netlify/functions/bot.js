const fetch = require('node-fetch');
const SUPREMO_BASE = 'https://supremodoseoriginal.com/?processo=';
const VIGILANT_KEY = 'vgl_cnOgXTIqxwfIPQdsIZD-N8wuBDlDvV1D23nhMVOfLSs';
const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const BASE_NOSSA = 'https://dynamic-concha-618d24.netlify.app/.netlify/functions';

async function enviarMensagemTelegram(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
  }).catch(()=>{});
}

async function buscarVigilant(tipo, valor) {
  try {
    // âœ… CHAMA UMA VEZ SÃ“ â€” SEM TENTATIVAS INFINITAS
    const res = await fetch(`https://api.vigilant.com.br/v1/${tipo}/${encodeURIComponent(valor)}/processos`, {
      headers: { 'Authorization': `Bearer ${VIGILANT_KEY}` },
      timeout: 15000 // 15s mÃ¡ximo â€” para se demorar muito
    });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return await res.json();
  } catch (erro) {
    console.log(`Vigilant ${tipo}: ${erro.message}`);
    return { data: { courts: [] } };
  }
}

function formatarProcessoVigilant(processo, tribunal) {
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_processo_unico||'');
  return `í³Œ **PROCESSO:** ${processo.numero_processo_unico||'â€”'}
í´— **LINK:** ${link}
âš–ï¸ **TRIBUNAL:** ${tribunal}
í³‘ **CLASSE:** ${processo.classe||'NÃ£o informado'}
í³Š **SITUAÃ‡ÃƒO:** ${processo.situacao||'NÃ£o informado'}
í²° **VALOR:** ${processo.valor_causa||'NÃ£o informado'}
í³… **DATA:** ${processo.distribuido_em||'NÃ£o informado'}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return {statusCode:200,body:'OK'};
  let corpo;
  try { corpo = JSON.parse(event.body||'{}'); }
  catch { return {statusCode:200,body:'OK'}; }

  const msg = corpo.message;
  if (!msg?.text) return {statusCode:200,body:'OK'};
  const chatId = msg.chat.id;
  const texto = msg.text.trim();

  if (texto.toLowerCase() === '/start' || texto.toLowerCase() === '/help') {
    await enviarMensagemTelegram(chatId, `í³‹ **COMANDOS:**
â€¢ CPF / CNPJ / Nome â†’ busca direta na Vigilant
â€¢ /oab UF NÃšMERO â†’ busca nos tribunais
â€¢ Resultado vem na hora, sem repetiÃ§Ã£o!`);
    return {statusCode:200,body:'OK'};
  }

  // âœ… BUSCA CPF/CNPJ â€” UMA VEZ SÃ“, SEM LOOP
  const limpo = texto.replace(/\D/g,'');
  if (limpo.length === 11 || limpo.length === 14) {
    const tipo = limpo.length === 11 ? 'cpf' : 'cnpj';
    await enviarMensagemTelegram(chatId, 'â³ Buscando na Vigilant...');
    
    const res = await buscarVigilant(tipo, limpo);
    const processos = [];
    res?.data?.courts?.forEach(t => t.processes?.forEach(p => processos.push({proc:p,trib:t.court})));

    if (!processos.length) {
      await enviarMensagemTelegram(chatId, 'âŒ Nenhum processo encontrado.');
    } else {
      await enviarMensagemTelegram(chatId, `âœ… ${processos.length} processo(s) encontrado(s):`);
      for (const item of processos) {
        await enviarMensagemTelegram(chatId, formatarProcessoVigilant(item.proc, item.trib));
        await new Promise(r => setTimeout(r, 300)); // pequena pausa para nÃ£o travar o Telegram
      }
    }
    return {statusCode:200,body:'OK'};
  }

  // âœ… BUSCA POR NOME â€” UMA VEZ SÃ“, SEM REPETIR
  await enviarMensagemTelegram(chatId, 'â³ Buscando por nome na Vigilant...');
  const resNome = await buscarVigilant('nome', texto);
  const procNome = [];
  resNome?.data?.courts?.forEach(t => t.processes?.forEach(p => procNome.push({proc:p,trib:t.court})));

  if (!procNome.length) {
    await enviarMensagemTelegram(chatId, 'âŒ Nenhum processo encontrado para esse nome.');
  } else {
    await enviarMensagemTelegram(chatId, `âœ… ${procNome.length} processo(s) encontrado(s):`);
    for (const i of procNome) {
      await enviarMensagemTelegram(chatId, formatarProcessoVigilant(i.proc, i.trib));
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return {statusCode:200,body:'OK'};
};
