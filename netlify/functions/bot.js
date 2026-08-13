const fetch = require('node-fetch');

const TELEGRAM_TOKENS = [
  '8783865981:AAG2MP2vb0iLeIeDWewKb5JQXYKL6JxPIiM',
  '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo'
];
let botIndex = 0;

function getToken() {
  const token = TELEGRAM_TOKENS[botIndex];
  botIndex = (botIndex + 1) % TELEGRAM_TOKENS.length;
  return token;
}
const NOSSA_API      = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE    = 'busca-processos-dev-key-2024';

const { limparOAB, separarOAB } = require('../utils/validar');

// ─── Enviar mensagem de texto ─────────────────────────────────────────────────
async function enviarMensagem(chatId, texto) {
  try {
    await fetch(`https://api.telegram.org/bot${getToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

// ─── Enviar arquivo (multipart manual, node-fetch v2) ────────────────────────
async function enviarArquivo(chatId, nomeArquivo, conteudo, legenda) {
  try {
    const boundary   = `----FormBoundary${Date.now()}`;
    const fileBuffer = Buffer.from(conteudo, 'utf8');
    const partes = [
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${legenda}`,
    ];
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${nomeArquivo}"\r\nContent-Type: text/html; charset=utf-8\r\n\r\n`;
    const body = Buffer.concat([
      Buffer.from(partes.join('\r\n') + '\r\n', 'utf8'),
      Buffer.from(fileHeader, 'utf8'),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);
    await fetch(`https://api.telegram.org/bot${getToken()}/sendDocument`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
      body,
    });
  } catch (e) {
    console.error('enviarArquivo:', e.message);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatarData(data) {
  if (!data) return 'N/D';
  const s = String(data);
  // formato datajud: 20150204162217 → 2015-02-04
  if (/^\d{14}$/.test(s)) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
  // formato ISO: 2026-06-26T...
  if (s.length >= 10) return s.substring(0, 10);
  return s;
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Gerar HTML — formato exato do print ─────────────────────────────────────
function gerarHTML(estado, numero, processos, nomeAdvogado) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  function renderPartes(partes, titulo) {
    if (!partes || partes.length === 0) return '';
    let h = `<div class="polo-titulo">${titulo}</div><ul class="polo-lista">`;
    partes.forEach(parte => {
      const cpf  = parte.cpf  ? `CPF: ${esc(parte.cpf)}`  : '';
      const cnpj = parte.cnpj ? `CNPJ: ${esc(parte.cnpj)}` : '';
      const doc  = cpf || cnpj || '';
      const tel  = parte.telefone ? `TEL: ${esc(parte.telefone)}` : 'TEL: Não informado';
      const email = parte.email   ? ` | EMAIL: <a href="mailto:${esc(parte.email)}">${esc(parte.email)}</a>` : '';
      h += `<li>${esc(parte.nome || 'N/D')}${doc ? ' | ' + doc : ''} | ${tel}${email}`;
      (parte.advogados || []).forEach(adv => {
        const advDoc = adv.cpf ? ` | CPF: ${esc(adv.cpf)}` : '';
        h += `<br><span class="adv">⚖️ Advogado: ${esc(adv.nome || 'N/D')}${advDoc}</span>`;
      });
      h += `</li>`;
    });
    h += `</ul>`;
    return h;
  }

  const cards = processos.map((p, i) => {
    const num         = p.numero || p.numeroProcesso || 'N/D';
    const link        = `https://supremodoseteoriginal.com/?processo=${encodeURIComponent(num)}`;
    const poloAtivo   = (p.partes || []).filter(x => ['AT','ATIVO'].includes((x.polo || x.tipoPolo || '').toUpperCase()));
    const poloPassivo = (p.partes || []).filter(x => ['PA','PASSIVO'].includes((x.polo || x.tipoPolo || '').toUpperCase()));
    const valor       = p.valor ? `R$ ${esc(p.valor)}` : 'N/D';
    const dataInicio  = formatarData(p.data || p.dataAjuizamento);
    const dataUltMov  = formatarData(p.dataUltimaMovimentacao || p.ultimaMovimentacao);

    return `<div class="card">
  <div class="proc-num">PROCESSO: ${esc(num)}</div>
  <div class="row">🔗 <b>LINK:</b> <a href="${link}" target="_blank">${link}</a></div>
  <div class="row">⚖️ <b>TRIBUNAL:</b> ${esc(p.tribunal || 'N/D')}</div>
  <div class="row">📁 <b>CLASSE:</b> ${esc(p.classe || 'N/D')}</div>
  <div class="row">📌 <b>ASSUNTO:</b> ${esc(p.assunto || 'N/D')}</div>
  <div class="row">💰 <b>VALOR:</b> ${valor}</div>
  <div class="row">📅 <b>DATA INÍCIO:</b> ${esc(dataInicio)}</div>
  <div class="row">📅 <b>ÚLTIMA MOVIMENTAÇÃO:</b> ${esc(dataUltMov)}</div>
  <div class="row">👨‍⚖️ <b>ÓRGÃO JULGADOR:</b> ${esc(p.orgao || 'N/D')}</div>
  ${poloAtivo.length   > 0 ? renderPartes(poloAtivo,   '👤 POLO ATIVO:')   : ''}
  ${poloPassivo.length > 0 ? renderPartes(poloPassivo, '👤 POLO PASSIVO:') : ''}
</div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OAB ${esc(estado)}${esc(numero)} — Processos</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Arial,sans-serif;background:#000;color:#fff;padding:12px}
  h1{font-size:1.1em;margin-bottom:4px;color:#fff}
  .meta{font-size:.82em;color:#aaa;margin-bottom:14px}
  .card{
    background:#2a2a2a;
    border-radius:12px;
    padding:14px 16px;
    margin-bottom:14px;
  }
  .proc-num{font-weight:bold;font-size:.95em;margin-bottom:8px;color:#fff}
  .row{font-size:.87em;margin-bottom:4px;line-height:1.5;color:#eee}
  a{color:#6ab3f8;text-decoration:none}
  a:hover{text-decoration:underline}
  .polo-titulo{font-size:.87em;font-weight:bold;margin-top:10px;margin-bottom:4px;color:#eee}
  .polo-lista{list-style:none;padding-left:0}
  .polo-lista li{font-size:.84em;color:#ddd;margin-bottom:6px;line-height:1.6;border-left:2px solid #555;padding-left:8px}
  .adv{color:#aac8f0;font-size:.95em}
</style>
</head>
<body>
<h1>📋 OAB ${esc(estado)}${esc(numero)} — Processos Judiciais</h1>
<div class="meta">
  ${nomeAdvogado ? `👤 <b>${esc(nomeAdvogado)}</b> &nbsp;|&nbsp; ` : ''}
  📊 <b>${processos.length} processos</b> &nbsp;|&nbsp;
  🕐 Gerado em: ${esc(geradoEm)}
</div>
${cards}
</body>
</html>`;
}

// ─── Busca OAB — UMA chamada só, sem retry ────────────────────────────────────
async function processarOAB(chatId, estado, numero) {
  await enviarMensagem(chatId, `🔍 Buscando OAB *${estado} ${numero}*...`);

  try {
    const resp = await fetch(`${NOSSA_API}/buscar/oab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOSSA_CHAVE,
      },
      body: JSON.stringify({ estado, numero }),
    });

    const dados = await resp.json();

    if (!dados.sucesso) {
      await enviarMensagem(chatId, `❌ Erro: ${dados.mensagem || 'Falha na consulta'}`);
      return;
    }

    const adv       = dados.dados?.advogado;
    const processos = dados.dados?.processos || [];
    const total     = dados.dados?.total_processos || processos.length;

    if (total === 0) {
      await enviarMensagem(chatId, `📋 Nenhum processo encontrado para OAB *${estado} ${numero}*.`);
      return;
    }

    // Confirmar quantidade
    await enviarMensagem(chatId, `✅ *Encontrados ${total} processos*`);

    // Gerar e enviar arquivo HTML com todos os processos
    await enviarMensagem(chatId, `📁 *Gerando arquivo HTML...*`);
    const nomeArq  = `OAB_${estado}${numero}_processos.html`;
    const conteudo = gerarHTML(estado, numero, processos, adv?.nome);
    const kb       = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
    await enviarArquivo(chatId, nomeArq, conteudo,
      `🌐 ${nomeArq}\n${kb} KB — abra no navegador\nOAB: ${estado}${numero} | 📊 ${total} processos`
    );

  } catch (e) {
    console.error('processarOAB error:', e);
    await enviarMensagem(chatId, `❌ Erro ao consultar a API: ${e.message}`);
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
