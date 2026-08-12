const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const NOSSA_API      = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE    = 'busca-processos-dev-key-2024';

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function enviarMensagem(chatId, texto, extra = {}) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: texto,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        ...extra,
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
    form.append('parse_mode', 'Markdown');
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
      method: 'POST',
      body: form,
    });
  } catch (e) {
    console.error('enviarArquivo:', e.message);
  }
}

// ─── Formatação ───────────────────────────────────────────────────────────────

function linkProcesso(numero) {
  if (!numero) return 'N/D';
  // Link para consulta pública no DataJud
  const clean = numero.replace(/\D/g, '');
  return `https://consulta.cnj.jus.br/consulta/processo/${numero}`;
}

function formatarData(data) {
  if (!data) return 'N/D';
  const s = String(data);
  if (s.length >= 8) {
    return `${s.substring(0, 4)}-${s.substring(4, 6)}-${s.substring(6, 8)}`;
  }
  return s.substring(0, 10);
}

function formatarValor(valor) {
  if (!valor) return 'N/D';
  if (typeof valor === 'number') {
    return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  }
  return String(valor);
}

// Formato card do Telegram (igual ao print)
function cardProcesso(p, i) {
  const num     = p.numero || p.numeroProcesso || 'N/D';
  const link    = linkProcesso(num);
  const trib    = p.tribunal || 'N/D';
  const classe  = p.classe   || 'N/D';
  const assunto = p.assunto  || 'N/D';
  const valor   = formatarValor(p.valor);
  const data    = formatarData(p.data || p.dataAjuizamento);
  const ultima  = formatarData(p.ultimaMovimentacao || p.dataUltimaAtualizacao);
  const orgao   = p.orgao || p.orgaoJulgador || 'N/D';

  let txt = '';
  txt += `📋 *PROCESSO ${i}:* \`${num}\`\n`;
  txt += `🔗 *LINK:* ${link}\n`;
  txt += `⚖️ *TRIBUNAL:* ${trib}\n`;
  txt += `🏛 *CLASSE:* ${classe}\n`;
  txt += `📌 *ASSUNTO:* ${assunto}\n`;
  txt += `💰 *VALOR:* ${valor}\n`;
  txt += `📅 *DATA INÍCIO:* ${data}\n`;
  txt += `🔄 *ÚLTIMA MOVIMENTAÇÃO:* ${ultima}\n`;
  txt += `👨‍⚖️ *ÓRGÃO JULGADOR:* ${orgao}\n`;

  // Polo ativo
  const ativos = p.partes?.filter(x => x.polo === 'ativo' || x.tipo === 'Autor') || [];
  if (ativos.length > 0 || p.poloAtivo) {
    txt += `\n👤 *POLO ATIVO:*\n`;
    const lista = ativos.length > 0 ? ativos : (Array.isArray(p.poloAtivo) ? p.poloAtivo : [p.poloAtivo]);
    lista.forEach(parte => {
      if (!parte) return;
      const nome = parte.nome || parte;
      const cpf  = parte.cpf  ? ` | CPF: ${parte.cpf}`  : '';
      const tel  = parte.telefone ? ` | TEL: ${parte.telefone}` : ' | TEL: Não informado';
      txt += `- ${nome}${cpf}${tel}\n`;
      if (parte.advogados?.length > 0) {
        parte.advogados.forEach(adv => {
          txt += `  ⚖️ *Advogado:* ${adv.nome || adv}`;
          if (adv.cpf) txt += ` | CPF: ${adv.cpf}`;
          txt += '\n';
        });
      }
    });
  }

  // Polo passivo
  const passivos = p.partes?.filter(x => x.polo === 'passivo' || x.tipo === 'Réu') || [];
  if (passivos.length > 0 || p.poloPassivo) {
    txt += `\n👥 *POLO PASSIVO:*\n`;
    const lista = passivos.length > 0 ? passivos : (Array.isArray(p.poloPassivo) ? p.poloPassivo : [p.poloPassivo]);
    lista.forEach(parte => {
      if (!parte) return;
      const nome  = parte.nome || parte;
      const doc   = parte.cpf ? ` | CPF: ${parte.cpf}` : (parte.cnpj ? ` | CNPJ: ${parte.cnpj}` : '');
      const tel   = parte.telefone ? ` | TEL: ${parte.telefone}` : ' | TEL: Não informado';
      txt += `- ${nome}${doc}${tel}\n`;
    });
  }

  return txt;
}

// Formato detalhes.txt (completo, para o arquivo)
function gerarTxt(estado, numero, processos, nomeAdvogado) {
  const linhas = [];
  linhas.push(`${'='.repeat(60)}`);
  linhas.push(`OAB: ${estado}${numero}`);
  if (nomeAdvogado) linhas.push(`ADVOGADO: ${nomeAdvogado}`);
  linhas.push(`TOTAL DE PROCESSOS: ${processos.length}`);
  linhas.push(`GERADO EM: ${new Date().toLocaleString('pt-BR', {timeZone:'America/Sao_Paulo'})}`);
  linhas.push(`${'='.repeat(60)}`);
  linhas.push('');

  processos.forEach((p, i) => {
    const num    = p.numero || p.numeroProcesso || 'N/D';
    const link   = linkProcesso(num);
    linhas.push(`PROCESSO ${i + 1}: ${num}`);
    linhas.push(`LINK: ${link}`);
    linhas.push(`TRIBUNAL: ${p.tribunal || 'N/D'}`);
    linhas.push(`CLASSE: ${p.classe || 'N/D'}`);
    linhas.push(`ASSUNTO: ${p.assunto || 'N/D'}`);
    linhas.push(`VALOR: ${formatarValor(p.valor)}`);
    linhas.push(`DATA INÍCIO: ${formatarData(p.data || p.dataAjuizamento)}`);
    linhas.push(`ÚLTIMA MOVIMENTAÇÃO: ${formatarData(p.ultimaMovimentacao)}`);
    linhas.push(`ÓRGÃO JULGADOR: ${p.orgao || 'N/D'}`);

    const ativos = p.partes?.filter(x => x.polo === 'ativo' || x.tipo === 'Autor') || [];
    if (ativos.length > 0) {
      linhas.push('POLO ATIVO:');
      ativos.forEach(parte => {
        linhas.push(`  - ${parte.nome || parte}${parte.cpf ? ` | CPF: ${parte.cpf}` : ''}${parte.telefone ? ` | TEL: ${parte.telefone}` : ''}`);
        if (parte.advogados?.length > 0) {
          parte.advogados.forEach(adv => linhas.push(`    Advogado: ${adv.nome || adv}${adv.cpf ? ` | CPF: ${adv.cpf}` : ''}`));
        }
      });
    }

    const passivos = p.partes?.filter(x => x.polo === 'passivo' || x.tipo === 'Réu') || [];
    if (passivos.length > 0) {
      linhas.push('POLO PASSIVO:');
      passivos.forEach(parte => {
        linhas.push(`  - ${parte.nome || parte}${parte.cpf ? ` | CPF: ${parte.cpf}` : ''}${parte.cnpj ? ` | CNPJ: ${parte.cnpj}` : ''}${parte.telefone ? ` | TEL: ${parte.telefone}` : ''}`);
      });
    }

    linhas.push('-'.repeat(60));
    linhas.push('');
  });

  return linhas.join('\n');
}

// ─── Handler principal ───────────────────────────────────────────────────────

async function processarOAB(chatId, estado, numero) {
  await enviarMensagem(chatId, `⏳ *Buscando processos...*`);

  // Acordar o Render (free tier dorme após inatividade)
  try {
    await fetch(`${NOSSA_API.replace('/api/v1','')}/health`, { method: 'GET' });
  } catch(e) { /* ignorar */ }

  let dados, processos = [], nomeAdvogado = null;

  // Tentar até 3 vezes (Render pode demorar para acordar)
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resp = await fetch(`${NOSSA_API}/buscar/oab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': NOSSA_CHAVE },
        body: JSON.stringify({ estado, numero }),
      });
      dados = await resp.json();
      processos = dados.dados?.processos || [];
      if (processos.length > 0) break; // achou, sair do loop
      if (tentativa < 3) await new Promise(r => setTimeout(r, 3000)); // esperar 3s e tentar de novo
    } catch (e) {
      if (tentativa === 3) {
        await enviarMensagem(chatId, `❌ Erro ao consultar a API: ${e.message}`);
        return;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!dados || !dados.sucesso) {
    await enviarMensagem(chatId, `❌ ${dados.mensagem || 'Erro na consulta'}`);
    return;
  }

  nomeAdvogado  = dados.dados?.advogado?.nome || null;
  const total   = dados.dados?.total_processos || processos.length;

  await enviarMensagem(chatId, `✅ *Encontrados ${total} processos*`);

  if (total === 0) {
    await enviarMensagem(chatId, `📋 Nenhum processo encontrado para OAB *${estado} ${numero}*.`);
    return;
  }

  // ── 1. Gerar e enviar arquivo detalhes.txt ──────────────────────────────
  await enviarMensagem(chatId, `📁 *Gerando arquivo detalhes.txt...*`);

  const nomeArq   = `temp_${estado}${numero}_detalhes.txt`;
  const conteudo  = gerarTxt(estado, numero, processos, nomeAdvogado);
  const legendaTxt =
    `📄 *${nomeArq}*\n` +
    `${(Buffer.byteLength(conteudo, 'utf8') / 1024).toFixed(1)} KB\n` +
    `✅ Arquivo detalhes.txt gerado\n` +
    `OAB: ${estado}${numero}\n` +
    `📊 Processos: ${total}\n` +
    `📞 Telefones incluídos nos detalhes`;

  await enviarArquivo(chatId, nomeArq, conteudo, legendaTxt);

  // ── 2. Enviar processos individualmente (máx 20 para não sobrecarregar) ─
  const limite = Math.min(processos.length, 20);
  for (let i = 0; i < limite; i++) {
    const card = cardProcesso(processos[i], i + 1);
    await enviarMensagem(chatId, card);
    // Pequena pausa para não ser bloqueado pelo Telegram (rate limit)
    if (i < limite - 1) await new Promise(r => setTimeout(r, 300));
  }

  if (total > 20) {
    await enviarMensagem(chatId,
      `📋 _Mostrando 20 de ${total} processos. O arquivo detalhes.txt contém todos._`
    );
  }
}

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
