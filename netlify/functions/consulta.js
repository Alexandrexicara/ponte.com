exports.handler = async (event) => {
  const { oab, cnj, nome, estado } = event.queryStringParameters || {};
  if (oab) return require('./functions/consulta-oab').handler(event);
  return { statusCode: 400, body: JSON.stringify({ erro: 'Informe o parâmetro ?oab=, ?cnj= ou ?nome=' }) };
};
