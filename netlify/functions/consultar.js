exports.handler = async (event) => {
  const { tipo, valor } = event.queryStringParameters;
  
  try {
    console.log('Requisição recebida:', tipo, valor);
    
    if (tipo === 'oab') {
      const [uf, numero] = valor.trim().split(/\s+/);
      console.log('OAB:', uf, numero);
      
      // Simulação de resultado para teste
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          total: 1, 
          itens: [{ 
            numero_cnj: '0000000-00.0000.0.00.0000', 
            fontes: [{ nome: 'Teste', capa: { classe: '', assunto: '' } }] 
          }], 
          origem: 'Modo Teste',
          mensagem: 'API funcionando - implementação real pendente'
        })
      };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 0, itens: [], erro: 'Tipo não suportado' })
    };
  } catch (erro) {
    console.log('Erro geral:', erro.message);
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total: 0, itens: [], erro: erro.message }) 
    };
  }
};
