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

// ─── Gerar conteúdo do detalhes.txt ──────────────────────────────────────────
function gerarTxt(estado, numero, processos, nomeAdvogado) {
  const linhas = [];
  linhas.push('='.repeat(60));
  linhas.push(`OAB: ${estado}${numero}`);
  if (nomeAdvogado) linhas.push(`ADVOGADO: ${nomeAdvogado}`);
  linhas.push(`TOTAL DE PROCESSOS: ${processos.length}`);
  linhas.push(`GERADO EM: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
  linhas.push('='.repeat(60));
  linhas.push('');
  processos.forEach(p => {
    linhas.push(formatarProcesso(p));
    linhas.push('-'.repeat(60));
    linhas.push('');
  });
  return linhas.join('\n');
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

    // 2. Gerar e enviar arquivo detalhes.txt
    await enviarMensagem(chatId, `📁 *Gerando arquivo detalhes.txt...*`);
    const nomeArq  = `temp_${estado}${numero}_detalhes.txt`;
    const conteudo = gerarTxt(estado, numero, processos, adv?.nome);
    const kb       = (Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1);
    await enviarArquivo(chatId, nomeArq, conteudo,
      `📄 ${nomeArq}\n${kb} KB\n✅ Arquivo detalhes.txt gerado\nOAB: ${estado}${numero}\n📊 Processos: ${total}`
    );

    // 3. Enviar primeiros 20 processos como cards individuais
    const limite = Math.min(processos.length, 20);
    for (let i = 0; i < limite; i++) {
      await enviarMensagem(chatId, formatarProcesso(processos[i]));
      if (i < limite - 1) await new Promise(r => setTimeout(r, 300));
    }

    if (total > 20) {
      await enviarMensagem(chatId,
        `_...e mais ${total - 20} processo(s). Todos no arquivo detalhes.txt._`
      );
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
