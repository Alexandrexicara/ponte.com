const fetch = require('node-fetch');

const BASE_NOSSA = 'https://busca-processos.onrender.com/api/v1';
const NOSSA_CHAVE = 'busca-processos-dev-key-2024';

async function testKey() {
  console.log('Testando chave:', NOSSA_CHAVE);
  console.log('URL:', `${BASE_NOSSA}/buscar/oab`);
  
  try {
    const resposta = await fetch(`${BASE_NOSSA}/buscar/oab`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': NOSSA_CHAVE
      },
      body: JSON.stringify({ estado: 'MS', numero: '3616' })
    });

    console.log('Status:', resposta.status);
    console.log('Status Text:', resposta.statusText);
    
    const texto = await resposta.text();
    console.log('Resposta bruta:', texto);
    
    try {
      const dados = JSON.parse(texto);
      console.log('Resposta JSON:', JSON.stringify(dados, null, 2));
    } catch (e) {
      console.log('Não foi possível parsear como JSON');
    }
    
    if (resposta.ok) {
      console.log('✅ Chave funcionou!');
    } else {
      console.log('❌ Chave não funcionou - erro na API');
    }
  } catch (erro) {
    console.error('❌ Erro na requisição:', erro.message);
  }
}

testKey();
