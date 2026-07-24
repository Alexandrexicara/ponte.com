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
‚Ä¢ /status ID ‚Üí ver resultado final`);
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

  // === COMANDO /oab ===
  if (texto.toLowerCase().startsWith('/oab')) {
    const oabValor = texto.replace('/oab', '').trim();
    if (!oabValor) {
      await enviarMensagemTelegram(chatId, '‚ùå Ex: /oab MS 3616');
      return {statusCode:200,body:'OK'};
    }
    await enviarMensagemTelegram(chatId, 'Ì¥ç Iniciando consulta...');
    try {
      const res = await fetch(`${BASE_NOSSA}/consulta-oab?valor=${encodeURIComponent(oabValor)}`);
      const dados = await res.json();
      
      if (dados.erro) {
        await enviarMensagemTelegram(chatId, `‚ùå ${dados.erro}`);
      } else if (dados.aviso) {
        await enviarMensagemTelegram(chatId, `‚ö†Ô∏è ${dados.aviso}`);
      } else {
        await enviarMensagemTelegram(chatId, `‚úÖ Consulta iniciada com sucesso!
Ì∂î ID: ${dados.id}
‚è≥ Aguarde cerca de 1 minuto, depois use:
/status ${dados.id}`);
      }
    } catch {
      await enviarMensagemTelegram(chatId, '‚ùå Erro ao iniciar a consulta.');
    }
    return {statusCode:200,body:'OK'};
  }

  // === COMANDO /status ===
  if (texto.toLowerCase().startsWith('/status')) {
    const id = texto.replace('/status','').trim();
    if (!id) {
      await enviarMensagemTelegram(chatId, '‚ùå Informe o ID. Ex: /status MS3616-123456');
      return {statusCode:200,body:'OK'};
    }
    await enviarMensagemTelegram(chatId, 'Ì¥ç Buscando resultado...');
    try {
      const res = await fetch(`${BASE_NOSSA}/status-consulta?id=${encodeURIComponent(id)}`);
      
      if (res.headers.get('content-type')?.includes('text/plain')) {
        const txt = await res.text();
        await enviarMensagemTelegram(chatId, '‚úÖ **CONSULTA FINALIZADA!**');
        await enviarArquivo(chatId, `consulta-${id}.txt`, txt);
      } else {
        const d = await res.json();
        if (d.status === 'PROCESSANDO') {
          await enviarMensagemTelegram(chatId, `‚è≥ Ainda processando...
Ì∂î ${d.id}
Ì≥ä Encontrados at√© agora: ${d.total || 0}`);
        } else if (d.status === 'CONCLU√çDA') {
          await enviarMensagemTelegram(chatId, `‚úÖ **FINALIZADO!**
Ì∂î ${d.id}
Ì≥Ñ Total de processos: ${d.total || 0}`);
        } else {
          await enviarMensagemTelegram(chatId, `‚ùå ${d.erro || 'Consulta n√£o encontrada'}`);
        }
      }
    } catch {
      await enviarMensagemTelegram(chatId, '‚ùå Erro ao buscar o resultado.');
    }
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
