const initSqlJs = require('sql.js');
let db;

const iniciarBanco = async () => {
  if (db) return db;
  const SQL = await initSqlJs();
  db = new SQL.Database();
  
  db.run(`
    CREATE TABLE IF NOT EXISTS consultas (
      id TEXT PRIMARY KEY,
      oab TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PROCESSANDO',
      total INTEGER DEFAULT 0,
      limite INTEGER DEFAULT 200,
      erros TEXT,
      txt TEXT,
      criadoEm TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS processos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consultaId TEXT NOT NULL,
      numero TEXT NOT NULL UNIQUE,
      tribunal TEXT,
      classe TEXT,
      assunto TEXT,
      data TEXT,
      FOREIGN KEY (consultaId) REFERENCES consultas(id)
    );
  `);
  return db;
};

module.exports = {
  criarConsulta: async (oab, limite=200) => {
    const banco = await iniciarBanco();
    const existe = banco.exec("SELECT id FROM consultas WHERE oab = ? AND status = 'PROCESSANDO'", [oab]);
    if (existe[0]?.values.length) return { duplicada:true, id: existe[0].values[0][0] };
    
    const id = `${oab.replace(/\W/g,"")}-${Date.now()}`;
    banco.run("INSERT INTO consultas (id, oab, limite) VALUES (?, ?, ?)", [id, oab, limite]);
    return { duplicada:false, id };
  },
  atualizarConsulta: async (id, dados) => {
    const banco = await iniciarBanco();
    const campos = [];
    const valores = [];
    for (const [chave, val] of Object.entries(dados)) {
      if (chave === "processos") continue;
      campos.push(`${chave} = ?`);
      valores.push(typeof val === "object" ? JSON.stringify(val) : val);
    }
    valores.push(id);
    banco.run(`UPDATE consultas SET ${campos.join(", ")} WHERE id = ?`, valores);
    
    if (dados.processos?.length) {
      dados.processos.forEach(p => {
        banco.run(`INSERT OR IGNORE INTO processos 
          (consultaId, numero, tribunal, classe, assunto, data) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, p.numero, p.tribunal, p.classe, p.assunto, p.data]
        );
      });
    }
  },
  buscarConsulta: async (id) => {
    const banco = await iniciarBanco();
    const cons = banco.exec("SELECT * FROM consultas WHERE id = ?", [id]);
    if (!cons[0]?.values.length) return null;
    const res = cons[0].columns.reduce((o,ch,i) => ({...o, [ch]: cons[0].values[0][i]}), {});
    res.erros = res.erros ? JSON.parse(res.erros) : [];
    res.processos = banco.exec("SELECT * FROM processos WHERE consultaId = ?", [id])[0]?.values.map(v => 
      banco.exec("SELECT * FROM processos WHERE consultaId = ?", [id])[0].columns.reduce((o,c,i)=>({...o,[c]:v[i]}),{},{})
    ) || [];
    return res;
  }
};
