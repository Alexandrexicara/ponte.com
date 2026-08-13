const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const NOSSA_API      = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE    = 'busca-processos-dev-key-2024';

const { limparOAB, separarOAB } = require('../utils/validar');

// ─── Telegram: enviar texto ───────────────────────────────────────────────────
async function enviarMensagem(chatId, texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram error:', e.message);
  }
}

// ─── Telegram: enviar arquivo .txt (multipart manual para node-fetch v2) ──────
async function enviarArquivo(chatId, nomeArquivo, conteudo, legenda) {
  try {
    const boundary   = `----FormBoundary${Date.now()}`;
    const fileBuffer = Buffer.from(conteudo, 'utf8');
    const partes = [
      `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}`,
      `--${boundary}\r\nContent-Disposition: form-data; name="caption"\r\n\r\n${legenda}`,
    ];
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${nomeArquivo}"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n`;
    const body = Buffer.concat([
      Buffer.from(partes.join('\r\n') + '\r\n', 'utf8'),
      Buffer.from(fileHeader, 'utf8'),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
    ]);
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
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
  if (s.length >= 8) return `${s.substring(0,4)}-${s.substring(4,6)}-${s.substring(6,8)}`;
  return s.substring(0, 10);
}

function linkProcesso(numero) {
  if (!numero) return '';
  return `https://supremodoseteoriginal.com/?processo=${numero}`;
}

// ─── Formatar um processo (igual ao print) ────────────────────────────────────
function formatarProcesso(p) {
  const num         = p.numero || p.numeroProcesso || 'N/D';
  const poloAtivo   = (p.partes || []).filter(x => ['AT','ATIVO'].includes((x.polo || x.tipoPolo || '').toUpperCase()));
  const poloPassivo = (p.partes || []).filter(x => ['PA','PASSIVO'].includes((x.polo || x.tipoPolo || '').toUpperCase()));

  let txt = `PROCESSO: ${num}\n`;
  txt += `🔗 LINK: ${linkProcesso(num)}\n`;
  txt += `⚖️ TRIBUNAL: ${p.tribunal || 'N/D'}\n`;
  txt += `📁 CLASSE: ${p.classe || 'N/D'}\n`;
  txt += `📌 ASSUNTO: ${p.assunto || 'N/D'}\n`;
  txt += `💰 VALOR: ${p.valor ? `R$ ${p.valor}` : 'N/D'}\n`;
  txt += `📅 DATA INÍCIO: ${formatarData(p.data || p.dataAjuizamento)}\n`;
  txt += `📅 ÚLTIMA MOVIMENTAÇÃO: ${formatarData(p.dataUltimaMovimentacao || p.ultimaMovimentacao)}\n`;
  txt += `👨‍⚖️ ÓRGÃO JULGADOR: ${p.orgao || 'N/D'}`;

  if (poloAtivo.length > 0) {
    txt += `\n\n👤 POLO ATIVO:`;
    poloAtivo.forEach(parte => {
      const doc = parte.cpf ? `CPF: ${parte.cpf}` : parte.cnpj ? `CNPJ: ${parte.cnpj}` : 'DOC: N/D';
      txt += `\n- ${parte.nome || 'N/D'} | ${doc} | TEL: ${parte.telefone || 'Não informado'}`;
      (parte.advogados || []).forEach(adv => {
        txt += `\n⚖️ Advogado: ${adv.nome || 'N/D'} | CPF: ${adv.cpf || 'N/D'}`;
      });
    });
  }

  if (poloPassivo.length > 0) {
    txt += `\n\n👤 POLO PASSIVO:`;
    poloPassivo.forEach(parte => {
      const doc = parte.cpf ? `CPF: ${parte.cpf}` : parte.cnpj ? `CNPJ: ${parte.cnpj}` : 'DOC: N/D';
      txt += `\n- ${parte.nome || 'N/D'} | ${doc} | TEL: ${parte.telefone || 'Não informado'}`;
    });
  }

  return txt;
}

// ─── Gerar arquivo HTML com links clicáveis ──────────────────────────────────
function gerarHTML(estado, numero, processos, nomeAdvogado) {
  const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function linhaPartes(partes, titulo) {
    if (!partes || partes.length === 0) return '';
    let h = `<div class="polo"><strong>${titulo}</strong><ul>`;
    partes.forEach(parte => {
      const doc = parte.cpf ? `CPF: ${esc(parte.cpf)}` : parte.cnpj ? `CNPJ: ${esc(parte.cnpj)}` : '';
      const tel = parte.telefone ? `TEL: <a href="tel:${esc(parte.telefone)}">${esc(parte.telefone)}</a>` : 'TEL: Não informado';
      h += `<li>${esc(parte.nome || 'N/D')}${doc ? ' | ' + doc : ''} | ${tel}`;
      (parte.advogados || []).forEach(adv => {
        h += `<br>⚖️ Advogado: ${esc(adv.nome || 'N/D')}${adv.cpf ? ' | CPF: ' + esc(adv.cpf) : ''}`;
      });
      h += `</li>`;
    });
    h += `</ul></div>`;
    return h;
  }

  const cards = processos.map((p, i) => {
    const num         = p.numero || p.numeroProcesso || 'N/D';
    const link        = `https://supremodoseteoriginal.com/?processo=${encodeURIComponent(num)}`;
    const poloAtivo   = (p.partes || []).filter(x => ['AT','ATIVO'].includes((x.polo || x.tipoPolo || '').toUpperCase()));
    const poloPassivo = (p.partes || []).filter(x => ['PA','PASSIVO'].includes((x.polo || x.tipoPolo || '').toUpperCase()));

    return `
    <div class="card">
      <div class="num">#${i+1} — ${esc(num)}</div>
      <table>
        <tr><td>🔗 LINK</td><td><a href="${link}" target="_blank">${esc(num)}</a></td></tr>
        <tr><td>⚖️ TRIBUNAL</td><td>${esc(p.tribunal || 'N/D')}</td></tr>
        <tr><td>📁 CLASSE</td><td>${esc(p.classe || 'N/D')}</td></tr>
        <tr><td>📌 ASSUNTO</td><td>${esc(p.assunto || 'N/D')}</td></tr>
        <tr><td>💰 VALOR</td><td>${p.valor ? 'R$ ' + esc(p.valor) : 'N/D'}</td></tr>
        <tr><td>📅 DATA INÍCIO</td><td>${esc(formatarData(p.data || p.dataAjuizamento))}</td></tr>
        <tr><td>📅 ÚLTIMA MOV.</td><td>${esc(formatarData(p.dataUltimaMovimentacao || p.ultimaMovimentacao))}</td></tr>
        <tr><td>👨‍⚖️ ÓRGÃO</td><td>${esc(p.orgao || 'N/D')}</td></tr>
      </table>
      ${linhaPartes(poloAtivo,  '👤 POLO ATIVO')}
      ${linhaPartes(poloPassivo,'👤 POLO PASSIVO')}
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OAB ${estado}${numero} — Processos</title>
<style>
  body{font-family:Arial,sans-serif;background:#111;color:#eee;margin:0;padding:16px}
  h1{color:#fff;font-size:1.2em;border-bottom:1px solid #444;padding-bottom:8px}
  .meta{color:#aaa;font-size:.85em;margin-bottom:16px}
  .card{background:#1e1e2e;border:1px solid #333;border-radius:8px;padding:14px;margin-bottom:16px}
  .num{font-weight:bold;color:#7eb8f7;margin-bottom:8px;font-size:.95em}
  table{width:100%;border-collapse:collapse;font-size:.88em}
  td{padding:4px 6px;vertical-align:top}
  td:first-child{white-space:nowrap;color:#aaa;width:140px}
  a{color:#7eb8f7;text-decoration:none}
  a:hover{text-decoration:underline}
  .polo{margin-top:8px;font-size:.86em}
  .polo strong{color:#ccc}
  .polo ul{margin:4px 0 0 16px;padding:0}
  .polo li{margin-bottom:4px;line-height:1.5}
</style>
</head>
<body>
<h1>📋 OAB ${esc(estado)}${esc(numero)} — Processos Judiciais</h1>
<div class="meta">
  ${nomeAdvogado ? `👤 Advogado: <strong>${esc(nomeAdvogado)}</strong><br>` : ''}
  📊 Total: <strong>${processos.length} processos</strong><br>
  🕐 Gerado em: ${esc(geradoEm)}
</div>
${cards}
</body>
</html>`;
}

// ─── Busca OAB — IDÊNTICA ao commit 8d64abc que funcionava ───────────────────
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

    // 1. Confirmar quantidade
    await enviarMensagem(chatId, `✅ *Encontrados ${total} processos*`);

    // 2. Gerar e enviar arquivo HTML com todos os processos e links clicáveis
    await enviarMensagem(chatId, `📁 *Gerando arquivo detalhes.html...*`);
    const nomeArq  = `OAB_${estado}${numero}_processos.html`;
    const conteudo = gerarHTML(estado, numero, processos, adv?.nome);
    const kb       = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
    await enviarArquivo(chatId, nomeArq, conteudo,
      `🌐 ${nomeArq}\n${kb} KB\n✅ Arquivo HTML gerado — abra no navegador\nOAB: ${estado}${numero}\n📊 Processos: ${total}`
    );

    // 3. Enviar TODOS os processos como cards individuais
    for (let i = 0; i < processos.length; i++) {
      await enviarMensagem(chatId, formatarProcesso(processos[i]));
      if (i < processos.length - 1) await new Promise(r => setTimeout(r, 300));
    }

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
