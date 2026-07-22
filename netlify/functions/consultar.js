const https = require('https');

function doReq(host, path, headers) {
  return new Promise((ok, fail) => {
    const options = {
      hostname: host,
      path: path,
      method: 'GET',
      headers: headers || {}
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => ok({ status: res.statusCode, data }));
    });
    req.on('error', fail);
    req.setTimeout(10000, () => { req.destroy(); fail(new Error('Timeout')); });
    req.end();
  });
}

function extrairCNJs(html) {
  const cnjs = [];
  const regex = /\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (!cnjs.includes(match[0])) {
      cnjs.push(match[0]);
    }
  }
  return cnjs;
}

// API do ESAJ/TJSP - aceita requisições de bots
async function buscarESAJ(uf, numero) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; BotAPI/1.0)',
      'Accept': 'application/json'
    };
    
    // Endpoint do ESAJ para busca por OAB
    const url = `/cposg/open.do`;
    const params = `conversationId=&paginaConsulta=1&tipoNuProcesso=UNIFICADO&codigoOab=${numero}&nomeOab=&tipoConsulta=porOab&dadosConsulta.valorCampoOab=${numero}&dadosConsulta.valorCampoNomeOab=&uuidCaptcha=`;
    
    console.log('Buscando ESAJ/TJSP...');
    const res = await doReq('esaj.tjsp.jus.br', url + '?' + params, headers);
    console.log('Status ESAJ:', res.status);
    
    if (res.status === 200) {
      const cnjs = extrairCNJs(res.data);
      console.log('CNJs encontrados ESAJ:', cnjs.length);
      return cnjs.map(cnj => ({
        numero_cnj: cnj,
        fontes: [{ nome: 'ESAJ/TJSP', capa: { classe: '', assunto: '' } }]
      }));
    }
    return [];
  } catch (e) {
    console.log('Erro ESAJ:', e.message);
    return [];
  }
}

// API do CNJ - endpoint público
async function buscarCNJ(uf, numero) {
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (compatible; BotAPI/1.0)',
      'Accept': 'application/json'
    };
    
    const url = `/cnj/consultas/publicas/processo`;
    const params = `oab=${numero}&uf=${uf}`;
    
    console.log('Buscando CNJ...');
    const res = await doReq('api-publica.cnj.jus.br', url + '?' + params, headers);
    console.log('Status CNJ:', res.status);
    
    if (res.status === 200) {
      try {
        const json = JSON.parse(res.data);
        if (json && json.processos) {
          return json.processos.map(p => ({
            numero_cnj: p.numero_cnj || p.numero,
            fontes: [{ nome: 'CNJ API', capa: { classe: p.classe || '', assunto: p.assunto || '' } }]
          }));
        }
      } catch (e) {
        const cnjs = extrairCNJs(res.data);
        return cnjs.map(cnj => ({
          numero_cnj: cnj,
          fontes: [{ nome: 'CNJ API', capa: { classe: '', assunto: '' } }]
        }));
      }
    }
    return [];
  } catch (e) {
    console.log('Erro CNJ:', e.message);
    return [];
  }
}

exports.handler = async (event) => {
  const { tipo, valor } = event.queryStringParameters;
  let processos = [];

  try {
    console.log('Requisição recebida:', tipo, valor);

    if (tipo === 'oab') {
      const [uf, numero] = valor.trim().split(/\s+/);
      console.log('OAB:', uf, numero);

      // Busca no ESAJ/TJSP
      const esajResult = await buscarESAJ(uf, numero);
      processos = processos.concat(esajResult);

      // Busca no CNJ
      const cnjResult = await buscarCNJ(uf, numero);
      processos = processos.concat(cnjResult);

      // Remove duplicatas
      processos = processos.filter((p, i, a) => a.findIndex(x => x.numero_cnj === p.numero_cnj) === i);
      console.log('Total processos:', processos.length);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: processos.length, itens: processos, origem: 'APIs Públicas de Tribunais' })
    };
  } catch (erro) {
    console.log('Erro geral:', erro.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 0, itens: [], erro: erro.message })
    };
  }
};
