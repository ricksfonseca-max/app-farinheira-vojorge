// 1. Apontamos para o túnel correto da sua API
const API_BASE = "https://api.fsk.tec.br/api";

export interface RegistroProducao {
  id?: number;
  data_hora?: string;
  umidade: number;
  pressao: number;
  forno: string;
  tipo_farinha: string;
  peneira: string;
  responsavel: string;
  foto?: string;
  // --- NOVAS GAVETAS ADICIONADAS ---
  turno_num?: number;
  cliente?: string;
  produto?: string;
  ensaque?: string;
}

export const api = {
  // 2. Método SALVAR (POST) apontando para a rota certa
  salvar: async (dados: RegistroProducao) => {
    try {
      // Injeta a data e hora automaticamente, tal como funcionava antes
      const payloadCompleto = { ...dados, data_hora: new Date().toISOString() };
      console.log("Enviando dados:", payloadCompleto);

      // Rota correta do Node-RED: /registro-qualidade
      const res = await fetch(`${API_BASE}/registro-qualidade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCompleto)
      });

      if (!res.ok) {
        const erroTexto = await res.text();
        console.error("Erro Servidor:", res.status, erroTexto);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error("Erro Rede/Fetch:", error);
      return false;
    }
  },

  // 3. Método LISTAR (GET) apontando para a rota certa
  listar: async (): Promise<RegistroProducao[]> => {
    try {
      // Rota correta do Node-RED: /registros
      const res = await fetch(`${API_BASE}/registros`);
      if (!res.ok) throw new Error("Falha ao buscar");
      return await res.json();
    } catch (error) {
      console.error("Erro Listar:", error);
      return [];
    }
  }
};
