const { buscarConsulta } = require('../utils/fila');

exports.handler = async (event) => {
  const { id } = event.queryStringParameters || {};
  if (!id) return { statusCode: 400, body: JSON.stringify({ erro: "Informe o ID" }) };

  const consulta = buscarConsulta(id);
  if (!consulta) return { statusCode: 404, body: JSON.stringify({ erro: "Consulta não encontrada" }) };

  return {
    statusCode: 200,
    headers: consulta.status === "CONCLUÍDA" ? { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="consulta_${consulta.oab}.txt"` } : { "Content-Type": "application/json" },
    body: consulta.status === "CONCLUÍDA" ? consulta.txt : JSON.stringify({
      id: consulta.id,
      status: consulta.status,
      etapa: consulta.etapa,
      total: consulta.total,
      limite: consulta.limite,
      erros: consulta.erros
    })
  };
};
