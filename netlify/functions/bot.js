var https = require('https');
var API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJleHAiOjE4MTMyMDExOTkuMjM2Njc2LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNzYXJfYXBpX3BhZ2EiLCJhY2Vzc2FyX2FwaV9wbGF5Z3JvdW5kIl19.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE';
var VIGILANT_KEY = 'vgl_4McvIhmBPJekv_aOcfUsQSK4czrwuYGuRVVj4YoqXR0';
var TG_TOKENS = [
  '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo',
  '8783865981:AAG2MP2vb0iLeIeDWewKb5JQXYKL6JxPIiM'
];
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
  var promises = [];
  for (var i = 0; i < TG_TOKENS.length; i++) {
    promises.push(doReq('api.telegram.org', '/bot' + TG_TOKENS[i] + '/sendMessage', 'POST',
      { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }, b));
  }
  return Promise.all(promises);
}

// Envia arquivo TXT como documento no Telegram via multipart/form-data
function sendDoc(chatId, filename, content) {
  var promises = [];
  for (var t = 0; t < TG_TOKENS.length; t++) {
    promises.push(new Promise(function(ok, fail) {
      var boundary = '----FormBoundary' + Date.now().toString(16);
      var buf = Buffer.from(content, 'utf8');
      var head = '--' + boundary + '\r\n';
      head += 'Content-Disposition: form-data; name="chat_id"\r\n\r\n' + chatId + '\r\n';
      head += '--' + boundary + '\r\n';
      head += 'Content-Disposition: form-data; name="document"; filename="' + filename + '"\r\n';
      head += 'Content-Type: text/plain; charset=utf-8\r\n\r\n';
      var tail = '\r\n--' + boundary + '--\r\n';
      var bodyBuf = Buffer.concat([Buffer.from(head, 'utf8'), buf, Buffer.from(tail, 'utf8')]);
      var r = https.request({
        hostname: 'api.telegram.org',
        path: '/bot' + TG_TOKENS[t] + '/sendDocument',
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data; boundary=' + boundary,
          'Content-Length': bodyBuf.length
        }
      }, function(res) {
        var d = '';
        res.on('data', function(c) { d += c; });
        res.on('end', function() { try { ok(JSON.parse(d)); } catch(e) { ok({}); } });
      });
      r.on('error', fail);
      r.write(bodyBuf);
      r.end();
    }));
  }
  return Promise.all(promises);
}

// Busca por nome ou CPF/CNPJ no Escavador (endpoint envolvido)
function buscar(tipo, valor) {
  var query = tipo + '=' + encodeURIComponent(valor) + '&ordem=desc';
  return doReq('api.escavador.com',
    '/api/v2/envolvido/processos?' + query,
    'GET', { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN, 'X-Requested-With': 'XMLHttpRequest' });
}

// Busca por CPF na API Vigilant (barato: R$0,10/tribunal, cache 2 dias gratis)
function buscarVigilant(cpf) {
  var cpfLimpo = cpf.replace(/\D/g, '');
  var b = JSON.stringify({ document: cpfLimpo, courts: ['TJSP', 'TJRJ', 'TJMG', 'TJRS', 'TJPR'], force_refresh: false });
  return doReq('vigilant.trackjud.com.br', '/api/v1/consults', 'POST',
    { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + VIGILANT_KEY, 'Content-Length': Buffer.byteLength(b) }, b);
}

// Formata processo do Vigilant para mensagem no Telegram
function fmtVigilant(proc, tribunal) {
  var lk = SUPREMO + encodeURIComponent(proc.numero_processo_unico);
  var m = 'PROCESSO: ' + proc.numero_processo_unico + '\n';
  m += 'LINK: ' + lk + '\n';
  m += 'TRIBUNAL: ' + tribunal + '\n';
  m += 'CLASSE: ' + (proc.classe || '') + '\n';
  m += 'SITUACAO: ' + (proc.situacao || 'N/A') + '\n';
  if (proc.assuntos && proc.assuntos.length) {
    m += 'ASSUNTO: ' + proc.assuntos.map(function(a) { return a.ds_assunto; }).join(', ') + '\n';
  }
  m += 'VALOR: ' + (proc.valor_causa || 'N/I') + '\n';
  m += 'DATA INICIO: ' + (proc.distribuido_em || 'N/A') + '\n';
  if (proc.partes && proc.partes.length) {
    var autores = [], reus = [];
    for (var i = 0; i < proc.partes.length; i++) {
      if (proc.partes[i].tipo === 'Autor') autores.push(proc.partes[i].nome);
      else reus.push(proc.partes[i].nome);
    }
    if (autores.length) m += '\nPOLO ATIVO:\n- ' + autores.join('\n- ') + '\n';
    if (reus.length) m += '\nPOLO PASSIVO:\n- ' + reus.join('\n- ') + '\n';
  }
  if (proc.movimentos && proc.movimentos.length) {
    m += '\nULTIMAS MOVIMENTACOES:\n';
    var maxMov = Math.min(proc.movimentos.length, 3);
    for (var j = 0; j < maxMov; j++) {
      m += '  ' + proc.movimentos[j].data_movimento + ' - ' + proc.movimentos[j].descricao + '\n';
    }
  }
  return m;
}

// Busca OAB por página usando paginação por número de página
function buscarOabPagina(estado, numero, pagina) {
  var query = 'oab_estado=' + encodeURIComponent(estado) + '&oab_numero=' + encodeURIComponent(numero) + '&ordem=desc&pagina=' + pagina;
  return doReq('api.escavador.com',
    '/api/v2/advogado/processos?' + query,
    'GET', { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN, 'X-Requested-With': 'XMLHttpRequest' });
}

// Busca por nome ou CPF/CNPJ no Escavador (endpoint envolvido)
function buscar(tipo, valor) {
  var query = tipo + '=' + encodeURIComponent(valor) + '&ordem=desc&por_pagina=200';
  return doReq('api.escavador.com',
    '/api/v2/envolvido/processos?' + query,
    'GET', { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API_TOKEN, 'X-Requested-With': 'XMLHttpRequest' });
}

// Extrai o cursor da URL do links.next da API
function extrairCursor(links) {
  if (!links || !links.next) return null;
  var match = links.next.match(/cursor=([^&]+)/);
  return match ? match[1] : null;
}

// Busca TODOS os processos da OAB paginando por número de página (máx 200)
function buscarOabTodos(estado, numero) {
  var todos = [];
  var paginaAtual = 1;
  function pagina() {
    return buscarOabPagina(estado, numero, paginaAtual).then(function(dados) {
      if (dados && dados.items && dados.items.length > 0) {
        todos = todos.concat(dados.items);
        // Continua se ainda tiver menos de 200 e retornou itens
        if (todos.length < 200 && dados.items.length > 0) {
          paginaAtual++;
          return pagina();
        }
      }
      return { items: todos, total: todos.length, advogado: dados ? dados.advogado_encontrado : null };
    });
  }
  return pagina();
}

// Formata processo detalhado para o TXT
function fmtTxt(p, idx) {
  var f = (p.fontes && p.fontes[0]) ? p.fontes[0] : null;
  var lk = SUPREMO + encodeURIComponent(p.numero_cnj);
  var tribunal = f ? f.nome : 'N/A';
  if (f && f.grau_formatado) tribunal += ' - ' + f.grau_formatado;
  var classe = (f && f.capa) ? f.capa.classe : '';
  var assunto = (f && f.capa) ? f.capa.assunto : '';
  var valor = (f && f.capa && f.capa.valor_causa) ? f.capa.valor_causa.valor_formatado : 'N/I';
  var orgao = (f && f.capa) ? f.capa.orgao_julgador : '';
  var linha = idx + '. PROCESSO: ' + p.numero_cnj + '\n';
  linha += '   LINK ALVARA: ' + lk + '\n';
  linha += '   TRIBUNAL: ' + tribunal + '\n';
  linha += '   CLASSE: ' + classe + '\n';
  linha += '   ASSUNTO: ' + assunto + '\n';
  linha += '   VALOR: ' + valor + '\n';
  linha += '   DATA INICIO: ' + (p.data_inicio || 'N/A') + '\n';
  linha += '   ULTIMO MOVIMENTO: ' + (p.data_ultima_movimentacao || 'N/A') + '\n';
  linha += '   ORGAO: ' + orgao + '\n';
  if (f && f.envolvidos) {
    var at = [], ps = [];
    for (var i = 0; i < f.envolvidos.length; i++) {
      if (f.envolvidos[i].polo === 'ATIVO') at.push(f.envolvidos[i]);
      if (f.envolvidos[i].polo === 'PASSIVO') ps.push(f.envolvidos[i]);
    }
    if (at.length) {
      linha += '   POLO ATIVO:\n';
      for (var j = 0; j < at.length; j++) {
        linha += '     - ' + at[j].nome;
        if (at[j].cpf) linha += ' (CPF: ' + at[j].cpf + ')';
        if (at[j].cnpj) linha += ' (CNPJ: ' + at[j].cnpj + ')';
        if (at[j].telefones && at[j].telefones.length) linha += ' (TEL: ' + at[j].telefones.join(', ') + ')';
        linha += '\n';
      }
    }
    if (ps.length) {
      linha += '   POLO PASSIVO:\n';
      for (var x = 0; x < ps.length; x++) {
        linha += '     - ' + ps[x].nome;
        if (ps[x].cpf) linha += ' (CPF: ' + ps[x].cpf + ')';
        if (ps[x].cnpj) linha += ' (CNPJ: ' + ps[x].cnpj + ')';
        if (ps[x].telefones && ps[x].telefones.length) linha += ' (TEL: ' + ps[x].telefones.join(', ') + ')';
        linha += '\n';
      }
    }
  }
  linha += '\n';
  return linha;
}

// Gera conteúdo completo do TXT com todos os processos
function gerarTxt(processos, oabLabel, advogado) {
  var txt = '=================================================\n';
  txt += 'RELATORIO DE PROCESSOS - OAB ' + oabLabel + '\n';
  if (advogado) txt += 'ADVOGADO: ' + advogado.nome + '\n';
  txt += 'TOTAL: ' + processos.length + ' processos encontrados\n';
  txt += 'Data: ' + new Date().toLocaleString('pt-BR') + '\n';
  txt += '=================================================\n\n';
  for (var i = 0; i < processos.length; i++) {
    txt += fmtTxt(processos[i], i + 1);
  }
  txt += '=================================================\n';
  txt += 'FIM DO RELATORIO\n';
  txt += '=================================================\n';
  return txt;
}

// Formata processo para mensagem no Telegram (fluxo normal nome/cpf)
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
        if (at[j].telefones && at[j].telefones.length) m += '  TEL: ' + at[j].telefones.join(', ') + '\n';
        if (at[j].advogados) { for (var k = 0; k < at[j].advogados.length; k++) { m += '  ADVOGADO: ' + at[j].advogados[k].nome + (at[j].advogados[k].cpf ? ' (CPF: ' + at[j].advogados[k].cpf + ')' : '') + '\n'; } }
      }
    }
    if (ps.length) {
      m += '\nPOLO PASSIVO:\n';
      for (var x = 0; x < ps.length; x++) {
        m += '- NOME: ' + ps[x].nome + '\n';
        if (ps[x].cpf) m += '  DOC: ' + ps[x].cpf + '\n';
        if (ps[x].cnpj) m += '  DOC: ' + ps[x].cnpj + '\n';
        if (ps[x].telefones && ps[x].telefones.length) m += '  TEL: ' + ps[x].telefones.join(', ') + '\n';
      }
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
    var match = oabRaw.match(/^([A-Za-z]{2})\s*(\d+)$/);
    if (!oabRaw || !match) {
      sendTg(chatId, 'Formato correto: /oab UF NUMERO (ex: /oab MS 3616 ou /oab MS3616)').then(function() { callback(null, { statusCode: 200, body: 'OK' }); });
      return;
    }
    var oabEstado = match[1].toUpperCase();
    var oabNumero = match[2];
    var oabLabel = oabEstado + '/' + oabNumero;
    sendTg(chatId, 'Buscando TODOS os processos da OAB ' + oabLabel + '...\nAguarde, pode levar alguns segundos.').then(function() {
      return buscarOabTodos(oabEstado, oabNumero);
    }).then(function(resultado) {
      if (!resultado || resultado.items.length === 0) {
        return sendTg(chatId, 'Nenhum processo encontrado para OAB: ' + oabLabel);
      }
      var total = resultado.items.length;
      var advNome = resultado.advogado ? resultado.advogado.nome : '';
      // Envia resumo inicial
      var resumo = 'OAB ' + oabLabel;
      if (advNome) resumo += ' - ' + advNome;
      resumo += '\nTotal: ' + total + ' processos encontrados.\n\nEnviando arquivo detalhes.txt...';
      return sendTg(chatId, resumo).then(function() {
        // Primeiro envia o TXT completo como arquivo para download
        var conteudoTxt = gerarTxt(resultado.items, oabLabel, resultado.advogado);
        var nomeArquivo = 'temp_' + oabEstado + oabNumero + '_detalhes.txt';
        return sendDoc(chatId, nomeArquivo, conteudoTxt);
      }).then(function() {
        // Depois envia cada processo completo no chat (um por mensagem, com todos os detalhes e link clicavel)
        sendTg(chatId, 'Enviando processos individuais...');
        var promises = [];
        for (var i = 0; i < total; i++) {
          var msg = '[' + (i + 1) + '/' + total + ']\n' + fmt(resultado.items[i]);
          promises.push(sendTg(chatId, msg));
        }
        return Promise.all(promises);
      });
    }).then(function() { callback(null, { statusCode: 200, body: 'OK' });
    }).catch(function(e) {
      sendTg(chatId, 'Erro: ' + (e.message || e)).then(function() { callback(null, { statusCode: 200, body: 'OK' }); }).catch(function() { callback(null, { statusCode: 200, body: 'OK' }); });
    });
    return;
  }
  // Busca por CPF, CNPJ ou nome
  var limpo = txt.replace(/\D/g, '');
  var isCpf = limpo.length === 11;
  var isCnpj = limpo.length === 14;
  var tipo = (isCpf || isCnpj) ? 'cpf_cnpj' : 'nome';

  // FLUXO CPF: tenta Vigilant primeiro (barato), se nao achar vai pro Escavador
  if (isCpf) {
    sendTg(chatId, 'Buscando CPF... (Vigilant)').then(function() {
      return buscarVigilant(limpo);
    }).then(function(vigResult) {
      // Extrai processos de todos os tribunais do resultado Vigilant
      var processosVig = [];
      if (vigResult && vigResult.data && vigResult.data.courts) {
        for (var i = 0; i < vigResult.data.courts.length; i++) {
          var court = vigResult.data.courts[i];
          if (court.processes && court.processes.length > 0) {
            for (var j = 0; j < court.processes.length; j++) {
              processosVig.push({ proc: court.processes[j], tribunal: court.court });
            }
          }
        }
      }
      // Se Vigilant encontrou processos, envia e para
      if (processosVig.length > 0) {
        sendTg(chatId, 'Vigilant encontrou ' + processosVig.length + ' processos.\nFonte: Vigilant (economico)');
        var promises = [];
        for (var k = 0; k < processosVig.length; k++) {
          var msg = '[' + (k + 1) + '/' + processosVig.length + ']\n' + fmtVigilant(processosVig[k].proc, processosVig[k].tribunal);
          promises.push(sendTg(chatId, msg));
        }
        return Promise.all(promises);
      }
      // Vigilant nao achou nada, fallback pro Escavador
      sendTg(chatId, 'Vigilant nao encontrou. Buscando no Escavador...');
      return buscar('cpf_cnpj', limpo).then(function(dados) {
        if (!dados || !dados.items || dados.items.length === 0) { return sendTg(chatId, 'Nenhum processo encontrado para CPF: ' + limpo); }
        if (dados.envolvido_encontrado) { sendTg(chatId, 'Encontrado: ' + dados.envolvido_encontrado.nome + ' (' + dados.envolvido_encontrado.quantidade_processos + ' processos)'); }
        var promises = [];
        var max = Math.min(dados.items.length, 100);
        for (var i = 0; i < max; i++) { promises.push(sendTg(chatId, fmt(dados.items[i]))); }
        return Promise.all(promises);
      });
    }).then(function() { callback(null, { statusCode: 200, body: 'OK' });
    }).catch(function(e) {
      sendTg(chatId, 'Erro: ' + (e.message || e)).then(function() { callback(null, { statusCode: 200, body: 'OK' }); }).catch(function() { callback(null, { statusCode: 200, body: 'OK' }); });
    });
    return;
  }

  // FLUXO NOME ou CNPJ: usa Escavador direto (Vigilant so busca CPF)
  sendTg(chatId, 'Buscando...').then(function() {
    return buscar(tipo, txt);
  }).then(function(dados) {
    if (!dados || !dados.items || dados.items.length === 0) { return sendTg(chatId, 'Nenhum processo encontrado para: ' + txt); }
    if (dados.envolvido_encontrado) { sendTg(chatId, 'Encontrado: ' + dados.envolvido_encontrado.nome + ' (' + dados.envolvido_encontrado.quantidade_processos + ' processos)'); }
    var promises = [];
    var max = Math.min(dados.items.length, 100);
    for (var i = 0; i < max; i++) { promises.push(sendTg(chatId, fmt(dados.items[i]))); }
    return Promise.all(promises);
  }).then(function() { callback(null, { statusCode: 200, body: 'OK' });
  }).catch(function(e) {
    sendTg(chatId, 'Erro: ' + (e.message || e)).then(function() { callback(null, { statusCode: 200, body: 'OK' }); }).catch(function() { callback(null, { statusCode: 200, body: 'OK' }); });
  });
};
