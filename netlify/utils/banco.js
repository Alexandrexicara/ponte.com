const fs = require('fs');
const caminho = '/tmp/dados.json';

// Garante que o arquivo exista
const inicializar = () => {
  if (!fs.existsSync(caminho)) {
    fs.writeFileSync(caminho, JSON.stringify({ consultas: [] }, null, 2));
  }
};

const ler = () => {
  inicializar();
  return JSON.parse(fs.readFileSync(caminho, 'utf8'));
};

const salvar = (dados) => {
  fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
};

module.exports = {
  criarConsulta: async (oab, limite = 200) => {
    const dados = ler();
    const existe = dados.consultas.find(c => c.oab === oab && c.status === "PROCESSANDO");
    if (existe) return { duplicada: true, id: existe.id };

    const nova = {
      id: `${oab.replace(/\W/g, "")}-${Date.now()}`,
      oab, limite,
      status: "PROCESSANDO",
      total: 0,
      erros: [],
      txt: "",
      criadoEm: new Date().toISOString()
    };
    dados.consultas.push(nova);
    salvar(dados);
    return { duplicada: false, id: nova.id };
  },

  atualizarConsulta: async (id, dadosNovos) => {
    const dados = ler();
    const idx = dados.consultas.findIndex(c => c.id === id);
    if (idx === -1) return;
    dados.consultas[idx] = { ...dados.consultas[idx], ...dadosNovos };
    salvar(dados);
  },

  buscarConsulta: async (id) => {
    const dados = ler();
    return dados.consultas.find(c => c.id === id) || null;
  }
};
