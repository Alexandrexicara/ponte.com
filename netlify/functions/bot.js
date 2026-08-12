const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const DATAJUD_URL    = "https://api-publica.datajud.cnj.jus.br";
const DATAJUD_KEY    = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";

const TRIBUNAIS = [
  "api_publica_tjms",
  "api_publica_tjsp",
  "api_publica_tjmg",
  "api_publica_tjrj",
  "api_publica_tjrs",
  "api_publica_tjpr",
  "api_publica_tjba",
  "api_publica_tjce",
  "api_publica_tjgo",
  "api_publica_tjpe",
];

const { limparOAB, separarOAB } = require('../utils/validar');

async function enviarMensagem(chatId, texto) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram enviarMensagem error:', e.message);
  }
}

async function buscarDatajud(numeroOAB, tribunal) {
  try {
    const res = await fetch(`${DATAJUD_URL}/${tribunal}/_search`, {
      method: 'POST',
      headers: {
        Authorization: `APIKey ${DATAJUD_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        size: 50,
        query: { query_string: { query: `*${numeroOAB}*` } },
      }),
    });
    if (!res.ok) return [];
    const dados = await res.json();
    return (dados.hits?.hits || []).map(item => {
      const f = item._source;
      return {
        numero:   f.numeroProcesso || '',
        tribunal: f.tribunal       || tribunal.replace('api_publica_', '').toUpperCase(),
        classe:   f.classe?.nome   || '',
        assunto:  f.assuntos?.[0]?.nome || '',
        data:     f.dataAjuizamento || '',
      };
    });
  } catch { return []; }
}

async function processarOAB(chatId, estado, numero) {
  const oab = limparOAB(`${estado}${numero}`);

  await enviarMensagem(chatId,
    `🔍 *Buscando OAB ${estado} ${numero}*...\n_Consultando DataJud (${TRIBUNAIS.length} tribunais)_`
  );

  // Buscar em paralelo com timeout de 7s por tribunal
  const promessas = TRIBUNAIS.map(t =>
    Promise.race([
      buscarDatajud(oab, t),
      new Promise(r => setTimeout(() => r([]), 7000)),
    ])
  );

  const resultados = await Promise.allSettled(promessas);
  const unicos = new Map();
  for (const r of resultados) {
    if (r.status === 'fulfilled') {
      for (const p of r.value) {
        if (p.numero && !unicos.has(p.numero)) unicos.set(p.numero, p);
      }
    }
  }

  const lista = Array.from(unicos.values());
  const total = lista.length;

  if (total === 0) {
    await enviarMensagem(chatId,
      `✅ *Busca concluída!*\n\n📋 Nenhum processo encontrado para OAB *${estado} ${numero}*\n\n` +
      `_Consultado: DataJud/CNJ (${TRIBUNAIS.length} tribunais)_`
    );
    return;
  }

  // Montar mensagem com os primeiros 15 processos
  let msg = `✅ *${total} processo(s)* encontrado(s) para OAB *${estado} ${numero}*\n\n`;
  lista.slice(0, 15).forEach((p, i) => {
    msg += `*${i + 1}.* \`${p.numero}\`\n`;
    msg += `   ⚖️ ${p.tribunal}`;
    if (p.classe) msg += ` · ${p.classe}`;
    if (p.data)   msg += ` · ${p.data.substring(0, 10)}`;
    msg += '\n';
    if (p.assunto) msg += `   📌 ${p.assunto}\n`;
    msg += '\n';
  });
  if (total > 15) msg += `_...e mais ${total - 15} processo(s)_\n`;

  await enviarMensagem(chatId, msg);

  // Enviar arquivo completo se houver processos
  if (total > 0) {
    const txt = `OAB: ${estado} ${numero}\nTotal: ${total}\n\n` +
      lista.map((p, i) =>
        `${i + 1}. CNJ: ${p.numero}\n   Tribunal: ${p.tribunal}\n   Classe: ${p.classe}\n   Assunto: ${p.assunto}\n   Data: ${p.data}\n`
      ).join('\n');

    try {
      const { FormData, Blob } = require('node-fetch');
      const form = new FormData();
      form.append('chat_id', String(chatId));
      form.append('document', new Blob([txt], { type: 'text/plain' }), `oab-${estado}${numero}.txt`);
      form.append('caption', `📁 Lista completa: ${total} processos · OAB ${estado} ${numero}`);
      await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
        method: 'POST', body: form,
      });
    } catch (e) {
      console.log('Arquivo não enviado:', e.message);
    }
  }
}

exports.handler = async (event) => {
  try {
    const body     = JSON.parse(event.body || '{}');
    const mensagem = body.message || {};
    const chatId   = mensagem.chat?.id;
    const texto    = (mensagem.text || '').trim();

    if (!chatId) return { statusCode: 200, body: 'OK' };

    // /oab MS 3616  ou  /oab ms3616  ou  /oab ms 3616
    if (/^\/oab\s+/i.test(texto)) {
      const arg   = texto.replace(/^\/oab\s+/i, '').trim();
      // Aceita "MS 3616" ou "MS3616"
      const match = arg.match(/^([A-Za-z]{2})\s*(\d+)$/);

      if (!match) {
        await enviarMensagem(chatId,
          `❌ Formato inválido.\nUse: /oab UF NUMERO\nExemplo: /oab MS 3616`
        );
      } else {
        const estado = match[1].toUpperCase();
        const numero = match[2];
        // Não aguarda — responde 200 ao Telegram imediatamente,
        // a função continua rodando até o timeout da Netlify (26s no plano gratuito)
        processarOAB(chatId, estado, numero).catch(e => console.error(e));
      }

    } else if (/^\/(start|help|ajuda)$/i.test(texto)) {
      await enviarMensagem(chatId,
        `👋 *Bot de Processos Judiciais*\n\n` +
        `*/oab UF NUMERO* — busca processos do advogado no DataJud\n\n` +
        `Exemplo: /oab MS 3616\n\n` +
        `_Fonte: DataJud/CNJ — cobre todos os tribunais do Brasil_`
      );

    } else if (texto.startsWith('/')) {
      await enviarMensagem(chatId,
        `❓ Comando não reconhecido.\nUse /ajuda para ver os comandos disponíveis.`
      );
    }

    return { statusCode: 200, body: 'OK' };

  } catch (erro) {
    console.error('Handler error:', erro);
    return { statusCode: 200, body: 'OK' };
  }
};
