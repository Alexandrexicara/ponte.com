const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const NOSSA_API      = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE    = 'busca-processos-dev-key-2024';

const { limparOAB, separarOAB } = require('../utils/validar');

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function enviarMensagem(chatId, texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    console.error('enviarMensagem:', e.message);
  }
}

async function enviarArquivo(chatId, nomeArquivo, conteudo, legenda) {
  try {
    const { FormData, Blob } = require('node-fetch');
    const form = new FormData();
    form.append('chat_id', String(chatId));
    form.append('document',
      new Blob([conteudo], { type: 'text/plain; charset=utf-8' }),
      nomeArquivo
    );
    form.append('caption', legenda);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
      method: 'POST',
      body: form,
    });
  } catch (e) {
    console.error('enviarArquivo:', e.message);
  }
}

// ─── Formatação ───────────────────────────────────────────────────────────────

function formatarData(data) {
  if (!data) return 'N/D';
  const s = String(data);
  if (s.length >= 8) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
  return s.substring(0, 10);
}

function linkProcesso(numero) {
  if (!numero) return 'N/D';
  return `https://consulta.cnj.jus.br/consulta/processo/${numero}`;
}

// Card individual de cada processo (formato do print)
function cardProcesso(p, i) {
  const num    = p.numero || p.numeroProcesso || 'N/D';
  const link   = linkProcesso(num);
  const trib   = p.tribunal || 'N/D';
  const classe = p.classe   || 'N/D';
  const assunto= p.assunto  || 'N/D';
  const data   = formatarData(p.data || p.dataAjuizamento);
  const orgao  = p.orgao    || 'N/D';

  let txt = `📋 *PROCESSO ${i}:* \`${num}\`\n`;
  txt += `🔗 *LINK:* ${link}\n`;
  txt += `⚖️ *TRIBUNAL:* ${trib}\n`;
  txt += `🏛 *CLASSE:* ${classe}\n`;
  txt += `📌 *ASSUNTO:* ${assunto}\n`;
  txt += `📅 *DATA INÍCIO:* ${data}\n`;
  txt += `👨‍⚖️ *ÓRGÃO JULGADOR:* ${orgao}`;
  return txt;
}

// Arquivo detalhes.txt com todos os processos
function gerarTxt(estado, numero, processos, nomeAdvogado) {
  const linhas = [];
  linhas.push('='.repeat(60));
  linhas.push(`OAB: ${estado}${numero}`);
  if (nomeAdvogado) linhas.push(`ADVOGADO: ${nomeAdvogado}`);
  linhas.push(`TOTAL DE PROCESSOS: ${processos.length}`);
  linhas.push(`GERADO EM: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  linhas.push('='.repeat(60));
  linhas.push('');

  processos.forEach((p, i) => {
    const num = p.numero || p.numeroProcesso || 'N/D';
    linhas.push(`PROCESSO ${i + 1}: ${num}`);
    linhas.push(`LINK: ${linkProcesso(num)}`);
    linhas.push(`TRIBUNAL: ${p.tribunal || 'N/D'}`);
    linhas.push(`CLASSE: ${p.classe || 'N/D'}`);
    linhas.push(`ASSUNTO: ${p.assunto || 'N/D'}`);
    linhas.push(`DATA INÍCIO: ${formatarData(p.data || p.dataAjuizamento)}`);
    linhas.push(`ÓRGÃO JULGADOR: ${p.orgao || 'N/D'}`);
    linhas.push('-'.repeat(60));
    linhas.push('');
  });

  return linhas.join('\n');
}

// ─── Busca e entrega ─────────────────────────────────────────────────────────

async function processarOAB(chatId, estado, numero) {
  // 1. Avisar que está buscando
  await enviarMensagem(chatId, `⏳ *Buscando processos...*`);

  // 2. Chamar nossa API (mesma chamada que funcionava antes)
  let dados;
  try {
    const resp = await fetch(`${NOSSA_API}/buscar/oab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOSSA_CHAVE,
      },
      body: JSON.stringify({ estado, numero }),
    });
    dados = await resp.json();
  } catch (e) {
    await enviarMensagem(chatId, `❌ Erro ao consultar a API: ${e.message}`);
    return;
  }

  if (!dados.sucesso) {
    await enviarMensagem(chatId, `❌ ${dados.mensagem || 'Falha na consulta'}`);
    return;
  }

  const adv       = dados.dados?.advogado;
  const processos = dados.dados?.processos || [];
  const total     = dados.dados?.total_processos || processos.length;

  // 3. Confirmar quantidade encontrada
  await enviarMensagem(chatId, `✅ *Encontrados ${total} processos*`);

  if (total === 0) {
    await enviarMensagem(chatId, `📋 Nenhum processo encontrado para OAB *${estado} ${numero}*.`);
    return;
  }

  // 4. Gerar e enviar arquivo detalhes.txt
  await enviarMensagem(chatId, `📁 *Gerando arquivo detalhes.txt...*`);
  const nomeArq  = `temp_${estado}${numero}_detalhes.txt`;
  const conteudo = gerarTxt(estado, numero, processos, adv?.nome);
  const kb       = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
  await enviarArquivo(chatId, nomeArq, conteudo,
    `📄 ${nomeArq}\n${kb} KB\n✅ Arquivo detalhes.txt gerado\nOAB: ${estado}${numero}\n📊 Processos: ${total}`
  );

  // 5. Enviar processos individualmente em cards (máx 20)
  const limite = Math.min(processos.length, 20);
  for (let i = 0; i < limite; i++) {
    await enviarMensagem(chatId, cardProcesso(processos[i], i + 1));
    if (i < limite - 1) await new Promise(r => setTimeout(r, 300));
  }

  if (total > 20) {
    await enviarMensagem(chatId,
      `📋 _Mostrando 20 de ${total} processos. Todos estão no arquivo detalhes.txt._`
    );
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

exports.handler = async (event) => {
  try {
    const body     = JSON.parse(event.body || '{}');
    const mensagem = body.message || {};
    const chatId   = mensagem.chat?.id;
    const texto    = (mensagem.text || '').trim();

    if (!chatId) return { statusCode: 200, body: 'OK' };

    if (/^\/oab\s+/i.test(texto)) {
      const arg   = texto.replace(/^\/oab\s+/i, '').trim();
      const match = arg.match(/^([A-Za-z]{2})\s*(\d+)$/);
      if (!match) {
        await enviarMensagem(chatId, `❌ Formato inválido.\nUse: /oab UF NUMERO\nExemplo: /oab MS 3616`);
      } else {
        await processarOAB(chatId, match[1].toUpperCase(), match[2]);
      }

    } else if (/^\/(start|help|ajuda)$/i.test(texto)) {
      await enviarMensagem(chatId,
        `👋 *Bot de Processos Judiciais*\n\n` +
        `*/oab UF NUMERO* — busca processos do advogado\n\n` +
        `Exemplo: /oab MS 3616`
      );

    } else if (texto.startsWith('/')) {
      await enviarMensagem(chatId, `❓ Comando não reconhecido. Use /ajuda.`);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (e) {
    console.error('Handler error:', e);
    return { statusCode: 200, body: 'OK' };
  }
};
