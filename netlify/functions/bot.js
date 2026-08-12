const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const NOSSA_API      = 'https://busca-processos.onrender.com/api/v1'; // deploy 1786564992
const NOSSA_CHAVE    = 'busca-processos-dev-key-2024';

const { limparOAB, separarOAB } = require('../utils/validar');

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

    // Dados do advogado
    let msg = '';
    if (adv) {
      msg += `👤 *${adv.nome || 'N/D'}*\n`;
      msg += `📋 OAB/${adv.uf || estado} ${adv.oab || numero}\n`;
      msg += `✅ Situação: ${adv.situacao || 'N/D'}\n`;
      if (adv.subSeccional) msg += `📍 ${adv.subSeccional}\n`;
      msg += '\n';
    }

    // Processos
    if (total === 0) {
      msg += `📋 Nenhum processo encontrado.`;
    } else {
      msg += `📦 *${total} processo(s) encontrado(s):*\n\n`;
      processos.slice(0, 15).forEach((p, i) => {
        msg += `*${i + 1}.* \`${p.numero || p.numeroProcesso || 'N/D'}\`\n`;
        msg += `   ⚖️ ${p.tribunal || 'N/D'}`;
        if (p.classe) msg += ` · ${p.classe}`;
        if (p.data)   msg += ` · ${String(p.data).substring(0, 10)}`;
        msg += '\n';
        if (p.assunto) msg += `   📌 ${p.assunto}\n`;
        msg += '\n';
      });
      if (total > 15) msg += `_...e mais ${total - 15} processo(s)._`;
    }

    await enviarMensagem(chatId, msg);

  } catch (e) {
    console.error('processarOAB error:', e);
    await enviarMensagem(chatId, `❌ Erro ao consultar a API: ${e.message}`);
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
        processarOAB(chatId, match[1].toUpperCase(), match[2])
          .catch(e => console.error(e));
      }

    } else if (/^\/(start|help|ajuda)$/i.test(texto)) {
      await enviarMensagem(chatId,
        `👋 *Bot de Processos Judiciais*\n\n` +
        `*/oab UF NUMERO* — busca advogado e processos\n\n` +
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
