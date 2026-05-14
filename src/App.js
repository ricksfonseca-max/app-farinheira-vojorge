import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    pressao: '',
    umidade: '',
    peneira: '', // Começa vazio para permitir texto livre
    tipoFarinha: 'Tipo 1', // Padrão: Farinha Tipo 1
    cliente: '',
    produto: '',
    ensaque: '',
  });

  const [enviando, setEnviando] = useState(false);
  const apiUrl = 'http://192.168.10.201:1880'; // Endereço da Fábrica (Node-RED)

  // --- O SEGREDO: BUSCA A PRESSÃO SOZINHO ---
  useEffect(() => {
    const buscarPressao = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/pressao-forno`);
        const data = await response.json();
        
        if (data && data.pressao !== undefined) {
          setFormData(prev => ({ ...prev, pressao: data.pressao }));
        }
      } catch (error) {
        console.error('Erro ao ler a pressão do Node-RED:', error);
      }
    };

    buscarPressao(); // Busca assim que abre a aplicação
    const intervalo = setInterval(buscarPressao, 5000); // Atualiza a cada 5 segundos
    
    return () => clearInterval(intervalo);
  }, []);
  // ------------------------------------------

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);

    // LÓGICA PARA 3 TURNOS (Altere as horas aqui se necessário)
    const horaAtual = new Date().getHours();
    let turnoAtual = 3; // Por defeito é o Turno 3 (Madrugada: das 22h às 05h59)
    
    if (horaAtual >= 6 && horaAtual < 14) {
      turnoAtual = 1; // Turno 1 (Manhã: das 06h às 13h59)
    } else if (horaAtual >= 14 && horaAtual < 22) {
      turnoAtual = 2; // Turno 2 (Tarde/Noite: das 14h às 21h59)
    }

    try {
      const response = await fetch(`${apiUrl}/api/registro-qualidade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData, 
          turno_num: turnoAtual, // Injeta o turno automático 1, 2 ou 3
          data_hora: new Date().toISOString() 
        }),
      });

      if (response.ok) {
        alert('✅ Dados registados com sucesso!');
        // Limpa apenas os campos que mudam a cada lote (mantém a peneira, cliente, etc., se quiser)
        setFormData(prev => ({ ...prev, umidade: '', cliente: '', produto: '', ensaque: '' }));
      } else {
        alert('❌ Erro ao guardar.');
      }
    } catch (error) {
      alert('❌ Erro de ligação com a fábrica.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'Arial' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#2c3e50' }}>🏭 Farinheira Vô Jorge</h1>
        <p style={{ color: '#7f8c8d' }}>Controlo de Qualidade - Fornos</p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        {/* CLIENTE (Com Autocomplete) */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Cliente (Opcional):</label>
          <input type="text" name="cliente" list="clientesList" placeholder="Ex: Amafil..." value={formData.cliente} onChange={handleChange} style={{ padding: '15px', fontSize: '16px' }} />
          <datalist id="clientesList">
            <option value="Cliente A" />
            <option value="Cliente B" />
            <option value="Exportação" />
          </datalist>
        </div>

        {/* PRODUTO (Com Autocomplete) */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Produto (Opcional):</label>
          <input type="text" name="produto" list="produtosList" placeholder="Ex: Amido Nativo..." value={formData.produto} onChange={handleChange} style={{ padding: '15px', fontSize: '16px' }} />
          <datalist id="produtosList">
            <option value="Amido Nativo" />
            <option value="Fécula Premium" />
          </datalist>
        </div>

        {/* ENSAQUE (Com Autocomplete) */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Ensaque (Opcional):</label>
          <input type="text" name="ensaque" list="ensaquesList" placeholder="Ex: Saco 25kg..." value={formData.ensaque} onChange={handleChange} style={{ padding: '15px', fontSize: '16px' }} />
          <datalist id="ensaquesList">
            <option value="Saco 25Kg Valvulado" />
            <option value="Big Bag 1000Kg" />
            <option value="Saco Papel 25Kg" />
          </datalist>
        </div>

        {/* TIPO DE FARINHA */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Tipo de Farinha:</label>
          <select name="tipoFarinha" value={formData.tipoFarinha} onChange={handleChange} style={{ padding: '15px', fontSize: '16px' }}>
            <option value="Tipo 1">Farinha Tipo 1 (Branca)</option>
            <option value="Tipo 2">Farinha Tipo 2 (Amarela)</option>
            <option value="Integral">Farinha Integral</option>
            <option value="Biju">Farinha Bijú</option>
          </select>
        </div>

        {/* PENEIRA (Agora com escrita livre e sugestões) */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Peneira Atual:</label>
          <input type="text" name="peneira" list="peneirasList" placeholder="Escreva ou escolha da lista..." value={formData.peneira} onChange={handleChange} required style={{ padding: '15px', fontSize: '16px' }} />
          <datalist id="peneirasList">
            <option value="Fina (1.0mm)" />
            <option value="Média (2.0mm)" />
            <option value="Grossa (3.0mm)" />
          </datalist>
        </div>

        {/* PRESSÃO */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Pressão do Forno (mmCA):</label>
          <input type="number" step="0.1" name="pressao" placeholder="A ler do PLC..." value={formData.pressao} onChange={handleChange} required style={{ padding: '15px', fontSize: '18px', backgroundColor: '#e8f8f5' }} />
        </div>

        {/* HUMIDADE */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Humidade Recolhida (%):</label>
          <input type="number" step="0.1" name="umidade" placeholder="Ex: 12.5" value={formData.umidade} onChange={handleChange} required style={{ padding: '15px', fontSize: '18px' }} />
        </div>

        <button type="submit" disabled={enviando} style={{ marginTop: '20px', padding: '20px', fontSize: '20px', backgroundColor: enviando ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
          {enviando ? 'A Enviar...' : '💾 GUARDAR DADOS'}
        </button>
      </form>
    </div>
  );
}

export default App;
