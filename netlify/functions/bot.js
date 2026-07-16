  const cabecalhos = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
/* } */

  let parametros_duplicada = new URLSearchParams({
    oab_estado: uf,
    oab_numero: numero,
    ordem: 'desc',
    por_pagina: '200'
  });
  let caminho_duplicado = `/api/v2/advogado/processos?${parametros}`;
  const cabecalhos = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  };
}

// ==============================
// FORMATAÇÃO DE DADOS
// ==============================
function formatarProcessoVigilant(processo, tribunal) {
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_processo_unico);
  let mensagem = `📋 **PROCESSO:** ${processo.numero_processo_unico}\n`;
  mensagem += `🔗 **LINK:** ${link}\n`;
  mensagem += `⚖️ **TRIBUNAL:** ${tribunal}\n`;
  mensagem += `📂 **CLASSE:** ${processo.classe || 'Não informado'}\n`;
  mensagem += `📌 **SITUAÇÃO:** ${processo.situacao || 'Não informado'}\n`;
  
  if (processo.assuntos?.length) {
    mensagem += `📝 **ASSUNTO:** ${processo.assuntos.map(a => a.ds_assunto).join(', ')}\n`;
  }
  
  mensagem += `💰 **VALOR:** ${processo.valor_causa || 'Não informado'}\n`;
  mensagem += `📅 **DATA INÍCIO:** ${processo.distribuido_em || 'Não informado'}\n`;

  if (processo.partes?.length) {
    const ativo = [], passivo = [];
    processo.partes.forEach(p => {
      p.tipo === 'Autor' ? ativo.push(p.nome) : passivo.push(p.nome);
    });
    if (ativo.length) mensagem += `\n👤 **POLO ATIVO:**\n- ${ativo.join('\n- ')}\n`;
    if (passivo.length) mensagem += `\n👤 **POLO PASSIVO:**\n- ${passivo.join('\n- ')}\n`;
  }

  if (processo.movimentos?.length) {
    mensagem += `\n🔄 **ÚLTIMAS MOVIMENTAÇÕES:**\n`;
    processo.movimentos.slice(0, 3).forEach(m => {
      mensagem += `  • ${m.data_movimento} - ${m.descricao}\n`;
    });
  }
  return mensagem;
}

function extrairTelefone(contato) {
  if (!contato) return 'Não informado';
  const campos = [contato.telefone, contato.telefones, contato.contatos?.telefone, contato.contatos?.telefones];
  for (const campo of campos) {
    if (Array.isArray(campo) && campo.length) return campo.join(', ');
    if (campo) return campo;
  }
  return 'Não informado';
}

  const fonte = processo.fontes?.[0] || null;
  const link = SUPREMO_BASE + encodeURIComponent(processo.numero_cnj);
  const tribunal = fonte ? `${fonte.nome}${fonte.grau_formatado ? ` - ${fonte.grau_formatado}` : ''}` : 'Não informado';
  const capa = fonte?.capa || {};
  const valor = capa.valor_causa?.valor_formatado || 'Não informado';

  let linha = `${indice}. **PROCESSO:** ${processo.numero_cnj}\n`;
  linha += `   🔗 **LINK:** ${link}\n`;
  linha += `   ⚖️ **TRIBUNAL:** ${tribunal}\n`;
  linha += `   📂 **CLASSE:** ${capa.classe || 'Não informado'}\n`;
  linha += `   📌 **ASSUNTO:** ${capa.assunto || 'Não informado'}\n`;
  linha += `   💰 **VALOR:** ${valor}\n`;
  linha += `   📅 **DATA INÍCIO:** ${processo.data_inicio || 'Não informado'}\n`;
  linha += `   📅 **ÚLTIMA MOVIMENTAÇÃO:** ${processo.data_ultima_movimentacao || 'Não informado'}\n`;
  linha += `   🧑‍⚖️ **ÓRGÃO JULGADOR:** ${capa.orgao_julgador || 'Não informado'}\n`;

  if (fonte?.envolvidos?.length) {
    const ativo = [], passivo = [];
    fonte.envolvidos.forEach(p => {
      p.polo === 'ATIVO' ? ativo.push(p) : passivo.push(p);
    });

    if (ativo.length) {
      linha += `\n   👤 **POLO ATIVO:**\n`;
      ativo.forEach(p => {
        linha += `     - ${p.nome}`;
        if (p.cpf) linha += ` | CPF: ${p.cpf}`;
        if (p.cnpj) linha += ` | CNPJ: ${p.cnpj}`;
        linha += ` | TEL: ${extrairTelefone(p)}\n`;
        if (p.advogados?.length) {
          p.advogados.forEach(adv => {
            linha += `       ⚖️ Advogado: ${adv.nome}${adv.cpf ? ` | CPF: ${adv.cpf}` : ''}\n`;
          });
        }
      });
    }

    if (passivo.length) {
      linha += `\n   👤 **POLO PASSIVO:**\n`;
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

function gerarRelatorio(processos, oabLabel, advogado) {
  let html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório - OAB ${oabLabel}</title>
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
    <h2>RELATÓRIO COMPLETO DE PROCESSOS</h2>
    <p><strong>OAB:</strong> ${oabLabel}</p>
    <p><strong>Advogado:</strong> ${advogado?.nome || "Não informado"}</p>
    <p><strong>Total encontrado:</strong> ${processos.length} processos</p>
  </div>`;

  processos.forEach((p, i) => {
    const linkProc = `https://supremodoseoriginal.com/?processo=${encodeURIComponent(p.numero_cnj || "")}`;
    html += `<div class="proc">
      <h3>��� Processo ${i+1}</h3>
      <p><strong>Número CNJ:</strong> ${p.numero_cnj || "Não informado"}</p>
      <p><strong>Link do processo:</strong> <a href="${linkProc}" target="_blank">${linkProc}</a></p>
      <p><strong>Tribunal:</strong> ${p.fontes?.[0]?.nome || "Não informado"}</p>
      <p><strong>Classe/Assunto:</strong> ${p.fontes?.[0]?.capa?.classe || "—"} / ${p.assuntos?.map(a=>a.nome).join("; ") || "Não informado"}</p>
      <p><strong>Valor / Data:</strong> ${p.valor || "Não informado"} | ${p.data_entrada || "Não informado"}</p>
      <p><strong>Última movimentação:</strong> ${p.data_ultima_movimentacao || "Não informado"}</p>
      <p><strong>Partes:</strong><br>
      ${p.polos?.map(po => `${po.tipo}: ${po.nome} | Doc: ${po.documento || "—"} | Tel: ${po.telefone ? `<a class="tel" href="tel:${po.telefone.replace(/\D/g,"")}">${po.telefone}</a>` : "Não informado"}`).join("<br>") || "Não informado"}
      </p>
    </div>`;
  });

  html += `</body></html>`;
  return { conteudo: html, nome: `relatorio_${oabLabel.replace("/","_")}.html` };
}

// ==============================
// FUNÇÃO PRINCIPAL (LAMBDA)
// ==============================
exports.handler = async (event) => {
  // Resposta de verificação de atividade
  if (event.httpMethod === 'GET') {
    return { statusCode: 200, body: '✅ Bot ativo e funcionando!' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Método não permitido' };
  }

  let corpoRequisicao;
  try {
    corpoRequisicao = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 200, body: 'Requisição inválida' };
  }

  const mensagem = corpoRequisicao.message;
  if (!mensagem?.text) {
    return { statusCode: 200, body: 'Mensagem vazia' };
  }

  const chatId = mensagem.chat.id;
  const texto = mensagem.text.trim();

  // Comandos básicos
  if (['/start', '/help'].includes(texto.toLowerCase())) {
    await enviarMensagemTelegram(chatId, `📋 **COMANDOS DISPONÍVEIS:**
• Envie **Nome**, **CPF/CNPJ** diretamente para buscar processos
• Use \`/oab UF NÚMERO\` (ex: \`/oab MS 3616\`) para buscar por OAB

    return { statusCode: 200, body: 'OK' };
  }

  // Busca por OAB
  if (texto.toLowerCase().startsWith('/oab')) {
    const dadosOab = texto.substring(4).trim();
    const matchOab = dadosOab.match(/^([A-Za-z]{2})\s*(\d+)$/);
    
    if (!matchOab) {
      await enviarMensagemTelegram(chatId, '❌ Formato inválido! Use: `/oab UF NÚMERO` (ex: `/oab SP 12345`)');
      return { statusCode: 200, body: 'OK' };
    }

    const uf = matchOab[1].toUpperCase();
    const numero = matchOab[2];
    const labelOab = `${uf}/${numero}`;

    await enviarMensagemTelegram(chatId, '⏳ Buscando processos da OAB...');

    if (!resultado?.items?.length) {
      await enviarMensagemTelegram(chatId, `❌ Nenhum processo encontrado para OAB ${labelOab}`);
      return { statusCode: 200, body: 'OK' };
    }

    const total = resultado.items.length;
    const advogado = resultado.advogado?.nome || 'Não identificado';
    await enviarMensagemTelegram(chatId, `✅ Encontrados **${total} processos** para OAB ${labelOab} (Advogado: ${advogado})`);

    // Envia processos individualmente
    for (const proc of resultado.items) {
    }

    // Gera e envia relatório TXT
    await enviarMensagemTelegram(chatId, '📄 Gerando relatório completo...');
    const relatorio = gerarRelatorioTxt(resultado.items, labelOab, resultado.advogado);
    await enviarDocumentoTelegram(chatId, `relatorio_oab_${uf}${numero}.txt`, relatorio);
    await enviarMensagemTelegram(chatId, '✅ Relatório enviado com sucesso!');
    return { statusCode: 200, body: 'OK' };
  }

  // Busca por CPF/CNPJ/Nome
  const limpo = texto.replace(/\D/g, '');
  const ehCpf = limpo.length === 11;
  const ehCnpj = limpo.length === 14;

  if (ehCpf) {
    await enviarMensagemTelegram(chatId, '⏳ Buscando CPF na fonte Vigilant...');
    const resVigilant = await buscarVigilant(limpo);
    const processos = [];

    if (resVigilant?.data?.courts?.length) {
      resVigilant.data.courts.forEach(tribunal => {
        tribunal.processes?.forEach(proc => {
          processos.push({ proc, tribunal: tribunal.court });
        });
      });
    }

    if (processos.length) {
      await enviarMensagemTelegram(chatId, `✅ Encontrados **${processos.length} processos** na fonte Vigilant`);
      for (const item of processos) {
        await enviarMensagemTelegram(chatId, formatarProcessoVigilant(item.proc, item.tribunal));
      }
      return { statusCode: 200, body: 'OK' };
    }

      await enviarMensagemTelegram(chatId, '❌ Nenhum processo encontrado para esse CPF');
      return { statusCode: 200, body: 'OK' };
    }

    }
    }
    return { statusCode: 200, body: 'OK' };
  }

  // Busca por CNPJ ou Nome
  const tipoBusca = ehCnpj ? 'cpf_cnpj' : 'nome';

  if (!resBusca?.items?.length) {
    await enviarMensagemTelegram(chatId, `❌ Nenhum processo encontrado para ${ehCnpj ? 'esse CNPJ' : 'esse nome'}`);
    return { statusCode: 200, body: 'OK' };
  }

  if (resBusca.envolvido_encontrado) {
    await enviarMensagemTelegram(chatId, `✅ Encontrado: **${resBusca.envolvido_encontrado.nome}** (${resBusca.envolvido_encontrado.quantidade_processos} processos)`);
  }
  for (const proc of resBusca.items) {
  }

  return { statusCode: 200, body: 'OK' };
};
