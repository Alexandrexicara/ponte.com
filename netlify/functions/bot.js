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
    await enviarMensagem(chatId, `🔍 Iniciando consulta para OAB: ${valorOAB.toUpperCase()}`);
    
    // Parse valorOAB (formato esperado: "MS 3616")
    const partes = valorOAB.trim().split(/\s+/);
    const estado = partes[0]?.toUpperCase() || '';
    const numero = partes[1] || '';
    
    if (!estado || !numero) {
      await enviarMensagem(chatId, `❌ Formato inválido! Use: /oab UF NUMERO\nExemplo: /oab MS 3616`);
      return;
    }
    
    const resposta = await fetch(`${BASE_NOSSA}/buscar/oab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOSSA_CHAVE
      },
      body: JSON.stringify({ estado, numero })
    });

    let dados;
    try {
      dados = await resposta.json();
    } catch (e) {
      const texto = await resposta.text();
      await enviarMensagem(chatId, `❌ Erro na API: ${resposta.status}\n${texto.substring(0, 200)}`);
      return;
    }

    if (!resposta.ok) {
      const erroMsg = dados.detail?.[0]?.msg || dados.erro || dados.message || 'Falha na consulta';
      await enviarMensagem(chatId, `❌ Erro: ${erroMsg}`);
      return;
    }

    // Log para debug - mostrar o que a API retornou
    console.log('Resposta da API:', JSON.stringify(dados));

    if (!dados.sucesso) {
      await enviarMensagem(chatId, `❌ Erro na busca: ${dados.mensagem || 'Falha desconhecida'}`);
      return;
    }

    // Mostrar resultado da busca
    const total = dados.dados?.total_processos || 0;
    const processos = dados.dados?.processos || [];
    
    if (total === 0) {
      await enviarMensagem(chatId, `✅ Busca concluída!\n\n📋 Nenhum processo encontrado para OAB ${valorOAB.toUpperCase()}`);
    } else {
      let msg = `✅ Busca concluída!\n\n📋 ${total} processo(s) encontrado(s):\n\n`;
      processos.forEach((p, i) => {
        msg += `${i + 1}. ${p.numero || 'N/A'} - ${p.tribunal || 'N/A'}\n`;
      });
      await enviarMensagem(chatId, msg);
    }
  } catch (erro) {
    await enviarMensagem(chatId, `❌ Erro interno: ${erro.message}`);
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
      await enviarMensagem(chatId, `��� Bem-vindo!\nComando: /oab MS 3616`);
    }

    return { statusCode: 200, body: 'OK' };
  } catch (erro) {
    console.error(erro);
    return { statusCode: 200, body: 'OK' };
  }
}
