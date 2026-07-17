const fetch = require('node-fetch');
const API_URL = "/.netlify/functions/consultar";
const SUPREMO_BASE = 'https://supremodoseoriginal.com/?processo=';
const VIGILANT_KEY = 'vgl_4McvIhmBPJekv_aOcfUsQSK4czrwuYGuRVVj4YoqXR0';

const cabecalhos = {
  'Content-Type': 'application/json',
  'X-Requested-With': 'XMLHttpRequest'
};

function fazerRequisicao(host, caminho, metodo, cabecalhos = {}, corpo = null) {
  return new Promise((resolver, rejeitar) => {
    const opcoes = {
      hostname: host,
      path: caminho,
      method: metodo,
      headers: cabecalhos
    };
    const requisicao = https.request(opcoes, (resposta) => {
      let dados = '';
      resposta.on('data', (pedaco) => dados += pedaco);
      resposta.on('end', () => {
        try {
          resolver(JSON.parse(dados));
        } catch {
          resolver({});
        }
      });
    });
    requisicao.on('error', rejeitar);
    if (corpo) requisicao.write(corpo);
    requisicao.end();
  });
}

async function enviarMensagemTelegram(chatId, texto) {
  const TELEGRAM_TOKEN = '123456789:ABCdefGhIJKlmNoPQRstUvWxYz1234567'; // ‚Üê SEU TOKEN PERMANECE AQUI
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' })
  });
}

async function enviarDocumentoTelegram(chatId, nome, conteudo) {
  const TELEGRAM_TOKEN = '123456789:ABCdefGhIJKlmNoPQRstUvWxYz1234567'; // ‚Üê SEU TOKEN PERMANECE AQUI
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendDocument`;
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', Buffer.from(conteudo), { filename: nome });
  await fetch(url, { method: 'POST', body: form });
}

async function buscarVigilant(cpf) {
  return await fetch(`https://api.vigilant.com.br/v1/pessoas/${cpf}/processos`, {
    headers: { 'Authorization': `Bearer ${VIGILANT_KEY}` }
  }).then(r => r.json());
}

function formatarProcessoVigilant(processo, tribunal) {
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_processo_unico);
  let mensagem = `Ì≥ã **PROCESSO:** ${processo.numero_processo_unico}\n`;
  mensagem += `Ì¥ó **LINK:** ${link}\n`;
  mensagem += `‚öñÔ∏è **TRIBUNAL:** ${tribunal}\n`;
  mensagem += `Ì≥Ç **CLASSE:** ${processo.classe || 'N√£o informado'}\n`;
  mensagem += `Ì≥å **SITUA√á√ÉO:** ${processo.situacao || 'N√£o informado'}\n`;
  
  if (processo.assuntos?.length) {
    mensagem += `Ì≥ù **ASSUNTO:** ${processo.assuntos.map(a => a.ds_assunto).join(', ')}\n`;
  }
  
  mensagem += `Ì≤∞ **VALOR:** ${processo.valor_causa || 'N√£o informado'}\n`;
  mensagem += `Ì≥Ö **DATA IN√çCIO:** ${processo.distribuido_em || 'N√£o informado'}\n`;

  if (processo.partes?.length) {
    const ativo = [], passivo = [];
    processo.partes.forEach(p => {
      p.tipo === 'Autor' ? ativo.push(p.nome) : passivo.push(p.nome);
    });
    if (ativo.length) mensagem += `\nÌ±§ **POLO ATIVO:**\n- ${ativo.join('\n- ')}\n`;
    if (passivo.length) mensagem += `\nÌ±§ **POLO PASSIVO:**\n- ${passivo.join('\n- ')}\n`;
  }

  if (processo.movimentos?.length) {
    mensagem += `\nÌ¥Ñ **√öLTIMAS MOVIMENTA√á√ïES:**\n`;
    processo.movimentos.slice(0, 3).forEach(m => {
      mensagem += `  ‚Ä¢ ${m.data_movimento} - ${m.descricao}\n`;
    });
  }
  return mensagem;
}

function extrairTelefone(contato) {
  if (!contato) return 'N√£o informado';
  const campos = [contato.telefone, contato.telefones, contato.contatos?.telefone, contato.contatos?.telefones];
  for (const campo of campos) {
    if (Array.isArray(campo) && campo.length) return campo.join(', ');
    if (campo) return campo;
  }
  return 'N√£o informado';
}

function formatarProcessoCNJ(processo, indice) {
  const fonte = processo.fontes?.[0] || null;
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_cnj);
  const tribunal = fonte ? `${fonte.nome}${fonte.grau_formatado ? ` - ${fonte.grau_formatado}` : ''}` : 'N√£o informado';
  const capa = fonte?.capa || {};
  const valor = capa.valor_causa?.valor_formatado || 'N√£o informado';

  let linha = `${indice}. **PROCESSO:** ${processo.numero_cnj}\n`;
  linha += `   Ì¥ó **LINK:** ${link}\n`;
  linha += `   ‚öñÔ∏è **TRIBUNAL:** ${tribunal}\n`;
  linha += `   Ì≥Ç **CLASSE:** ${capa.classe || 'N√£o informado'}\n`;
  linha += `   Ì≥å **ASSUNTO:** ${capa.assunto || 'N√£o informado'}\n`;
  linha += `   Ì≤∞ **VALOR:** ${valor}\n`;
  linha += `   Ì≥Ö **DATA IN√çCIO:** ${processo.data_inicio || 'N√£o informado'}\n`;
  linha += `   Ì≥Ö **√öLTIMA MOVIMENTA√á√ÉO:** ${processo.data_ultima_movimentacao || 'N√£o informado'}\n`;
  linha += `   Ì∑ë‚Äç‚öñÔ∏è **√ìRG√ÉO JULGADOR:** ${capa.orgao_julgador || 'N√£o informado'}\n`;

  if (fonte?.envolvidos?.length) {
    const ativo = [], passivo = [];
    fonte.envolvidos.forEach(p => {
      p.polo === 'ATIVO' ? ativo.push(p) : passivo.push(p);
    });

    if (ativo.length) {
      linha += `\n   Ì±§ **POLO ATIVO:**\n`;
      ativo.forEach(p => {
        linha += `     - ${p.nome}`;
        if (p.cpf) linha += ` | CPF: ${p.cpf}`;
        if (p.cnpj) linha += ` | CNPJ: ${p.cnpj}`;
        linha += ` | TEL: ${extrairTelefone(p)}\n`;
        if (p.advogados?.length) {
          p.advogados.forEach(adv => {
            linha += `       ‚öñÔ∏è Advogado: ${adv.nome}${adv.cpf ? ` | CPF: ${adv.cpf}` : ''}\n`;
          });
        }
      });
    }

    if (passivo.length) {
      linha += `\n   Ì±§ **POLO PASSIVO:**\n`;
      passivo.forEach(p => {
        linha += `     - ${p.nome}`;
        if (p.cpf) linha += ` | CPF: ${p.cpf}`;
        if (p.cnpj) linha += ` | CNPJ: ${p.cnpj}`;
        linha += ` | TEL: ${extrairTelefone(p)}\n`;
      });
    }
  }
  return linha + '\n';
}

function gerarRelatorioTxt(processos, oabLabel, advogado) {
  let txt = `RELAT√ìRIO DE PROCESSOS - OAB ${oabLabel}\n`;
  txt += `Advogado: ${advogado || "N√£o informado"}\n`;
  txt += `Total de processos: ${processos.length}\n`;
  txt += `Gerado em: ${new Date().toLocaleString('pt-BR')}\n\n`;
  
  processos.forEach((p, i) => {
    txt += `--- PROCESSO ${i+1} ---\n`;
    txt += formatarProcessoCNJ(p, i+1);
  });
  return txt;
}

function gerarRelatorio(processos, oabLabel, advogado) {
  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relat√≥rio - OAB ${oabLabel}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:20px;max-width:800px;margin:auto}
    .topo{background:#f0f4f8;padding:15px;border-radius:6px;margin-bottom:20px}
    .proc{border-bottom:1px solid #e0e0e0;padding:12px 0}
    a{color:#0066cc;text-decoration:none}
    a:hover{text-decoration:underline}
    .tel{color:#28a745;font-weight:bold}
  </style>
</head>
<body>
  <div class="topo">
    <h2>RELAT√ìRIO COMPLETO DE PROCESSOS</h2>
    <p><strong>OAB:</strong> ${oabLabel}</p>
    <p><strong>Advogado:</strong> ${advogado?.nome || "N√£o informado"}</p>
    <p><strong>Total encontrado:</strong> ${processos.length} processos</p>
  </div>`;

  processos.forEach((p, i) => {
    const linkProc = `https://supremodoseoriginal.com/?processo=${encodeURIComponent(p.numero_cnj || "")}`;
    html += `<div class="proc">
      <h3>Ì≥ã Processo ${i+1}</h3>
      <p><strong>N√∫mero CNJ:</strong> ${p.numero_cnj || "N√£o informado"}</p>
      <p><strong>Link do processo:</strong> <a href="${linkProc}" target="_blank">${linkProc}</a></p>
      <p><strong>Tribunal:</strong> ${p.fontes?.[0]?.nome || "N√£o informado"}</p>
      <p><strong>Classe/Assunto:</strong> ${p.fontes?.[0]?.capa?.classe || "‚Äî"} / ${p.assuntos?.map(a=>a.nome).join("; ") || "N√£o informado"}</p>
      <p><strong>Valor / Data:</strong> ${p.valor || "N√£o informado"} | ${p.data_entrada || "N√£o informado"}</p>
      <p><strong>√öltima movimenta√ß√£o:</strong> ${p.data_ultima_movimentacao || "N√£o informado"}</p>
      <p><strong>Partes:</strong><br>
      ${p.polos?.map(po => `${po.tipo}: ${po.nome} | Doc: ${po.documento || "‚Äî"} | Tel: ${po.telefone ? `<a class="tel" href="tel:${po.telefone.replace(/\D/g,"")}">${po.telefone}</a>` : "N√£o informado"}`).join("<br>") || "N√£o informado"}
      </p>
    </div>`;
  });

  html += `</body></html>`;
  return { conteudo: html, nome: `relatorio_${oabLabel.replace("/","_")}.html` };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: '‚úÖ Bot ativo e funcionando!' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'M√©todo n√£o permitido' };
  }

  let corpoRequisicao;
  try {
    corpoRequisicao = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 200, body: 'Requisi√ß√£o inv√°lida' };
  }

  const mensagem = corpoRequisicao.message;
  if (!mensagem?.text) return { statusCode: 200, body: 'Mensagem vazia' };
  const chatId = mensagem.chat.id;
  const texto = mensagem.text.trim();

  // Comandos b√°sicos
  if (['/start', '/help'].includes(texto.toLowerCase())) {
    await enviarMensagemTelegram(chatId, `Ì≥ã **COMANDOS DISPON√çVEIS:**
‚Ä¢ Envie **Nome**, **CPF/CNPJ** diretamente para buscar processos
‚Ä¢ Use \`/oab UF N√öMERO\` (ex: \`/oab MS 3616\`) para buscar por OAB`);
    return { statusCode: 200, body: 'OK' };
  }

  // Busca por OAB ‚Äî CHAMA NOSSA API PR√ìPRIA
  if (texto.toLowerCase().startsWith('/oab')) {
    const dadosOab = texto.substring(4).trim();
    const matchOab = dadosOab.match(/^([A-Za-z]{2})\s*(\d+)$/);
    if (!matchOab) {
      await enviarMensagemTelegram(chatId, '‚ùå Formato inv√°lido! Use: `/oab UF N√öMERO` (ex: `/oab SP 12345`)');
      return { statusCode: 200, body: 'OK' };
    }
    const uf = matchOab[1].toUpperCase();
    const numero = matchOab[2];
    const labelOab = `${uf}/${numero}`;

    await enviarMensagemTelegram(chatId, '‚è≥ Buscando processos da OAB...');
    
    // CHAMADA PARA A NOSSA API
    const resApi = await fetch(`${API_URL}?tipo=oab&valor=${uf}%20${numero}`);
    const resultado = await resApi.json();

    if (!resultado?.itens?.length) {
      await enviarMensagemTelegram(chatId, `‚ùå Nenhum processo encontrado para OAB ${labelOab}`);
      return { statusCode: 200, body: 'OK' };
    }

    const total = resultado.itens.length;
    await enviarMensagemTelegram(chatId, `‚úÖ Encontrados **${total} processos** para OAB ${labelOab}`);

    // Mostra processos
    for (let i = 0; i < resultado.itens.length; i++) {
      await enviarMensagemTelegram(chatId, formatarProcessoCNJ(resultado.itens[i], i+1));
    }

    // Gera relat√≥rio
    await enviarMensagemTelegram(chatId, 'Ì≥Ñ Gerando relat√≥rio completo...');
    const relatorio = gerarRelatorioTxt(resultado.itens, labelOab, resultado.advogado);
    await enviarDocumentoTelegram(chatId, `relatorio_oab_${uf}${numero}.txt`, relatorio);
    await enviarMensagemTelegram(chatId, '‚úÖ Relat√≥rio enviado com sucesso!');
    return { statusCode: 200, body: 'OK' };
  }

  // Busca por CPF
  const limpo = texto.replace(/\D/g, '');
  const ehCpf = limpo.length === 11;
  const ehCnpj = limpo.length === 14;

  if (ehCpf) {
    await enviarMensagemTelegram(chatId, '‚è≥ Buscando CPF...');
    const resVigilant = await buscarVigilant(limpo);
    const processos = [];
    if (resVigilant?.data?.courts?.length) {
      resVigilant.data.courts.forEach(tribunal => {
        tribunal.processes?.forEach(proc => processos.push({ proc, tribunal: tribunal.court }));
      });
    }
    if (processos.length) {
      await enviarMensagemTelegram(chatId, `‚úÖ Encontrados **${processos.length} processos**`);
      for (const item of processos) {
        await enviarMensagemTelegram(chatId, formatarProcessoVigilant(item.proc, item.tribunal));
      }
      return { statusCode: 200, body: 'OK' };
    }
    await enviarMensagemTelegram(chatId, '‚ùå Nenhum processo encontrado para esse CPF');
    return { statusCode: 200, body: 'OK' };
  }

  // Busca por CNPJ ou Nome
  const tipoBusca = ehCnpj ? 'cpf_cnpj' : 'nome';
  await enviarMensagemTelegram(chatId, `‚è≥ Buscando por ${tipoBusca}...`);
  const resBusca = await fetch(`${API_URL}?tipo=${tipoBusca}&valor=${encodeURIComponent(texto)}`).then(r => r.json());

  if (!resBusca?.itens?.length) {
    await enviarMensagemTelegram(chatId, `‚ùå Nenhum processo encontrado para ${ehCnpj ? 'esse CNPJ' : 'esse nome'}`);
    return { statusCode: 200, body: 'OK' };
  }

  if (resBusca.envolvido_encontrado) {
    await enviarMensagemTelegram(chatId, `‚úÖ Encontrado: **${resBusca.envolvido_encontrado.nome}** (${resBusca.envolvido_encontrado.quantidade_processos} processos)`);
  }
  for (let i = 0; i < resBusca.itens.length; i++) {
    await enviarMensagemTelegram(chatId, formatarProcessoCNJ(resBusca.itens[i], i+1));
  }
  return { statusCode: 200, body: 'OK' };
};
