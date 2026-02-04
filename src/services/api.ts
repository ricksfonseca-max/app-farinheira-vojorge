// URL do teu Node-RED no Easypanel
const API_BASE = "https://nodered-v2.fsk.tec.br/api";

export interface RegistroProducao {
  id?: number;
  data_hora?: string;
  umidade: number;
  forno: string;
  tipo_farinha: string;
  peneira: string;
  responsavel: string;
  foto?: string; // Base64
}

export const api = {
  // Enviar dados para o Node-RED
  salvar: async (dados: RegistroProducao) => {
    try {
      const res = await fetch(`${API_BASE}/producao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
      return res.ok;
    } catch (error) {
      console.error("Erro ao salvar:", error);
      return false;
    }
  },

  // Buscar dados do Node-RED para a tabela
  listar: async (): Promise<RegistroProducao[]> => {
    try {
      const res = await fetch(`${API_BASE}/producao`);
      if (!res.ok) throw new Error("Falha ao buscar dados");
      return await res.json();
    } catch (error) {
      console.error("Erro ao listar:", error);
      return [];
    }
  }
};
