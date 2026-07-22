const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');

exports.handler = async (event) => {
  const { tipo, valor } = event.queryStringParameters;
  let processos = [];

  try {
    if (tipo === 'oab') {
      const [uf, numero] = valor.trim().split(/\s+/);
      console.log(`Buscando OAB ${uf} ${numero} em fontes públicas...`);

      // Headers para simular navegador real
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      };

      // 1. BUSCA NO CNA OAB (NACIONAL)
      try {
        const urlCna = `https://cna.oab.org.br/Consulta/Advogado?uf=${uf}&numero=${numero}`;
        console.log('Tentando CNA OAB:', urlCna);
        const res = await fetch(urlCna, { headers });
        console.log('Status CNA:', res.status);
        if (res.ok) {
          const html = await res.text();
          console.log('HTML CNA length:', html.length);
          const dom = new JSDOM(html);
          const linhas = dom.window.document.querySelectorAll('table tr, .resultado, .item');
          console.log('Elementos encontrados CNA:', linhas.length);
          linhas.forEach(l => {
            const texto = l.textContent;
            if (texto.includes(numero) || texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/)) {
              processos.push({
                numero_cnj: texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/)?.[0] || texto.substring(0, 50),
                fontes: [{ nome: 'OAB Nacional', capa: { classe: '', assunto: '' } }]
              });
            }
          });
        }
      } catch (e) { console.log('Erro OAB:', e.message); }

      // 2. BUSCA NA JUSBRASIL
      try {
        const urlJus = `https://www.jusbrasil.com.br/busca?q=OAB+${uf}+${numero}&tipo=processos`;
        console.log('Tentando Jusbrasil:', urlJus);
        const res = await fetch(urlJus, { headers });
        console.log('Status Jusbrasil:', res.status);
        if (res.ok) {
          const html = await res.text();
          console.log('HTML Jusbrasil length:', html.length);
          const dom = new JSDOM(html);
          const cards = dom.window.document.querySelectorAll('[data-testid], .card, .result');
          console.log('Elementos encontrados Jusbrasil:', cards.length);
          cards.forEach(c => {
            const texto = c.textContent;
            if (texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/)) {
              processos.push({
                numero_cnj: texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/)?.[0] || texto.substring(0, 50),
                fontes: [{ nome: 'Jusbrasil', capa: { classe: '', assunto: '' } }]
              });
            }
          });
        }
      } catch (e) { console.log('Erro Jusbrasil:', e.message); }

      // 3. BUSCA NO CNJ
      try {
        const urlCnj = `https://www.cnj.jus.br/consulta-processual/?q=OAB+${uf}+${numero}`;
        console.log('Tentando CNJ:', urlCnj);
        const res = await fetch(urlCnj, { headers });
        console.log('Status CNJ:', res.status);
        if (res.ok) {
          const html = await res.text();
          console.log('HTML CNJ length:', html.length);
          const dom = new JSDOM(html);
          const proc = dom.window.document.querySelectorAll('table tr, .resultado, .processo');
          console.log('Elementos encontrados CNJ:', proc.length);
          proc.forEach(p => {
            const texto = p.textContent;
            if (texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/)) {
              processos.push({
                numero_cnj: texto.match(/\d{7}-\d{2}\.\d{4}\.\d{1}\.\d{2}\.\d{4}/)?.[0] || texto.substring(0, 50),
                fontes: [{ nome: 'CNJ Oficial', capa: { classe: '', assunto: '' } }]
              });
            }
          });
        }
      } catch (e) { console.log('Erro CNJ:', e.message); }

      // REMOVE DUPLICATAS
      processos = processos.filter((p,i,a) => a.findIndex(x => x.numero_cnj === p.numero_cnj) === i);
      console.log('Total processos:', processos.length);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: processos.length, itens: processos, origem: 'Fontes Públicas Nacionais' })
    };
  } catch (erro) {
    console.log('Erro geral:', erro.message);
    return { statusCode: 200, body: JSON.stringify({ total: 0, itens: [], erro: erro.message }) };
  }
};
