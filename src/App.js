import React, { useState } from 'react';
import './App.css';

function App() {
  const [formData, setFormData] = useState({
    pressao: '',
    umidade: '',
    peneira: 'Fina', // Padrão: Peneira Fina
    tipoFarinha: 'Tipo 1', // Padrão: Farinha Tipo 1
  });

  const [enviando, setEnviando] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setEnviando(true);

    try {
      // Endereço da Fábrica (Node-RED)
      const apiUrl = 'http://192.168.10.201:1880';
      
      const response = await fetch(`${apiUrl}/api/registro-qualidade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, data_hora: new Date().toISOString() }),
      });

      if (response.ok) {
        alert('✅ Dados registrados com sucesso!');
        setFormData(prev => ({ ...prev, pressao: '', umidade: '' }));
      } else {
        alert('❌ Erro ao salvar.');
      }
    } catch (error) {
      alert('❌ Erro de conexão com a fábrica.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="App" style={{ padding: '20px', maxWidth: '600px', margin: 'auto', fontFamily: 'Arial' }}>
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#2c3e50' }}>🏭 Farinheira Vó Jorge</h1>
        <p style={{ color: '#7f8c8d' }}>Controle de Qualidade - Fornos</p>
      </header>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
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

        {/* PENEIRA */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Peneira Atual:</label>
          <select name="peneira" value={formData.peneira} onChange={handleChange} style={{ padding: '15px', fontSize: '16px' }}>
            <option value="Fina">Peneira Fina (1.0mm)</option>
            <option value="Media">Peneira Média (2.0mm)</option>
            <option value="Grossa">Peneira Grossa (3.0mm)</option>
          </select>
        </div>

        {/* PRESSÃO */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Pressão do Forno (mmCA):</label>
          <input type="number" name="pressao" placeholder="Ex: 150" value={formData.pressao} onChange={handleChange} required style={{ padding: '15px', fontSize: '18px' }} />
        </div>

        {/* UMIDADE */}
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <label style={{ fontWeight: 'bold' }}>Umidade Coletada (%):</label>
          <input type="number" step="0.1" name="umidade" placeholder="Ex: 12.5" value={formData.umidade} onChange={handleChange} required style={{ padding: '15px', fontSize: '18px' }} />
        </div>

        <button type="submit" disabled={enviando} style={{ marginTop: '20px', padding: '20px', fontSize: '20px', backgroundColor: enviando ? '#95a5a6' : '#27ae60', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
          {enviando ? 'Enviando...' : '💾 SALVAR DADOS'}
        </button>
      </form>
    </div>
  );
}

export default App;
