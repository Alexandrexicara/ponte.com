const fetch = require('node-fetch');
const SUPREMO_BASE = 'https://supremodoseoriginal.com/?processo=';
const VIGILANT_KEY = 'vgl_cnOgXTIqxwfIPQdsIZD-N8wuBDlDvV1D23nhMVOfLSs';
const TEMPO_LIMITE = 20000;
const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const BASE_NOSSA = 'https://dynamic-concha-618d24.netlify.app/.netlify/functions';

async function enviarMensagemTelegram(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
  });
}

async function enviarArquivo(chatId, nome, conteudo) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
    method: 'POST',
    body: `----ARQ----
Content-Disposition: form-data; name="chat_id"

${chatId}
----ARQ----
Content-Disposition: form-data; name="document"; filename="${nome}"

${conteudo}
----ARQ----`
  });
}

async function buscarVigilant(tipo, valor) {
  try {
    return await fetch(`https://api.vigilant.com.br/v1/${tipo}/${encodeURIComponent(valor)}/processos`, {
      headers: { 'Authorization': `Bearer ${VIGILANT_KEY}` }
    }).then(r => r.json());
  } catch { return { data: { courts: [] } }; }
}

function formatarProcessoVigilant(processo, tribunal) {
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_processo_unico||'');
  return `Ì≥å **PROCESSO:** ${processo.numero_processo_unico||'‚Äî'}
Ì¥ó **LINK:** ${link}
‚öñÔ∏è **TRIBUNAL:** ${tribunal}
Ì≥ë **CLASSE:** ${processo.classe||'N√£o informado'}
Ì≥ä **SITUA√á√ÉO:** ${processo.situacao||'N√£o informado'}
Ì≤∞ **VALOR:** ${processo.valor_causa||'N√£o informado'}
Ì≥Ö **DATA:** ${processo.distribuido_em||'N√£o informado'}`;
}

async function acompanharConsulta(chatId, idConsulta, tentativa = 1) {
  if (tentativa > 8) {
    return enviarMensagemTelegram(chatId, '‚è≥ Demorou mais que o esperado.');
  }
  try {
    const res = await fetch(`${BASE_NOSSA}/status-consulta?id=${encodeURIComponent(idConsulta)}`);
    if (res.headers.get('content-type')?.includes('text/plain')) {
      const txt = await res.text();
      await enviarMensagemTelegram(chatId, '‚úÖ **CONSULTA FINALIZADA!**');
      return enviarArquivo(chatId, `consulta-${idConsulta}.txt`, txt);
    }
    const dados = await res.json();
    if (dados.status === 'PROCESSANDO') {
      await new Promise(r => setTimeout(r, 15000));
      return acompanharConsulta(chatId, idConsulta, tentativa + 1);
    }
    if (dados.status === 'CONCLU√çDA') {
      await enviarMensagemTelegram(chatId, `‚úÖ **FINALIZADO!**\nTotal: ${dados.total || 0}`);
      if (dados.txt) return enviarArquivo(chatId, `consulta-${idConsulta}.txt`, dados.txt);
    }
  } catch {
    await new Promise(r => setTimeout(r, 15000));
    return acompanharConsulta(chatId, idConsulta, tentativa + 1);
  }
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
    await enviarMensagemTelegram(chatId, `Ì≥ã **COMANDOS:**
‚Ä¢ CPF/CNPJ/Nome ‚Üí busca direta
‚Ä¢ /oab UF N√öMERO ‚Üí ex: /oab MS 3616
‚Ä¢ Resultado chega automaticamente!`);
    return {statusCode:200,body:'OK'};
  }

  const limpo = texto.replace(/\D/g,'');
  if (limpo.length === 11 || limpo.length ===14) {
    const tipo = limpo.length===11 ? 'cpf' : 'cnpj';
    await enviarMensagemTelegram(chatId, '‚è≥ Buscando...');
    const res = await buscarVigilant(tipo, limpo);
    const processos = [];
    res?.data?.courts?.forEach(t => t.processes?.forEach(p => processos.push({proc:p,trib:t.court})));
    if (!processos.length) await enviarMensagemTelegram(chatId, '‚ùå Nenhum processo encontrado.');
    else {
      await enviarMensagemTelegram(chatId, `‚úÖ ${processos.length} processo(s):`);
      for (const i of processos) await enviarMensagemTelegram(chatId, formatarProcessoVigilant(i.proc, i.trib));
    }
    return {statusCode:200,body:'OK'};
  }

  if (texto.toLowerCase().startsWith('/oab')) {
    const oabValor = texto.replace('/oab', '').trim();
    if (!oabValor) return enviarMensagemTelegram(chatId, '‚ùå Ex: /oab MS 3616'), {statusCode:200,body:'OK'};
    await enviarMensagemTelegram(chatId, 'Ì¥ç Iniciando consulta...');
    try {
      const res = await fetch(`${BASE_NOSSA}/consulta-oab?valor=${encodeURIComponent(oabValor)}`);
      const dados = await res.json();
      if (dados.erro) return enviarMensagemTelegram(chatId, `‚ùå ${dados.erro}`), {statusCode:200,body:'OK'};
      if (dados.aviso) await enviarMensagemTelegram(chatId, `‚ö†Ô∏è ${dados.aviso}`);
      else await enviarMensagemTelegram(chatId, `‚úÖ Consulta iniciada!\nÌ∂î ID: ${dados.id}`);
      acompanharConsulta(chatId, dados.id).catch(e => console.log('Erro:', e.message));
    } catch { await enviarMensagemTelegram(chatId, '‚ùå Erro ao iniciar.'); }
    return {statusCode:200,body:'OK'};
  }

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
