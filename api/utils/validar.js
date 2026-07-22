exports.validarOAB = (oab) => /^[A-Z]{2}\d{4,}$/i.test(oab.replace(/\s/g, ''));
exports.limparOAB = (oab) => oab.replace(/[^A-Z0-9]/gi, '').toUpperCase();
