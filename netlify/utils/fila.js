// Gerenciador de tarefas em memória (depois migramos para SQLite/KV)
const consultas = new Map();

const criarConsulta = (oab, limite = 200) => {
  const id = `${oab.replace(/\W/g, "")}-${Date.now()}`;
  consultas.set(id, {
    id,
    oab,
    limite,
    status: "PROCESSANDO",
    etapa: "INICIANDO",
    total: 0,
    processos: [],
    erros: [],
    criadoEm: new Date().toISOString()
  });
  return id;
};

const atualizarConsulta = (id, dados) => {
  if (!consultas.has(id)) return;
  consultas.set(id, { ...consultas.get(id), ...dados });
};

const buscarConsulta = (id) => consultas.get(id);

module.exports = { criarConsulta, atualizarConsulta, buscarConsulta };
