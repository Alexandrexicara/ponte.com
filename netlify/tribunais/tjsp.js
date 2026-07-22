const fetch = require('node-fetch');
const { limparOAB } = require('../utils/validar');

module.exports = async (oab) => {
  try {
    const oabLimpo = limparOAB(oab);
    // Endereço público do ESAJ/TJSP (exemplo)
    const res = await fetch(`https://esaj.tjsp.jus.br/cpopg/search.do?consultaOab=${oabLimpo}&pagina=1`);
    if (!res.ok) return [];
    // Aqui você implementa a extração real dos dados
    return [];
  } catch (e) {
    console.log('TJSP indisponível:', e.message);
    return [];
  }
};
