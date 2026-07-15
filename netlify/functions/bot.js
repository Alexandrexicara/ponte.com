












var https = require('https');
// Deploy atualizado: 2026-07-15 - Correção TLS + Retentativas + Estabilidade
var API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiODlkNGNiYTQ3Mzg3NDFiOTA0ZjJmM2UzNjg0NGI4ZTU2OGRjZjBkMGMyZTcxZTdjNTdiNTIzNzk5ZWEzZTY4MjBiZGY1NDljZDYwMzhjOTEiLCJpYXQiOjE3ODE2NDQzNTUuMjM4NDI0LCJuYmYiOjE3ODE2NDQzNTUuMjM4NDI1LCJzdWIiOiIzNjIwNzk2Iiwic2NvcGVzIjpbImFjZXNvb2JfYXBpX3BhZ2UiLCJhY2Nlc3NfYXBpX3BhZ2Vfcm91bmQiXX0.ssCp7b2NmDQ8rSPScMXZHoQ3VxNFvioav7qhOaJ1fiDixtA7OLkgM4dQDxgOq1oGya0JVUfiA7Dx7fAtvzI7zG3ExL4_bJ_qyLIKPHoexfZwBFULp4BzriXEXc48oAdHGB5N-UfaMoc0CQ5P0w8uX3J_N0Nb_4OpSaxHXP1nWERUsLvODed7SGdDv-mkoBOS-PVjEaL27AO4DrVuWu1gp4Ej3TUQ8gWW3MNRQb5TeBqhRNyNUIXBFRx_qtMxf88_wTCe--cZoECa0_AuMm5x6rld_aSHgAGljfK3wNDefKXa2v-fUcGSgUb1rnNFT4U2I9LiEkO9Npw5FpCzh52-prJ6orbTBlWgPflZt8JoNtAhH6xXeGhngmKNSAw_ckpQlStyDZ4oynXzTw6Nb9RMUIAb1DY902GUgBqNnwRYSbvnmD6vekSyzgcFwXMQX92T9F2PyFRikQA3b_dWgGfVN6gmzaAbieNN3WN_K123VzbRymiBNX9rz58LlM6H0VC4V86v2NL62036DCY6Kaqv1dRXQ0YSHKiQoek7KPAA2xdH3ftwVDR3Nx1GHjuwCqLmtQu1bdUV4NBukDUUH3dq35KLS8lCIhjzeiUoCoUqgGLKpRoxB1mvtIMH8d8p9CbGyONE5cZbO6w9c6r7f8PR7P_TBQwFIyHzUHHJAdC5IXE';
var VIGILANT_KEY = 'vgl_4McvIhmBPJekv_aOcfUsQSK4czrwuYGuRVVj4YoqXR0';
var TG_TOKENS = [
  '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo',
  '8783865981:AAG2MP2vb0iLeIeDWewKb5JQXYKL6JxPIiM'
];
var SUPREMO = 'https://supremodoseteoriginal.com/?processo=';

// ========== CONFIGURAÇÃO HTTPS CORRIGIDA ==========
const httpsAgent = new https.Agent({
  minVersion: 'TLSv1.2', // Força versão mínima compatível
  maxVersion: 'TLSv1.3',
  rejectUnauthorized: true,
  keepAlive: true,
  timeout: 15000, // 15s por requisição
  handshakeTimeout: 10000 // 10s para negociação TLS
});

// ========== FUNÇÃO AUXILIAR ==========
function finalizarRequisicao(callback) {
  if (typeof callback === 'function') callback(null, { statusCode: 200, body: 'OK' });
}

// ========== REQUISIÇÃO COM RETENTATIVA AUTOMÁTICA ==========
async function doReqComRetry(host, path, method, headers, body, tentativas = 3) {
  let ultimaErro;
  for (let t = 1; t <= tentativas; t++) {
    try {
      return await new Promise((ok, fail) => {
        const r = https.request({
          hostname: host,
          path, method, headers,
          agent: httpsAgent
        }, res => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => { try { ok(JSON.parse(d)); } catch { ok({}); } });
        });
        r.on('error', e => fail(e));
        if (body) r.write(body);
        r.end();
      });
    } catch (e) {
      ultimaErro = e;
      await new Promise(r => setTimeout(r, 1500 * t)); // Espera crescente
    }
  }
  throw ultimaErro;
}

function sendTg(id, txt) {
  const b = JSON.stringify({ chat_id: id, text: txt, disable_web_page_preview: true });
  return Promise.all(TG_TOKENS.map(tok =>
    doReqComRetry('api.telegram.org', `/bot${tok}/sendMessage`, 'POST',
      { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }, b)
  ));
}

function sendDoc(chatId, filename, content) {
  return Promise.all(TG_TOKENS.map(tok => new Promise((ok, fail) => {
    const boundary = `----FormBoundary${Date.now().toString(16)}`;
    const buf = Buffer.from(content, 'utf8');
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="${filename}"\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    const bodyBuf = Buffer.concat([Buffer.from(head), buf, Buffer.from(tail)]);
    const r = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${tok}/sendDocument`,
      method: 'POST',
      agent: httpsAgent,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { ok(JSON.parse(d)); } catch { ok({}); } });
    });
    r.on('error', fail);
    r.write(bodyBuf);
    r.end();
  })));
}

function buscarVigilant(cpf) {
  const limpo = cpf.replace(/\D/g, '');
  const b = JSON.stringify({ document: limpo, force_refresh: false });
  return doReqComRetry('vigilant.trackjud.com.br', '/api/v1/consults', 'POST',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${VIGILANT_KEY}`, 'Content-Length': Buffer.byteLength(b) }, b);
}

function fmtVigilant(proc, tribunal) {
  const lk = SUPREMO + encodeURIComponent(proc.numero_processo_unico);
  let m = `PROCESSO: ${proc.numero_processo_unico}\nLINK: ${lk}\nTRIBUNAL: ${tribunal}\nCLASSE: ${proc.classe || ''}\nSITUACAO: ${proc.situacao || 'N/A'}\n`;
  if (proc.assuntos?.length) m += `ASSUNTO: ${proc.assuntos.map(a => a.ds_assunto).join(', ')}\n`;
  m += `VALOR: ${proc.valor_causa || 'N/I'}\nDATA INICIO: ${proc.distribuido_em || 'N/A'}\n`;
  if (proc.partes?.length) {
    const aut = proc.partes.filter(p => p.tipo === 'Autor'), res = proc.partes.filter(p => p.tipo !== 'Autor');
    if (aut.length) m += `\nPOLO ATIVO:\n- ${aut.map(a => a.nome).join('\n- ')}\n`;
    if (res.length) m += `\nPOLO PASSIVO:\n- ${res.map(r => r.nome).join('\n- ')}\n`;
  }
  if (proc.movimentos?.length) {
    m += `\nULTIMAS MOVIMENTACOES:\n`;
    proc.movimentos.slice(0,3).forEach(mv => m += `  ${mv.data_movimento} - ${mv.descricao}\n`);
  }
  return m;
}

function buscarOabPagina(estado, numero, cursor) {
  let q = `oab_estado=${encodeURIComponent(estado)}&oab_numero=${encodeURIComponent(numero)}&ordem=desc&por_pagina=200`;
  if (cursor) q += `&cursor=${encodeURIComponent(cursor)}`;
  return doReqComRetry('api.escavador.com', `/api/v2/advogado/processos?${q}`, 'GET',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}`, 'X-Requested-With': 'XMLHttpRequest' });
}

async function buscarOabTodos(estado, numero) {
  const procUnicos = new Set();
  const todos = [];
  let adv = null, cursor = null;
  do {
    const res = await buscarOabPagina(estado, numero, cursor);
    if (!res) break;
    if (res.advogado && !adv) adv = res.advogado;
    res.items?.forEach(i => {
      if (!procUnicos.has(i.numero_cnj)) { procUnicos.add(i.numero_cnj); todos.push(i); }
    });
    cursor = res.links?.next?.match(/cursor=([^&]+)/)?.[1] || null;
  } while (cursor);
  return { items: todos, advogado: adv };
}

function buscar(tipo, valor) {
  const q = `${tipo}=${encodeURIComponent(valor)}&ordem=desc&por_pagina=200`;
  return doReqComRetry('api.escavador.com', `/api/v2/envolvido/processos?${q}`, 'GET',
    { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_TOKEN}`, 'X-Requested-With': 'XMLHttpRequest' });
}

function fmtTxt(p, idx) {
  const f = p.fontes?.[0] || null;
  const lk = SUPREMO + encodeURIComponent(p.numero_cnj);
  const tri = f ? `${f.nome}${f.grau_formatado ? ` - ${f.grau_formatado}` : ''}` : 'N/A';
  let ln = `${idx}. PROCESSO: ${p.numero_cnj}\n   LINK ALVARA: ${lk}\n   TRIBUNAL: ${tri}\n   CLASSE: ${f?.capa?.classe || ''}\n   ASSUNTO: ${f?.capa?.assunto || ''}\n   VALOR: ${f?.capa?.valor_causa?.valor_formatado || 'N/I'}\n   DATA INICIO: ${p.data_inicio || 'N/A'}\n   ULTIMO MOVIMENTO: ${p.data_ultima_movimentacao || 'N/A'}\n   ORGAO: ${f?.capa?.orgao_julgador || ''}\n`;
  if (f?.envolvidos) {
    const at = f.envolvidos.filter(x => x.polo === 'ATIVO'), ps = f.envolvidos.filter(x => x.polo === 'PASSIVO');
    if (at.length) { ln += `   POLO ATIVO:\n`; at.forEach(x => { ln += `     - ${x.nome}${x.cpf ? ` (CPF:${x.cpf})` : ''}${x.cnpj ? ` (CNPJ:${x.cnpj})` : ''}\n`; }); }
    if (ps.length) { ln += `   POLO PASSIVO:\n`; ps.forEach(x => { ln += `     - ${x.nome}${x.cpf ? ` (CPF:${x.cpf})` : ''}${x.cnpj ? ` (CNPJ:${x.cnpj})` : ''}\n`; }); }
  }
  return ln + `\n`;
}

function gerarTxt(procs, oab, adv) {
  let txt = `=================================================\nRELATORIO DE PROCESSOS - OAB ${oab}\n${adv ? `ADVOGADO: ${adv.nome}\n` : ''}TOTAL: ${procs.length} processos\nData: ${new Date().toLocaleString('pt-BR')}\n=================================================\n\n`;
  procs.forEach((p,i) => txt += fmtTxt(p,i+1));
  return txt + `=================================================\nFIM DO RELATORIO\n=================================================\n`;
}

function fmt(p) {
  const f = p.fontes?.[0] || null;
  let m = `PROCESSO: ${p.numero_cnj}\nLINK: ${SUPREMO+encodeURIComponent(p.numero_cnj)}\nTRIBUNAL: ${f ? `${f.nome}${f.grau_formatado?` - ${f.grau_formatado}`:''}`:'N/A'}\nCLASSE: ${f?.capa?.classe||''}\nASSUNTO: ${f?.capa?.assunto||''}\nVALOR: ${f?.capa?.valor_causa?.valor_formatado||'N/I'}\nDATA INICIO: ${p.data_inicio||'N/A'}\nULTIMA MOVIMENTACAO: ${p.data_ultima_movimentacao||'N/A'}\nORGAO: ${f?.capa?.orgao_julgador||''}\n`;
  if (f?.envolvidos) {
    const at = f.envolvidos.filter(x => x.polo === 'ATIVO'), ps = f.envolvidos.filter(x => x.polo === 'PASSIVO');
    if (at.length) { m += `\nPOLO ATIVO:\n`; at.forEach(x => { m += `- NOME: ${x.nome}${x.cpf?`\n  DOC: ${x.cpf}`:''}${x.cnpj?`\n  DOC: ${x.cnpj}`:''}\n`; }); }
    if (ps.length) { m += `\nPOLO PASSIVO:\n`; ps.forEach(x => { m += `- NOME: ${x.nome}${x.cpf?`\n  DOC: ${x.cpf}`:''}${x.cnpj?`\n  DOC: ${x.cnpj}`:''}\n`; }); }
  }
  return m;
}

exports.handler = async function(event, context, callback) {
  if (event.httpMethod === 'GET') return { statusCode:200, body:'✅ Bot ativo - Versão estável TLS' };
  if (event.httpMethod !== 'POST') return { statusCode:405, body:'Método inválido' };
  let body; try { body = JSON.parse(event.body||'{}'); } catch { return { statusCode:200, body:'OK' }; }
  if (!body.message?.text) return { statusCode:200, body:'OK' };

  const chatId = body.message.chat.id;
  const txt = body.message.text.trim();

  if (txt === '/start' || txt === '/help') {
    await sendTg(chatId, 'Envie NOME, CPF/CNPJ ou /oab UF NUMERO.\n✅ TLS corrigido, retentativas, sem duplicatas!');
    return finalizarRequisicao(callback);
  }

  if (txt.toLowerCase().startsWith('/oab')) {
    const m = txt.slice(4).trim().match(/^([A-Za-z]{2})\s*(\d+)$/);
    if (!m) { await sendTg(chatId, 'Uso: /oab MS 1234 ou /oab MS1234'); return finalizarRequisicao(callback); }
    const uf = m[1].toUpperCase(), num = m[2], oab = `${uf}/${num}`;
    try {
      await sendTg(chatId, '⏳ Buscando processos...');
      const res = await buscarOabTodos(uf, num);
      if (!res?.items?.length) { await sendTg(chatId, `Nenhum processo para OAB ${oab}`); return; }
      await sendTg(chatId, `✅ ${res.items.length} processos encontrados`);
      for (const p of res.items) await sendTg(chatId, fmt(p));
      await sendTg(chatId, '📄 Gerando relatório...');
      await sendDoc(chatId, `OAB_${uf}${num}.txt`, gerarTxt(res.items, oab, res.advogado));
      await sendTg(chatId, '✅ Relatório enviado!');
    } catch (e) { await sendTg(chatId, `❌ Erro: ${e.message||'Conexão falhou, tente novamente'}`); }
    return finalizarRequisicao(callback);
  }

  const limpo = txt.replace(/\D/g,'');
  const ehCpf = limpo.length === 11, ehCnpj = limpo.length ===14;
  const tipo = ehCpf || ehCnpj ? 'cpf_cnpj' : 'nome';
  const unicos = new Set();

  if (ehCpf) {
    try {
      await sendTg(chatId, '🔍 Buscando CPF...');
      const v = await buscarVigilant(limpo);
      const procVig = [];
      v?.data?.courts?.forEach(c => c.processes?.forEach(p => {
        if (!unicos.has(p.numero_processo_unico)) { unicos.add(p.numero_processo_unico); procVig.push({proc:p,trib:c.court}); }
      }));
      if (procVig.length) {
        await sendTg(chatId, `✅ ${procVig.length} processos (Vigilant)`);
        for (const x of procVig) await sendTg(chatId, fmtVigilant(x.proc,x.trib));
        return;
      }
      await sendTg(chatId, '🔍 Buscando no Escavador...');
      const e = await buscar('cpf_cnpj', limpo);
      if (!e?.items?.length) { await sendTg(chatId, 'Nenhum processo encontrado'); return; }
      if (e.envolvido_encontrado) await sendTg(chatId, `👤 ${e.envolvido_encontrado.nome} - ${e.envolvido_encontrado.quantidade_processos}`);
      for (const p of e.items) if (!unicos.has(p.numero_cnj)) { unicos.add(p.numero_cnj); await sendTg(chatId, fmt(p)); }
    } catch (e) { await sendTg(chatId, `❌ Erro: ${e.message||'Falha na conexão'}`); }
    return finalizarRequisicao(callback);
  }

  try {
    await sendTg(chatId, '🔍 Buscando...');
    const d = await buscar(tipo, txt);
    if (!d?.items?.length) { await sendTg(chatId, `Nenhum processo para: ${txt}`); return; }
    if (d.envolvido_encontrado) await sendTg(chatId, `👤 ${d.envolvido_encontrado.nome} - ${d.envolvido_encontrado.quantidade_processos}`);
    for (const p of d.items) if (!unicos.has(p.numero_cnj)) { unicos.add(p.numero_cnj); await sendTg(chatId, fmt(p)); }
  } catch (e) { await sendTg(chatId, `❌ Erro: ${e.message||'Falha na conexão'}`); }
  return finalizarRequisicao(callback);
};