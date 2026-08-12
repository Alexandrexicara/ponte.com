const { limparOAB, separarOAB } = require('../utils/validar');
const banco = require('../utils/banco');
const tjsp = require('../tribunais/tjsp');
const tjms = require('../tribunais/tjms');
const tjmg = require('../tribunais/tjmg');
const datajud = require('../tribunais/datajud');
const fetch = require('node-fetch');

const TELEGRAM_TOKEN = '8701852568:AAHZw2eiUzHzlAlVRU0_qGNk1UBmTXAjwVo';
const CONFIG = {
  MAX_TOTAL: 300,
  LIMITE_POR_FONTE: 75,
  TIMEOUT: { DataJud:30000, TJSP:20000, TJMS:20000, TJMG:15000 }
};

async function avisarTelegram(chatId, texto, tentativa=1) {
  if (!chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
      timeout: 10000
    });
  } catch (e) {
    if (tentativa < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return avisarTelegram(chatId, texto, tentativa+1);
    }
  }
}

async function enviarArquivoFinal(chatId, nome, conteudo, tentativa=1) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`, {
      method: 'POST',
      body: `----ARQ----
Content-Disposition: form-data; name="chat_id"

${chatId}
----ARQ----
Content-Disposition: form-data; name="document"; filename="${nome}"

${conteudo}
----ARQ----`,
      timeout: 15000
    });
  } catch {
    if (tentativa < 3) {
      await new Promise(r => setTimeout(r, 3000));
      return enviarArquivoFinal(chatId, nome, conteudo, tentativa+1);
    }
  }
}

const buscarUmaVez = async (fn, nome, args, chatId) => {
  try {
    console.log(`��� ${nome} — iniciando`);
    await avisarTelegram(chatId, `��� Buscando no ${nome}...`);
    const res = await Promise.race([
      fn(...args),
      new Promise((_, r) => setTimeout(r, CONFIG.TIMEOUT[nome], []))
    ]);
    console.log(`✅ ${nome} — ${res?.length||0} encontrados`);
    await avisarTelegram(chatId, `✅ ${nome}: ${res?.length||0} processos`);
    return res || [];
  } catch (e) {
    console.log(`⚠️ ${nome} — falhou: ${e.message||'indisponível'}`);
    await avisarTelegram(chatId, `⚠️ ${nome}: ${e.message||'indisponível'}`);
    return [];
  }
};

const processarRapido = async (id, oab, uf, numero, chatId) => {
  try {
    const unicos = new Map();
    const add = p => p?.numero && !unicos.has(p.numero) && unicos.set(p.numero, p);

    // ✅ ORDEM EXATA: DATAJUD PRIMEIRO → CHAMA APENAS COM A OAB (COMO ELES ESPERAM)
    // Normaliza resultado de qualquer fonte para o formato padrão { numero, tribunal, classe, assunto, data }
    const normalizar = (lista, nomeFonte) => lista.map(p => ({
      numero:   p.numero   || p.numero_cnj || p.numeroProcesso || '',
      tribunal: p.tribunal || nomeFonte,
      classe:   p.classe   || p.fontes?.[0]?.capa?.classe || '',
      assunto:  p.assunto  || p.fontes?.[0]?.capa?.assunto || '',
      data:     p.data     || ''
    }));

    const fontes = [
      {fn: datajud, nome: "DataJud (Brasil)", args: [oab]},
      {fn: tjsp,    nome: "TJSP",             args: [oab]},
      {fn: tjms,    nome: "TJMS",             args: [oab]},
      {fn: tjmg,    nome: "TJMG",             args: [oab]}
    ];

    for (const fonte of fontes) {
      if (unicos.size >= CONFIG.MAX_TOTAL) break;
      const raw = await buscarUmaVez(fonte.fn, fonte.nome, fonte.args, chatId);
      const dados = normalizar(raw, fonte.nome);
      dados.slice(0, CONFIG.LIMITE_POR_FONTE).forEach(add);
      await banco.atualizarConsulta(id, { total: unicos.size });
      await new Promise(r => setTimeout(r, 1200));
    }

    const lista = Array.from(unicos.values());
    const txt = `OAB: ${oab}\nNúmero: ${numero}\nTotal encontrado: ${lista.length}\n\n` + lista.map((p,i) =>
      `${i+1}. CNJ: ${p.numero||'—'}\nTRIBUNAL: ${p.tribunal||'—'}\nCLASSE: ${p.classe||'—'}\n`
    ).join('\n');

    await banco.atualizarConsulta(id, { status: "CONCLUÍDA", processos: lista, txt });
    await avisarTelegram(chatId, `��� **FINALIZADO!**\nTotal geral: ${lista.length} processos`);
    await enviarArquivoFinal(chatId, `consulta-${oab}.txt`, txt);

  } catch (erro) {
    await banco.atualizarConsulta(id, { status: "ERRO", erros: [`Geral: ${erro.message}`] });
    await avisarTelegram(chatId, `❌ Erro: ${erro.message}`);
  }
};

exports.handler = async ev => {
  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  const chatId = qs.chat_id || '';
  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);

  if (!numero || numero.length < 3) {
    return {statusCode:400, body:JSON.stringify({erro:"OAB inválida"})};
  }

  await banco.pg.query(
    "DELETE FROM consultas WHERE oab=$1 AND status='PROCESSANDO' AND criado_em < NOW() - INTERVAL '2 MINUTES'",
    [oabLimpa]
  );

  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_TOTAL);
  if (res.duplicada) {
    return {statusCode:200, body:JSON.stringify({
      aviso:"Já estou buscando, já já te mostro tudo!",
      id: res.id,
      status:"PROCESSANDO"
    })};
  }

  await avisarTelegram(chatId, `��� **INICIANDO CONSULTA PARA OAB ${oabLimpa}**\nOrdem: DataJud → TJSP → TJMS → TJMG`);
  processarRapido(res.id, oabLimpa, uf, numero, chatId).catch(e=>console.log(`Erro ${res.id}: ${e.message}`));

  return {statusCode:202, body:JSON.stringify({id:res.id, status:"PROCESSANDO"})};
};
