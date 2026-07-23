const consultas = new Map();

const JA_PROCESSANDO = (oab) => {
  for (const [_, cons] of consultas) {
    if (cons.oab === oab && cons.status === "PROCESSANDO") return cons;
  }
  return null;
};

const criarConsulta = (oab, limite = 200) => {
  // TRAVA: se já estiver rodando, retorna o existente
  const existente = JA_PROCESSANDO(oab);
  if (existente) return { duplicada: true, id: existente.id };

  const id = `${oab.replace(/\W/g, "")}-${Date.now()}`;
  consultas.set(id, {
    id, oab, limite,
    status: "PROCESSANDO",
    etapa: "INICIANDO",
    total: 0,
    processos: [],
    erros: [],
    criadoEm: new Date().toISOString()
  });
  return { duplicada: false, id };
};

const atualizarConsulta = (id, dados) => {
  if (!consultas.has(id)) return;
  consultas.set(id, { ...consultas.get(id), ...dados });
};

const buscarConsulta = (id) => consultas.get(id);

module.exports = { criarConsulta, atualizarConsulta, buscarConsulta };
