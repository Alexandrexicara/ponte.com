const fs = require('fs');
const caminho = './dados.json';

// Cria arquivo se não existir
if (!fs.existsSync(caminho)) fs.writeFileSync(caminho, JSON.stringify({ consultas: [], processos: [] }, null, 2));

const ler = () => JSON.parse(fs.readFileSync(caminho, 'utf8'));
const salvar = (dados) => fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));

module.exports = {
  buscarConsulta: (id) => ler().consultas.find(c => c.id === id),
  
  criarConsulta: (oab, limite = 200) => {
    const dados = ler();
    const existe = dados.consultas.find(c => c.oab === oab && c.status === "PROCESSANDO");
    if (existe) return { duplicada: true, id: existe.id };
    
    const nova = {
      id: `${oab.replace(/\W/g, "")}-${Date.now()}`,
      oab, limite,
      status: "PROCESSANDO",
      etapa: "INICIANDO",
      total: 0,
      erros: [],
      txt: "",
      criadoEm: new Date().toISOString()
    };
    dados.consultas.push(nova);
    salvar(dados);
    return { duplicada: false, id: nova.id };
  },

  atualizarConsulta: (id, dadosNovos) => {
    const dados = ler();
    const idx = dados.consultas.findIndex(c => c.id === id);
    if (idx === -1) return;
    dados.consultas[idx] = { ...dados.consultas[idx], ...dadosNovos };
    salvar(dados);
  }
};
