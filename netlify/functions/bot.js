const fetch = require('node-fetch');
const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const BASE_NOSSA = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE = 'busca-processos-dev-key-2024';

async function enviarMensagem(chatId, texto) {
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
  }).catch(()=>{});
}

async function processarComandoOAB(chatId, valorOAB) {
  try {
    await enviarMensagem(chatId, `í´ Iniciando consulta para OAB: ${valorOAB.toUpperCase()}`);
    
    const resposta = await fetch(`${BASE_NOSSA}/buscar/oab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOSSA_CHAVE
      },
      body: JSON.stringify({ valor: valorOAB })
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      await enviarMensagem(chatId, `âŒ Erro: ${dados.erro || 'Falha na consulta'}`);
      return;
    }

    if (!dados.id) {
      await enviarMensagem(chatId, `âŒ API nÃ£o retornou ID vÃ¡lido`);
      return;
    }

    await enviarMensagem(chatId, `âœ… Consulta iniciada!\ní³Œ ID: ${dados.id}\nAguarde o resultado...`);
  } catch (erro) {
    await enviarMensagem(chatId, `âŒ Erro interno: ${erro.message}`);
  }
}

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const mensagem = body.message || {};
    const chatId = mensagem.chat?.id;
    const texto = mensagem.text || '';

    if (!chatId) return { statusCode: 200, body: 'OK' };

    if (texto.toLowerCase().startsWith('/oab ')) {
      const valorOAB = texto.replace(/^\/oab\s*/i, '').trim();
      await processarComandoOAB(chatId, valorOAB);
    } 
    else if (texto.toLowerCase() === '/start' || texto.toLowerCase() === '/help') {
      await enviarMensagem(chatId, `í±‹ Bem-vindo!\nComando: /oab MS 3616`);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (erro) {
    console.error(erro);
    return { statusCode: 200, body: 'OK' };
  }
}
