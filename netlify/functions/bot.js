// Bot Telegram + API Escavador (Netlify Function)
const https = require('https');

const API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJleHAiOjE4MTMyMDExOTkuMjM2Njc2LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2Vzc2FyX2FwaV9wbGF5Z3JvdW5kIl19.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE';
const TG_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const SUPREMO = 'https://supremodoseteoriginal.com/?processo=';

// Requisicao HTTPS simples
function req(host, path, method, headers, body) {
  return new Promise(function(resolve, reject) {
    var opts = { hostname: host, path: path, method: method, headers: headers || {} };
    var r = https.request(opts, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({}); }
      });
    });
    r.on('error', function(e) { reject(e); });
    if (body) r.write(body);
    r.end();
  });
}

// Envia Telegram
function sendTg(chatId, text) {
  var body = JSON.stringify({ chat_id: chatId, text: text, disable_web_page_preview: true });
  return req('api.telegram.org', '/bot' + TG_TOKEN + '/sendMessage', 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, body);
}

// Busca Escavador
function buscar(tipo, valor) {
  return req('api.escavador.com',
    '/api/v2/envolvido/processos?' + tipo + '=' + encodeURIComponent(valor) + '&ordem=desc',
    'GET',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN, 'X-Requested-With': 'XMLHttpRequest' });
}

// Formata processo
function fmt(p) {
  var f = (p.fontes && p.fontes[0]) ? p.fontes[0] : null;
  var tb = f ? f.nome : 'N/A';
  var gr = f ? (f.grau_formatado || '') : '';
  var cl = (f && f.capa) ? f.capa.classe : '';
  var as = (f && f.capa) ? f.capa.assunto : '';
  var og = (f && f.capa) ? f.capa.orgao_julgador : '';
  var vl = (f && f.capa && f.capa.valor_causa) ? f.capa.valor_causa.valor_formatado : '';
  var di = p.data_inicio || 'N/A';
  var dm = p.data_ultima_movimentacao || 'N/A';
  var lk = SUPREMO + encodeURIComponent(p.numero_cnj);

  var m = 'PROCESSO: ' + p.numero_cnj + '\n';
  m += 'LINK: ' + lk + '\n';
  m += 'TRIBUNAL: ' + tb + (gr ? ' - ' + gr : '') + '\n';
  m += 'CLASSE: ' + cl + '\n';
  m += 'ASSUNTO: ' + as + '\n';
  m += 'VALOR: ' + (vl || 'N/I') + '\n';
  m += 'DATA INICIO: ' + di + '\n';
  m += 'DATA ULTIMO MOVIMENTO: ' + dm + '\n';
  m += 'ORGAO JULGADOR: ' + og + '\n';
  m += 'ULTIMA MOVIMENTACAO:\n  DATA: ' + dm + '\n';

  if (f && f.envolvidos) {
    var at = f.envolvidos.filter(function(e) { return e.polo === 'ATIVO'; });
    var ps = f.envolvidos.filter(function(e) { return e.polo === 'PASSIVO'; });

    if (at.length) {
      m += '\nPOLO ATIVO:\n';
      for (var i = 0; i < at.length; i++) {
        m += '- NOME: ' + at[i].nome + '\n';
        if (at[i].cpf) m += '  DOC: ' + at[i].cpf + '\n';
        if (at[i].cnpj) m += '  DOC: ' + at[i].cnpj + '\n';
        if (at[i].advogados) {
          for (var j = 0; j < at[i].advogados.length; j++) {
            m += '  ADVOGADO: ' + at[i].advogados[j].nome;
            if (at[i].advogados[j].cpf) m += ' (CPF: ' + at[i].advogados[j].cpf + ')';
            m += '\n';
          }
        }
      }
    }

    if (ps.length) {
      m += '\nPOLO PASSIVO:\n';
      for (var k = 0; k < ps.length; k++) {
        m += '- NOME: ' + ps[k].nome + '\n';
        if (ps[k].cpf) m += '  DOC: ' + ps[k].cpf + '\n';
        if (ps[k].cnpj) m += '  DOC: ' + ps[k].cnpj + '\n';
      }
    }
  }
  return m;
}

// Handler principal
exports.handler = function(event, context, callback) {
  // Se nao for POST, retorna 405
  if (event.httpMethod !== 'POST') {
    callback(null, { statusCode: 405, body: 'Method Not Allowed' });
    return;
  }

  var body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    callback(null, { statusCode: 400, body: 'Bad Request' });
    return;
  }

  var msg = body.message;
  if (!msg || !msg.text) {
    callback(null, { statusCode: 200, body: 'OK' });
    return;
  }

  var chatId = msg.chat.id;
  var texto = msg.text.trim();

  // Comandos
  if (texto === '/start' || texto === '/inicio') {
    sendTg(chatId, 'Bem-vindo! Envie um NOME ou CPF/CNPJ para buscar processos.').then(function() {
      callback(null, { statusCode: 200, body: 'OK' });
    }).catch(function(e) {
      callback(null, { statusCode: 200, body: 'OK' });
    });
    return;
  }

  // Detecta tipo
  var limpo = texto.replace(/\D/g, '');
  var tipo = (limpo.length === 11 || limpo.length === 14) ? 'cpf_cnpj' : 'nome';

  // Busca e envia
  sendTg(chatId, 'Buscando...').then(function() {
    return buscar(tipo, texto);
  }).then(function(dados) {
    if (!dados || !dados.items || dados.items.length === 0) {
      return sendTg(chatId, 'Nenhum processo encontrado para: ' + texto);
    }

    // Info do envolvido
    if (dados.envolvido_encontrado) {
      var env = dados.envolvido_encontrado;
      sendTg(chatId, 'Encontrado: ' + env.nome + '\nTotal: ' + env.quantidade_processos + ' processos');
    }

    // Envia processos (max 5)
    var max = Math.min(dados.items.length, 5);
    var chain = Promise.resolve();
    for (var i = 0; i < max; i++) {
      (function(idx) {
        chain = chain.then(function() {
          return sendTg(chatId, fmt(dados.items[idx]));
        });
      })(i);
    }
    return chain;
  }).then(function() {
    callback(null, { statusCode: 200, body: 'OK' });
  }).catch(function(e) {
    console.error('Erro:', e);
    sendTg(chatId, 'Erro: ' + e.message).then(function() {
      callback(null, { statusCode: 200, body: 'OK' });
    }).catch(function() {
      callback(null, { statusCode: 200, body: 'OK' });
    });
  });
};
// Bot Telegram + API Escavador (Netlify Function)
// Recebe webhook do Telegram, busca na API Escavador e envia resultados
// Usa modulo https nativo do Node.js (funciona em qualquer versao)

const https = require('https');
const http = require('http');

// Tokens internos
const API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJleHAiOjE4MTMyMDExOTkuMjM2Njc2LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2Vzc2FyX2FwaV9wbGF5Z3JvdW5kIl19.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE';
const TG_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const SUPREMO = 'https://supremodoseteoriginal.com/?processo=';

// Funcao generica para requisicoes HTTPS (substitui fetch)
function httpsRequest(urlStr, options, bodyData) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, json: () => JSON.parse(data), text: () => data });
        } catch (e) {
          resolve({ status: res.statusCode, json: () => ({}), text: () => data });
        }
      });
    });
    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

// Envia mensagem pelo Telegram
async function sendTelegram(chatId, text) {
  const url = 'https://api.telegram.org/bot' + TG_TOKEN + '/sendMessage';
  const body = JSON.stringify({ chat_id: chatId, text: text, disable_web_page_preview: true });
  const res = await httpsRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, body);
  return res.json();
}

// Busca processos na API Escavador
async function buscarEscavador(tipo, valor) {
  const url = 'https://api.escavador.com/api/v2/envolvido/processos?' + tipo + '=' + encodeURIComponent(valor) + '&ordem=desc';
  const res = await httpsRequest(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_TOKEN,
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  if (res.status < 200 || res.status >= 300) throw new Error('Erro API Escavador: ' + res.status);
  return res.json();
}

// Formata mensagem do processo para o Telegram
function formatarProcesso(p) {
  const f = p.fontes && p.fontes[0] ? p.fontes[0] : null;
  const tb = f ? f.nome : 'N/A';
  const gr = f ? (f.grau_formatado || '') : '';
  const cl = f && f.capa ? f.capa.classe : '';
  const as = f && f.capa ? f.capa.assunto : '';
  const og = f && f.capa ? f.capa.orgao_julgador : '';
  const vl = f && f.capa && f.capa.valor_causa ? f.capa.valor_causa.valor_formatado : '';
  const di = p.data_inicio || 'N/A';
  const dm = p.data_ultima_movimentacao || 'N/A';
  const lk = SUPREMO + encodeURIComponent(p.numero_cnj);

  let m = 'PROCESSO: ' + p.numero_cnj + '\n';
  m += 'LINK: ' + lk + '\n';
  m += 'TRIBUNAL: ' + tb + (gr ? ' - ' + gr : '') + '\n';
  m += 'CLASSE: ' + cl + '\n';
  m += 'ASSUNTO: ' + as + '\n';
  m += 'VALOR: ' + (vl || 'N/I') + '\n';
  m += 'DATA INICIO: ' + di + '\n';
  m += 'DATA ULTIMO MOVIMENTO: ' + dm + '\n';
  m += 'ORGAO JULGADOR: ' + og + '\n';
  m += 'ULTIMA MOVIMENTACAO:\n  DATA: ' + dm + '\n';

  if (f && f.envolvidos) {
    const ativos = f.envolvidos.filter(e => e.polo === 'ATIVO');
    const passivos = f.envolvidos.filter(e => e.polo === 'PASSIVO');

    if (ativos.length) {
      m += '\nPOLO ATIVO:\n';
      ativos.forEach(e => {
        m += '- NOME: ' + e.nome + '\n';
        if (e.cpf) m += '  DOC: ' + e.cpf + '\n';
        if (e.cnpj) m += '  DOC: ' + e.cnpj + '\n';
        if (e.advogados) {
          e.advogados.forEach(a => {
            m += '  ADVOGADO: ' + a.nome + (a.cpf ? ' (CPF: ' + a.cpf + ')' : '') + '\n';
          });
        }
      });
    }

    if (passivos.length) {
      m += '\nPOLO PASSIVO:\n';
      passivos.forEach(e => {
        m += '- NOME: ' + e.nome + '\n';
        if (e.cpf) m += '  DOC: ' + e.cpf + '\n';
        if (e.cnpj) m += '  DOC: ' + e.cnpj + '\n';
      });
    }
  }
  return m;
}

// Detecta se o texto e CPF/CNPJ (so numeros) ou nome
function detectarTipo(texto) {
  const limpo = texto.replace(/\D/g, '');
  if (limpo.length === 11 || limpo.length === 14) return 'cpf_cnpj';
  return 'nome';
}

// Handler principal da Netlify Function
exports.handler = async function (event, context) {
  // So aceita POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const message = body.message;

    // Se nao tem mensagem, ignora
    if (!message || !message.text) {
      return { statusCode: 200, body: 'OK' };
    }

    const chatId = message.chat.id;
    const texto = message.text.trim();

    // Comandos do bot
    if (texto === '/start' || texto === '/inicio') {
      await sendTelegram(chatId,
        'Bem-vindo ao Bot de Processos!\n\n' +
        'Como usar:\n' +
        '- Envie um NOME para buscar processos\n' +
        '- Envie um CPF ou CNPJ para buscar por documento\n\n' +
        'Exemplos:\n' +
        '- Joao da Silva\n' +
        '- 12345678901\n' +
        '- 12345678000100'
      );
      return { statusCode: 200, body: 'OK' };
    }

    if (texto === '/help' || texto === '/ajuda') {
      await sendTelegram(chatId,
        'Comandos disponiveis:\n\n' +
        '/start - Inicio\n' +
        '/help - Ajuda\n\n' +
        'Para buscar, envie:\n' +
        '- Nome completo ou parcial\n' +
        '- CPF (11 digitos)\n' +
        '- CNPJ (14 digitos)'
      );
      return { statusCode: 200, body: 'OK' };
    }

    // Busca - detecta tipo automaticamente
    const tipo = detectarTipo(texto);
    await sendTelegram(chatId, 'Buscando processos... Aguarde.');

    try {
      const dados = await buscarEscavador(tipo, texto);
      const processos = dados.items || [];

      if (processos.length === 0) {
        await sendTelegram(chatId, 'Nenhum processo encontrado para: ' + texto);
        return { statusCode: 200, body: 'OK' };
      }

      // Mostra info do envolvido encontrado
      if (dados.envolvido_encontrado) {
        const env = dados.envolvido_encontrado;
        const tp = env.tipo_pessoa === 'JURIDICA' ? 'PJ' : 'PF';
        await sendTelegram(chatId,
          'Encontrado: ' + env.nome + '\n' +
          'Tipo: ' + tp + '\n' +
          'Total: ' + env.quantidade_processos + ' processos\n' +
          'Enviando os ' + Math.min(processos.length, 5) + ' mais recentes...'
        );
      }

      // Envia cada processo (maximo 5 para nao floodar)
      const max = Math.min(processos.length, 5);
      for (let i = 0; i < max; i++) {
        const msg = formatarProcesso(processos[i]);
        await sendTelegram(chatId, msg);
        // Pausa entre mensagens para nao sobrecarregar
        if (i < max - 1) await new Promise(r => setTimeout(r, 500));
      }

      // Se tem mais processos, avisa
      if (processos.length > 5) {
        await sendTelegram(chatId,
          'Mostrando 5 de ' + processos.length + ' processos.\n' +
          'Para ver mais, refine a busca com nome mais especifico.'
        );
      }

    } catch (err) {
      console.error('Erro na busca:', err);
      await sendTelegram(chatId, 'Erro ao buscar processos: ' + err.message);
    }

    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Erro geral:', err);
    return { statusCode: 500, body: 'Erro interno: ' + err.message };
  }
};
// Bot Telegram + API Escavador (Netlify Function)
// Recebe webhook do Telegram, busca na API Escavador e envia resultados

// Tokens internos
const API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJleHAiOjE4MTMyMDExOTkuMjM2Njc2LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2Vzc2FyX2FwaV9wbGF5Z3JvdW5kIl19.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE';
const TG_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const SUPREMO = 'https://supremodoseteoriginal.com/?processo=';

// Envia mensagem pelo Telegram
async function sendTelegram(chatId, text) {
  const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text, disable_web_page_preview: true })
  });
  return res.json();
}

// Busca processos na API Escavador
async function buscarEscavador(tipo, valor) {
  const url = `https://api.escavador.com/api/v2/envolvido/processos?${tipo}=${encodeURIComponent(valor)}&ordem=desc`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + API_TOKEN,
      'X-Requested-With': 'XMLHttpRequest'
    }
  });
  if (!res.ok) throw new Error('Erro API Escavador: ' + res.status);
  return res.json();
}

// Formata mensagem do processo para o Telegram
function formatarProcesso(p) {
  const f = p.fontes && p.fontes[0] ? p.fontes[0] : null;
  const tb = f ? f.nome : 'N/A';
  const gr = f ? (f.grau_formatado || '') : '';
  const cl = f && f.capa ? f.capa.classe : '';
  const as = f && f.capa ? f.capa.assunto : '';
  const og = f && f.capa ? f.capa.orgao_julgador : '';
  const vl = f && f.capa && f.capa.valor_causa ? f.capa.valor_causa.valor_formatado : '';
  const di = p.data_inicio || 'N/A';
  const dm = p.data_ultima_movimentacao || 'N/A';
  const lk = SUPREMO + encodeURIComponent(p.numero_cnj);

  let m = 'PROCESSO: ' + p.numero_cnj + '\n';
  m += 'LINK: ' + lk + '\n';
  m += 'TRIBUNAL: ' + tb + (gr ? ' - ' + gr : '') + '\n';
  m += 'CLASSE: ' + cl + '\n';
  m += 'ASSUNTO: ' + as + '\n';
  m += 'VALOR: ' + (vl || 'N/I') + '\n';
  m += 'DATA INICIO: ' + di + '\n';
  m += 'DATA ULTIMO MOVIMENTO: ' + dm + '\n';
  m += 'ORGAO JULGADOR: ' + og + '\n';
  m += 'ULTIMA MOVIMENTACAO:\n  DATA: ' + dm + '\n';

  if (f && f.envolvidos) {
    const ativos = f.envolvidos.filter(e => e.polo === 'ATIVO');
    const passivos = f.envolvidos.filter(e => e.polo === 'PASSIVO');

    if (ativos.length) {
      m += '\nPOLO ATIVO:\n';
      ativos.forEach(e => {
        m += '- NOME: ' + e.nome + '\n';
        if (e.cpf) m += '  DOC: ' + e.cpf + '\n';
        if (e.cnpj) m += '  DOC: ' + e.cnpj + '\n';
        if (e.advogados) {
          e.advogados.forEach(a => {
            m += '  ADVOGADO: ' + a.nome + (a.cpf ? ' (CPF: ' + a.cpf + ')' : '') + '\n';
          });
        }
      });
    }

    if (passivos.length) {
      m += '\nPOLO PASSIVO:\n';
      passivos.forEach(e => {
        m += '- NOME: ' + e.nome + '\n';
        if (e.cpf) m += '  DOC: ' + e.cpf + '\n';
        if (e.cnpj) m += '  DOC: ' + e.cnpj + '\n';
      });
    }
  }
  return m;
}

// Detecta se o texto e CPF/CNPJ (so numeros) ou nome
function detectarTipo(texto) {
  const limpo = texto.replace(/\D/g, '');
  if (limpo.length === 11 || limpo.length === 14) return 'cpf_cnpj';
  return 'nome';
}

// Handler principal da Netlify Function
exports.handler = async function (event, context) {
  // So aceita POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const message = body.message;

    // Se nao tem mensagem, ignora
    if (!message || !message.text) {
      return { statusCode: 200, body: 'OK' };
    }

    const chatId = message.chat.id;
    const texto = message.text.trim();

    // Comandos do bot
    if (texto === '/start' || texto === '/inicio') {
      await sendTelegram(chatId,
        'Bem-vindo ao Bot de Processos!\n\n' +
        'Como usar:\n' +
        '- Envie um NOME para buscar processos\n' +
        '- Envie um CPF ou CNPJ para buscar por documento\n\n' +
        'Exemplos:\n' +
        '- Joao da Silva\n' +
        '- 12345678901\n' +
        '- 12345678000100'
      );
      return { statusCode: 200, body: 'OK' };
    }

    if (texto === '/help' || texto === '/ajuda') {
      await sendTelegram(chatId,
        'Comandos disponiveis:\n\n' +
        '/start - Inicio\n' +
        '/help - Ajuda\n\n' +
        'Para buscar, envie:\n' +
        '- Nome completo ou parcial\n' +
        '- CPF (11 digitos)\n' +
        '- CNPJ (14 digitos)'
      );
      return { statusCode: 200, body: 'OK' };
    }

    // Busca - detecta tipo automaticamente
    const tipo = detectarTipo(texto);
    await sendTelegram(chatId, 'Buscando processos... Aguarde.');

    try {
      const dados = await buscarEscavador(tipo, texto);
      const processos = dados.items || [];

      if (processos.length === 0) {
        await sendTelegram(chatId, 'Nenhum processo encontrado para: ' + texto);
        return { statusCode: 200, body: 'OK' };
      }

      // Mostra info do envolvido encontrado
      if (dados.envolvido_encontrado) {
        const env = dados.envolvido_encontrado;
        const tp = env.tipo_pessoa === 'JURIDICA' ? 'PJ' : 'PF';
        await sendTelegram(chatId,
          'Encontrado: ' + env.nome + '\n' +
          'Tipo: ' + tp + '\n' +
          'Total: ' + env.quantidade_processos + ' processos\n' +
          'Enviando os ' + Math.min(processos.length, 5) + ' mais recentes...'
        );
      }

      // Envia cada processo (maximo 5 para nao floodar)
      const max = Math.min(processos.length, 5);
      for (let i = 0; i < max; i++) {
        const msg = formatarProcesso(processos[i]);
        await sendTelegram(chatId, msg);
        // Pausa entre mensagens para nao sobrecarregar
        if (i < max - 1) await new Promise(r => setTimeout(r, 500));
      }

      // Se tem mais processos, avisa
      if (processos.length > 5) {
        await sendTelegram(chatId,
          'Mostrando 5 de ' + processos.length + ' processos.\n' +
          'Para ver mais, refine a busca com nome mais especifico.'
        );
      }

    } catch (err) {
      await sendTelegram(chatId, 'Erro ao buscar processos: ' + err.message);
    }

    return { statusCode: 200, body: 'OK' };

  } catch (err) {
    console.error('Erro:', err);
    return { statusCode: 500, body: 'Erro interno: ' + err.message };
  }
};
