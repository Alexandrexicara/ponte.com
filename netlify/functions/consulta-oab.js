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
    console.log(`í´ ${nome} â€” iniciando`);
    await avisarTelegram(chatId, `í´ Buscando no ${nome}...`);
    const res = await Promise.race([
      fn(...args),
      new Promise((_, r) => setTimeout(r, CONFIG.TIMEOUT[nome], []))
    ]);
    console.log(`âœ… ${nome} â€” ${res?.length||0} encontrados`);
    await avisarTelegram(chatId, `âœ… ${nome}: ${res?.length||0} processos`);
    return res || [];
  } catch (e) {
    console.log(`âš ï¸ ${nome} â€” falhou: ${e.message}`);
    await avisarTelegram(chatId, `âš ï¸ ${nome}: indisponÃ­vel no momento`);
    return [];
  }
};

const processarRapido = async (id, oab, uf, numero, chatId) => {
  try {
    const unicos = new Map();
    const add = p => p?.numero && !unicos.has(p.numero) && unicos.set(p.numero, p);

    // âœ… ORDEM EXATA: PRIMEIRO DATAJUD (TODO BRASIL) â†’ DEPOIS DEMAIS
    const fontes = [
      {fn: datajud, nome: "í³Š DataJud (Brasil inteiro)", args: [{uf:'', numeroOAB:numero}]},
      {fn: tjsp, nome: "âš–ï¸ TJSP", args: [oab]},
      {fn: tjms, nome: "âš–ï¸ TJMS", args: [oab]},
      {fn: tjmg, nome: "âš–ï¸ TJMG", args: [oab]}
    ];

    for (const fonte of fontes) {
      if (unicos.size >= CONFIG.MAX_TOTAL) break;
      const dados = await buscarUmaVez(fonte.fn, fonte.nome, fonte.args, chatId);
      dados.slice(0, CONFIG.LIMITE_POR_FONTE).forEach(add);
      await banco.atualizarConsulta(id, { total: unicos.size });
      await new Promise(r => setTimeout(r, 1200));
    }

    const lista = Array.from(unicos.values());
    const txt = `OAB: ${oab}\nNÃºmero: ${numero}\nTotal encontrado: ${lista.length}\n\n` + lista.map((p,i) =>
      `${i+1}. CNJ: ${p.numero}\nTRIBUNAL: ${p.tribunal||'NÃ£o informado'}\nCLASSE: ${p.classe||'â€”'}\n`
    ).join('\n');

    await banco.atualizarConsulta(id, { status: "CONCLUÃDA", processos: lista, txt });
    await avisarTelegram(chatId, `í¿ **FINALIZADO!**\nTotal geral: ${lista.length} processos encontrados`);
    await enviarArquivoFinal(chatId, `consulta-${oab}.txt`, txt);

  } catch (erro) {
    await banco.atualizarConsulta(id, { status: "ERRO", erros: [`Geral: ${erro.message}`] });
    await avisarTelegram(chatId, `âŒ Erro: ${erro.message}`);
  }
};

exports.handler = async ev => {
  const qs = ev.queryStringParameters || {};
  const valor = qs.valor || qs.oab || '';
  const chatId = qs.chat_id || '';
  const oabLimpa = limparOAB(valor);
  const {uf, numero} = separarOAB(valor);

  if (!numero || numero.length < 3) {
    return {statusCode:400, body:JSON.stringify({erro:"OAB invÃ¡lida"})};
  }

  await banco.pg.query(
    "DELETE FROM consultas WHERE oab=$1 AND status='PROCESSANDO' AND criado_em < NOW() - INTERVAL '2 MINUTES'",
    [oabLimpa]
  );

  const res = await banco.criarConsulta(oabLimpa, CONFIG.MAX_TOTAL);
  if (res.duplicada) {
    return {statusCode:200, body:JSON.stringify({
      aviso:"JÃ¡ estou buscando, jÃ¡ jÃ¡ te mostro tudo!",
      id: res.id,
      status:"PROCESSANDO"
    })};
  }

  await avisarTelegram(chatId, `í´ **INICIANDO CONSULTA PARA OAB ${oabLimpa}**\nPrimeiro DataJud, depois tribunais...`);
  processarRapido(res.id, oabLimpa, uf, numero, chatId).catch(e=>console.log(`Erro ${res.id}: ${e.message}`));

  return {statusCode:202, body:JSON.stringify({id:res.id, status:"PROCESSANDO"})};
};
