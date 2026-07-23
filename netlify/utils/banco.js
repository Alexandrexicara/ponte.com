const { Pool } = require('pg');

// CONEXÃO LOCAL — DEPOIS TROQUE PARA NUVEM
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'botprocesso2',
  password: 'celio48',
  port: 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = {
  criarConsulta: async (oab, limite = 200) => {
    console.log(`[PG] Verificando duplicata para: ${oab}`);
    const existe = await pool.query(
      "SELECT id FROM consultas WHERE oab = $1 AND status = 'PROCESSANDO' LIMIT 1",
      [oab]
    );
    if (existe.rows.length) return { duplicada: true, id: existe.rows[0].id };

    const id = `${oab.replace(/\W/g, "")}-${Date.now()}`;
    console.log(`[PG] Criando consulta ID: ${id}`);
    await pool.query(
      "INSERT INTO consultas (id, oab, limite) VALUES ($1, $2, $3)",
      [id, oab, limite]
    );
    return { duplicada: false, id };
  },

  atualizarConsulta: async (id, dados) => {
    console.log(`[PG] Atualizando ${id}:`, Object.keys(dados));
    const campos = [];
    const valores = [];
    let idx = 1;
    for (const [chave, val] of Object.entries(dados)) {
      if (chave === "processos") continue;
      const coluna = chave.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
      campos.push(`${coluna} = $${idx++}`);
      valores.push(chave === "erros" ? JSON.stringify(val) : val);
    }
    valores.push(id);
    await pool.query(
      `UPDATE consultas SET ${campos.join(", ")} WHERE id = $${idx}`,
      valores
    );

    if (dados.processos?.length) {
      for (const p of dados.processos) {
        await pool.query(`
          INSERT INTO processos (consulta_id, numero, tribunal, classe, assunto, data)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (numero) DO NOTHING
        `, [id, p.numero, p.tribunal, p.classe, p.assunto, p.data]);
      }
    }
  },

  buscarConsulta: async (id) => {
    console.log(`[PG] Buscando consulta: ${id}`);
    const res = await pool.query("SELECT * FROM consultas WHERE id = $1", [id]);
    if (!res.rows.length) return null;
    const cons = res.rows[0];
    cons.erros = cons.erros || [];
    cons.processos = (await pool.query("SELECT * FROM processos WHERE consulta_id = $1", [id])).rows;
    return cons;
  }
};
