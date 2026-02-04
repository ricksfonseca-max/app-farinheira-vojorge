// src/services/api.ts

// URL DEFINITIVA DO SEU BACKEND
const API_BASE = "https://nodered-v2.fsk.tec.br/api"; 

export const api = {
  // Salvar registro
  salvar: async (dados: any) => {
    try {
      const res = await fetch(`${API_BASE}/producao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      return res.ok;
    } catch (e) {
      console.error("Erro Conexão:", e);
      return false;
    }
  },

  // Listar registros (Para a tabela/dashboard)
  listar: async () => {
    try {
      const res = await fetch(`${API_BASE}/producao`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error("Erro Conexão:", e);
      return [];
    }
  }
};
