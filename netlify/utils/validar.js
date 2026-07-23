exports.validarOAB = (oab) => /^[A-Z]{2}\d{4,}$/i.test(oab.replace(/\s/g, ''));
exports.limparOAB = (oab) => oab.replace(/[^A-Z0-9]/gi, '').toUpperCase();
exports.separarOAB = (oab) => {
  const limpo = limparOAB(oab);
  return {
    uf: limpo.substring(0, 2),
    numero: limpo.substring(2)
  };
};
