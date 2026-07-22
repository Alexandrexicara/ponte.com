const fetch = require('node-fetch');
const { limparOAB } = require('../utils/validar');

module.exports = async (oab) => {
  try {
    const oabLimpo = limparOAB(oab);
    const res = await fetch(`https://esaj.tjms.jus.br/cpopg5/search.do?consultaOab=${oabLimpo}`);
    if (!res.ok) return [];
    return [];
  } catch (e) {
    console.log('TJMS indisponível:', e.message);
    return [];
  }
};
