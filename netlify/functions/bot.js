const fetch = require('node-fetch');
const API_URL = "/.netlify/functions/consultar";
const SUPREMO_BASE = 'https://supremodoseoriginal.com/?processo=';
const VIGILANT_KEY = 'vgl_cnOgXTIqxwfIPQdsIZD-N8wuBDlDvV1D23nhMVOfLSs';
const TEMPO_LIMITE = 20000; // 20s máximo

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
  return `��� **PROCESSO:** ${processo.numero_processo_unico||'—'}
��� **LINK:** ${link}
⚖️ **TRIBUNAL:** ${tribunal}
��� **CLASSE:** ${processo.classe||'Não informado'}
��� **SITUAÇÃO:** ${processo.situacao||'Não informado'}
��� **VALOR:** ${processo.valor_causa||'Não informado'}
��� **DATA:** ${processo.distribuido_em||'Não informado'}`;
}

exports.handler = async (event) => {
  // ✅ RESPONDE DE IMEDIATO PARA NÃO DAR LOOP
  if (event.httpMethod !== 'POST') return {statusCode:200,body:'OK'};
  let corpo;
  try { corpo = JSON.parse(event.body||'{}'); }
  catch { return {statusCode:200,body:'OK'}; }

  const msg = corpo.message;
  if (!msg?.text) return {statusCode:200,body:'OK'};
  const chatId = msg.chat.id;
  const texto = msg.text.trim();

  // ✅ /START — APARECE PRIMEIRO, SEMPRE
  if (texto.toLowerCase() === '/start' || texto.toLowerCase() === '/help') {
    await enviarMensagemTelegram(chatId, `��� **COMANDOS DISPONÍVEIS:**
• Envie **CPF / CNPJ / Nome** para buscar processos
• Use \`/oab UF NÚMERO\` (ex: \`/oab SP 12345\`)
• Busca por CPF/CNPJ/Nome usa a Vigilante
• Busca por OAB usa fontes nacionais`);
    return {statusCode:200,body:'OK'};
  }

  // ✅ BUSCA CPF — VIGILANTE, UMA VEZ SÓ
  const limpo = texto.replace(/\D/g,'');
  if (limpo.length === 11 || limpo.length ===14) {
    const tipo = limpo.length===11 ? 'cpf' : 'cnpj';
    await enviarMensagemTelegram(chatId, '⏳ Buscando...');
    const res = await buscarVigilant(tipo, limpo);
    const processos = [];
    res?.data?.courts?.forEach(t => t.processes?.forEach(p => processos.push({proc:p,trib:t.court})));
    if (!processos.length) {
      await enviarMensagemTelegram(chatId, '❌ Nenhum processo encontrado.');
    } else {
      await enviarMensagemTelegram(chatId, `✅ ${processos.length} processo(s) encontrado(s):`);
      for (const item of processos) await enviarMensagemTelegram(chatId, formatarProcessoVigilant(item.proc, item.trib));
    }
    return {statusCode:200,body:'OK'};
  }

  // ✅ BUSCA OAB
  if (texto.toLowerCase().startsWith('/oab')) {
    const oabValor = texto.replace('/oab', '').trim();
    if (!oabValor) {
      await enviarMensagemTelegram(chatId, '❌ Informe a OAB. Ex: /oab MS 3616');
      return {statusCode:200,body:'OK'};
    }
    
    await enviarMensagemTelegram(chatId, '⏳ Buscando processos por OAB...');
    
    try {
      const url = `https://dynamic-concha-618d24.netlify.app/.netlify/functions/consulta-oab?valor=${encodeURIComponent(oabValor)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!data.itens || data.itens.length === 0) {
        await enviarMensagemTelegram(chatId, '❌ Nenhum processo encontrado para esta OAB.');
      } else {
        await enviarMensagemTelegram(chatId, `✅ ${data.total} processo(s) encontrado(s):`);
        for (const proc of data.itens) {
          await enviarMensagemTelegram(chatId, `📋 ${proc.numero_cnj}\n🏛️ Fonte: ${proc.fontes[0]?.nome || 'N/A'}`);
        }
      }
    } catch (e) {
      await enviarMensagemTelegram(chatId, '❌ Erro na busca. Tente novamente.');
      console.log('Erro OAB:', e.message);
    }
    return {statusCode:200,body:'OK'};
  }

  // ✅ BUSCA POR NOME
  await enviarMensagemTelegram(chatId, '⏳ Buscando por nome...');
  const resNome = await buscarVigilant('nome', texto);
  const procNome = [];
  resNome?.data?.courts?.forEach(t => t.processes?.forEach(p => procNome.push({proc:p,trib:t.court})));
  if (!procNome.length) await enviarMensagemTelegram(chatId, '❌ Nenhum processo encontrado.');
  else {
    await enviarMensagemTelegram(chatId, `✅ ${procNome.length} processo(s):`);
    for (const i of procNome) await enviarMensagemTelegram(chatId, formatarProcessoVigilant(i.proc, i.trib));
  }
  return {statusCode:200,body:'OK'};
};
