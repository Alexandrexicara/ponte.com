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
  // Padrão CNJ completo
  const regex1 = /\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/g;
  // Padrão alternativo (sem pontos)
  const regex2 = /\d{7}\d{2}\d{4}\d{1}\d{2}\d{4}/g;
  
  let match;
  while ((match = regex1.exec(html)) !== null) {
    if (!cnjs.includes(match[0])) {
      cnjs.push(match[0]);
    }
  }
  while ((match = regex2.exec(html)) !== null) {
    const cnjFormatado = match[0].replace(/(\d{7})(\d{2})(\d{4})(\d{1})(\d{2})(\d{4})/, '$1-$2.$3.$4.$5.$6');
    if (!cnjs.includes(cnjFormatado)) {
      cnjs.push(cnjFormatado);
    }
  }
  return cnjs;
}

exports.handler = async (event) => {
  const { tipo, valor } = event.queryStringParameters;
  let processos = [];

  try {
    console.log('Requisição recebida:', tipo, valor);

    if (tipo === 'oab') {
      const [uf, numero] = valor.trim().split(/\s+/);
      console.log('OAB:', uf, numero);

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      };

      // Busca no CNJ - removido temporariamente (URL incorreta)
      // try {
      //   const urlCnj = `/csg/consultaProcessual?tipoConsulta=1&numeroOab=${numero}&ufOab=${uf}`;
      //   console.log('Buscando CNJ...');
      //   const res = await doReq('www.cnj.jus.br', urlCnj, headers);
      //   console.log('Status CNJ:', res.status, 'Tamanho HTML:', res.data.length);
      //   if (res.status === 200) {
      //     const cnjs = extrairCNJs(res.data);
      //     console.log('CNJs encontrados CNJ:', cnjs.length);
      //     if (cnjs.length > 0) console.log('Primeiro CNJ:', cnjs[0]);
      //     cnjs.forEach(cnj => {
      //       processos.push({
      //         numero_cnj: cnj,
      //         fontes: [{ nome: 'CNJ Oficial', capa: { classe: '', assunto: '' } }]
      //       });
      //     });
      //   }
      // } catch (e) { console.log('Erro CNJ:', e.message); }

      // Busca no CNA OAB
      try {
        const urlCna = `/Consulta/Advogado?uf=${uf}&numero=${numero}`;
        console.log('Buscando CNA OAB...');
        const res = await doReq('cna.oab.org.br', urlCna, headers);
        console.log('Status CNA:', res.status, 'Tamanho HTML:', res.data.length);
        if (res.status === 200) {
          console.log('Primeiros 500 chars HTML:', res.data.substring(0, 500));
          const cnjs = extrairCNJs(res.data);
          console.log('CNJs encontrados CNA:', cnjs.length);
          if (cnjs.length > 0) console.log('Primeiro CNJ:', cnjs[0]);
          cnjs.forEach(cnj => {
            processos.push({
              numero_cnj: cnj,
              fontes: [{ nome: 'OAB Nacional', capa: { classe: '', assunto: '' } }]
            });
          });
        }
      } catch (e) { console.log('Erro CNA:', e.message); }

      // Remove duplicatas
      processos = processos.filter((p, i, a) => a.findIndex(x => x.numero_cnj === p.numero_cnj) === i);
      console.log('Total processos:', processos.length);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: processos.length, itens: processos, origem: 'Fontes Públicas Nacionais' })
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
