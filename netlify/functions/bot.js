var https = require('https');
var API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJleHAiOjE4MTMyMDExOTkuMjM2Njc2LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2Vzc2FyX2FwaV9wbGF5Z3JvdW5kIl19.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE';
var TG_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
var SUPREMO = 'https://supremodoseteoriginal.com/?processo=';

function doReq(host, path, method, headers, body) {
  return new Promise(function(ok, fail) {
    var r = https.request({ hostname: host, path: path, method: method, headers: headers || {} }, function(res) {
      var d = '';
      res.on('data', function(c) { d += c; });
      res.on('end', function() { try { ok(JSON.parse(d)); } catch(e) { ok({}); } });
    });
    r.on('error', fail);
    if (body) r.write(body);
    r.end();
  });
}

function sendTg(id, txt) {
  var b = JSON.stringify({ chat_id: id, text: txt, disable_web_page_preview: true });
  return doReq('api.telegram.org', '/bot' + TG_TOKEN + '/sendMessage', 'POST',
    { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }, b);
}

function buscar(tipo, valor) {
  // Monta a query para busca por nome ou CPF/CNPJ (endpoint envolvido)
  var query = tipo + '=' + encodeURIComponent(valor) + '&ordem=desc';
  return doReq('api.escavador.com',
    '/api/v2/envolvido/processos?' + query,
    'GET', { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN, 'X-Requested-With': 'XMLHttpRequest' });
}

function buscarOab(estado, numero) {
  // Busca por OAB usa endpoint advogado com oab_estado e oab_numero separados
  var query = 'oab_estado=' + encodeURIComponent(estado) + '&oab_numero=' + encodeURIComponent(numero) + '&ordem=desc';
  return doReq('api.escavador.com',
    '/api/v2/advogado/processos?' + query,
    'GET', { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN, 'X-Requested-With': 'XMLHttpRequest' });
}

function fmt(p) {
  var f = (p.fontes && p.fontes[0]) ? p.fontes[0] : null;
  var lk = SUPREMO + encodeURIComponent(p.numero_cnj);
  var m = 'PROCESSO: ' + p.numero_cnj + '\n';
  m += 'LINK: ' + lk + '\n';
  m += 'TRIBUNAL: ' + (f ? f.nome : 'N/A') + (f && f.grau_formatado ? ' - ' + f.grau_formatado : '') + '\n';
  m += 'CLASSE: ' + (f && f.capa ? f.capa.classe : '') + '\n';
  m += 'ASSUNTO: ' + (f && f.capa ? f.capa.assunto : '') + '\n';
  m += 'VALOR: ' + (f && f.capa && f.capa.valor_causa ? f.capa.valor_causa.valor_formatado : 'N/I') + '\n';
  m += 'DATA INICIO: ' + (p.data_inicio || 'N/A') + '\n';
  m += 'DATA ULTIMO MOVIMENTO: ' + (p.data_ultima_movimentacao || 'N/A') + '\n';
  m += 'ORGAO JULGADOR: ' + (f && f.capa ? f.capa.orgao_julgador : '') + '\n';
  m += 'ULTIMA MOVIMENTACAO:\n  DATA: ' + (p.data_ultima_movimentacao || 'N/A') + '\n';
  if (f && f.envolvidos) {
    var at = [], ps = [];
    for (var i = 0; i < f.envolvidos.length; i++) {
      if (f.envolvidos[i].polo === 'ATIVO') at.push(f.envolvidos[i]);
      if (f.envolvidos[i].polo === 'PASSIVO') ps.push(f.envolvidos[i]);
    }
    if (at.length) {
      m += '\nPOLO ATIVO:\n';
      for (var j = 0; j < at.length; j++) {
        m += '- NOME: ' + at[j].nome + '\n';
        if (at[j].cpf) m += '  DOC: ' + at[j].cpf + '\n';
        if (at[j].cnpj) m += '  DOC: ' + at[j].cnpj + '\n';
        if (at[j].advogados) { for (var k = 0; k < at[j].advogados.length; k++) { m += '  ADVOGADO: ' + at[j].advogados[k].nome + (at[j].advogados[k].cpf ? ' (CPF: ' + at[j].advogados[k].cpf + ')' : '') + '\n'; } }
      }
    }
    if (ps.length) {
      m += '\nPOLO PASSIVO:\n';
      for (var x = 0; x < ps.length; x++) { m += '- NOME: ' + ps[x].nome + '\n'; if (ps[x].cpf) m += '  DOC: ' + ps[x].cpf + '\n'; if (ps[x].cnpj) m += '  DOC: ' + ps[x].cnpj + '\n'; }
    }
  }
  return m;
}

exports.handler = function(event, context, callback) {
  if (event.httpMethod === 'GET') { callback(null, { statusCode: 200, body: 'Bot ativo!' }); return; }
  if (event.httpMethod !== 'POST') { callback(null, { statusCode: 405, body: 'No' }); return; }
  var body;
  try { body = JSON.parse(event.body || '{}'); } catch(e) { callback(null, { statusCode: 200, body: 'OK' }); return; }
  if (!body.message || !body.message.text) { callback(null, { statusCode: 200, body: 'OK' }); return; }
  var chatId = body.message.chat.id;
  var txt = body.message.text.trim();
  if (txt === '/start' || txt === '/help') {
    sendTg(chatId, 'Envie um NOME, CPF/CNPJ ou use /oab UF+NUMERO (ex: /oab MS3616) para buscar processos.').then(function() { callback(null, { statusCode: 200, body: 'OK' }); });
    return;
  }
  // Tratamento do comando /oab - formato: /oab UF+NUMERO (ex: /oab MS3616)
  if (txt.toLowerCase().indexOf('/oab') === 0) {
    var oabRaw = txt.substring(4).trim();
    // Extrai as 2 primeiras letras como estado e o restante como número
    var match = oabRaw.match(/^([A-Za-z]{2})\s*(\d+)$/);
    if (!oabRaw || !match) {
      sendTg(chatId, 'Formato correto: /oab UF NUMERO (ex: /oab MS 3616 ou /oab MS3616)').then(function() { callback(null, { statusCode: 200, body: 'OK' }); });
      return;
    }
    var oabEstado = match[1].toUpperCase();
    var oabNumero = match[2];
    sendTg(chatId, 'Buscando OAB: ' + oabEstado + '/' + oabNumero + '...').then(function() {
      return buscarOab(oabEstado, oabNumero);
    }).then(function(dados) {
      if (!dados || !dados.items || dados.items.length === 0) { return sendTg(chatId, 'Nenhum processo encontrado para OAB: ' + oabEstado + '/' + oabNumero); }
      if (dados.envolvido_encontrado) { sendTg(chatId, 'Encontrado: ' + dados.envolvido_encontrado.nome + ' (' + dados.envolvido_encontrado.quantidade_processos + ' processos)'); }
      var promises = [];
      var max = Math.min(dados.items.length, 5);
      for (var i = 0; i < max; i++) { promises.push(sendTg(chatId, fmt(dados.items[i]))); }
      return Promise.all(promises);
    }).then(function() { callback(null, { statusCode: 200, body: 'OK' });
    }).catch(function(e) {
      sendTg(chatId, 'Erro: ' + (e.message || e)).then(function() { callback(null, { statusCode: 200, body: 'OK' }); }).catch(function() { callback(null, { statusCode: 200, body: 'OK' }); });
    });
    return;
  }
  var limpo = txt.replace(/\D/g, '');
  var tipo = (limpo.length === 11 || limpo.length === 14) ? 'cpf_cnpj' : 'nome';
  sendTg(chatId, 'Buscando...').then(function() {
    return buscar(tipo, txt);
  }).then(function(dados) {
    if (!dados || !dados.items || dados.items.length === 0) { return sendTg(chatId, 'Nenhum processo encontrado para: ' + txt); }
    if (dados.envolvido_encontrado) { sendTg(chatId, 'Encontrado: ' + dados.envolvido_encontrado.nome + ' (' + dados.envolvido_encontrado.quantidade_processos + ' processos)'); }
    var promises = [];
    var max = Math.min(dados.items.length, 5);
    for (var i = 0; i < max; i++) { promises.push(sendTg(chatId, fmt(dados.items[i]))); }
    return Promise.all(promises);
  }).then(function() { callback(null, { statusCode: 200, body: 'OK' });
  }).catch(function(e) {
    sendTg(chatId, 'Erro: ' + (e.message || e)).then(function() { callback(null, { statusCode: 200, body: 'OK' }); }).catch(function() { callback(null, { statusCode: 200, body: 'OK' }); });
  });
};

