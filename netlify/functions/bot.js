const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';

// URL base da sua própria função Netlify de consulta completa
// Em produção a Netlify injeta a URL no header x-forwarded-host
const getBaseUrl = (event) => {
  const host = event.headers?.['x-forwarded-host'] || event.headers?.host || 'localhost:8888';
  const proto = event.headers?.['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
};

async function enviarMensagem(chatId, texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
    });
  } catch (e) {
    console.error('Erro ao enviar mensagem Telegram:', e.message);
  }
}

async function processarComandoOAB(chatId, valorOAB, baseUrl) {
  try {
    // Parse: "MS 3616" ou "ms3616" ou "MS3616"
    const match = valorOAB.trim().match(/^([A-Za-z]{2})\s*(\d+)$/);
    if (!match) {
      await enviarMensagem(chatId, `❌ Formato inválido! Use: /oab UF NUMERO\nExemplo: /oab MS 3616`);
      return;
    }

    const estado = match[1].toUpperCase();
    const numero = match[2];
    const oab = `${estado}${numero}`;

    await enviarMensagem(chatId, `🔍 Iniciando busca para OAB ${estado} ${numero}...\nVou buscar em DataJud, TJSP, TJMS e TJMG.`);

    // Chama a função consulta-oab com chat_id para receber atualizações em tempo real
    const url = `${baseUrl}/.netlify/functions/consulta-oab?oab=${encodeURIComponent(oab)}&chat_id=${chatId}`;
    console.log('Chamando:', url);

    const resposta = await fetch(url, { timeout: 10000 });
    const dados = await resposta.json();

    if (resposta.status === 202) {
      // Processando em background — o consulta-oab já vai enviar mensagens pelo Telegram
      await enviarMensagem(chatId, `⏳ Consulta iniciada (ID: ${dados.id})\nVou te avisando conforme encontrar os processos!`);
    } else if (resposta.status === 200 && dados.aviso) {
      // Já estava processando
      await enviarMensagem(chatId, `ℹ️ ${dados.aviso}`);
    } else {
      await enviarMensagem(chatId, `❌ Erro ao iniciar consulta: ${dados.erro || JSON.stringify(dados).substring(0, 100)}`);
    }

  } catch (erro) {
    console.error('Erro processarComandoOAB:', erro);
    await enviarMensagem(chatId, `❌ Erro interno: ${erro.message}`);
  }
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const mensagem = body.message || {};
    const chatId = mensagem.chat?.id;
    const texto = (mensagem.text || '').trim();

    if (!chatId) return { statusCode: 200, body: 'OK' };

    const baseUrl = getBaseUrl(event);

    if (texto.toLowerCase().startsWith('/oab ')) {
      const valorOAB = texto.replace(/^\/oab\s*/i, '').trim();
      // Não aguarda — responde imediatamente ao Telegram e processa em background
      processarComandoOAB(chatId, valorOAB, baseUrl).catch(e => console.error(e));

    } else if (texto === '/start' || texto === '/help' || texto === '/ajuda') {
      await enviarMensagem(chatId,
        `👋 *Bot de Busca de Processos*\n\n` +
        `Comando disponível:\n` +
        `*/oab UF NUMERO* — busca processos do advogado\n\n` +
        `Exemplo: /oab MS 3616\n\n` +
        `Fontes: DataJud (Brasil), TJSP, TJMS, TJMG`
      );

    } else if (texto.startsWith('/')) {
      await enviarMensagem(chatId, `❓ Comando não reconhecido. Use /ajuda para ver os comandos.`);
    }

    return { statusCode: 200, body: 'OK' };

  } catch (erro) {
    console.error('Erro handler:', erro);
    return { statusCode: 200, body: 'OK' };
  }
};
