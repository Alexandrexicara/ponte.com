const fetch = require('node-fetch');

module.exports = async (parametros) => {
  try {
    // Endereço oficial do DataJud
    const res = await fetch('https://api.datajud.cnj.jus.br/api/v1/processos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parametros)
    });
    if (!res.ok) return [];
    const dados = await res.json();
    return dados.hits?.hits?.map(item => ({
      numero: item._source?.numeroProcesso || '',
      tribunal: item._source?.tribunal || '',
      classe: item._source?.classeProcessual || '',
      assunto: item._source?.assuntoProcessual || '',
      data: item._source?.dataAjuizamento || '',
      movimentacao: '',
      link: `https://datajud.cnj.jus.br/processo/${item._source?.numeroProcesso || ''}`
    })) || [];
  } catch (e) {
    console.log('DataJud indisponível:', e.message);
    return [];
  }
};
