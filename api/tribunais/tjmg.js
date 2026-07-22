const fetch = require('node-fetch');
const { limparOAB } = require('../utils/validar');

module.exports = async (oab) => {
  try {
    const oabLimpo = limparOAB(oab);
    const res = await fetch(`https://esaj.tjmg.jus.br/cpopg/search.do?consultaOab=${oabLimpo}`);
    if (!res.ok) return [];
    return [];
  } catch (e) {
    console.log('TJMG indisponível:', e.message);
    return [];
  }
};
