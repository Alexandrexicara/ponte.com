const fetch = require('node-fetch');
const { JSDOM } = require('jsdom');
const TEMPO_POR_FONTE = 8000;

exports.handler = async (event) => {
  const { tipo, valor } = event.queryStringParameters;
  let processos = [];

  try {
    if (tipo === 'oab') {
      const [uf, numero] = valor.trim().split(/\s+/);
      console.log(`Buscando OAB ${uf} ${numero} em fontes públicas...`);

      // 1. BUSCA NO CNA OAB (NACIONAL)
      try {
        const urlCna = `https://cna.oab.org.br/Consulta/Advogado?uf=${uf}&numero=${numero}`;
        const res = await fetch(urlCna, { timeout: TEMPO_POR_FONTE });
        if (res.ok) {
          const dom = new JSDOM(await res.text());
          const linhas = dom.window.document.querySelectorAll('.resultado-item');
          linhas.forEach(l => {
            processos.push({
              numero_cnj: l.querySelector('.num-proc')?.textContent?.trim() || '',
              fontes: [{ nome: 'OAB Nacional', capa: { classe: '', assunto: '' } }]
            });
          });
        }
      } catch (e) { console.log('Erro OAB:', e.message); }

      // 2. BUSCA NA JUSBRASIL
      try {
        const urlJus = `https://www.jusbrasil.com.br/busca?q=OAB+${uf}+${numero}&tipo=processos`;
        const res = await fetch(urlJus, { timeout: TEMPO_POR_FONTE });
        if (res.ok) {
          const dom = new JSDOM(await res.text());
          const cards = dom.window.document.querySelectorAll('.search-result-item');
          cards.forEach(c => {
            processos.push({
              numero_cnj: c.querySelector('.process-number')?.textContent?.trim() || '',
              fontes: [{ nome: 'Jusbrasil', capa: { classe: '', assunto: '' } }]
            });
          });
        }
      } catch (e) { console.log('Erro Jusbrasil:', e.message); }

      // 3. BUSCA NO CNJ
      try {
        const urlCnj = `https://www.cnj.jus.br/consulta-processual/?q=OAB+${uf}+${numero}`;
        const res = await fetch(urlCnj, { timeout: TEMPO_POR_FONTE });
        if (res.ok) {
          const dom = new JSDOM(await res.text());
          const proc = dom.window.document.querySelectorAll('.resultado-processo');
          proc.forEach(p => {
            processos.push({
              numero_cnj: p.querySelector('.numero')?.textContent?.trim() || '',
              fontes: [{ nome: 'CNJ Oficial', capa: { classe: '', assunto: '' } }]
            });
          });
        }
      } catch (e) { console.log('Erro CNJ:', e.message); }

      // REMOVE DUPLICATAS
      processos = processos.filter((p,i,a) => a.findIndex(x => x.numero_cnj === p.numero_cnj) === i);
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
