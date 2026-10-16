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
  // --- NOVAS COLUNAS ADICIONADAS ---
  turno_num?: number;
  cliente?: string;
  produto?: string;
  ensaque?: string;
}

export const api = {
  salvar: async (dados: RegistroProducao) => {
    try {
      const payloadCompleto = { ...dados, data_hora: dados.data_hora ?? new Date().toISOString() };
      const res = await fetch(`${API_BASE}/registro-qualidade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadCompleto)
      });
      return res.ok;
    } catch (error) {
      console.error("Erro ao salvar:", error);
      return false;
    }
  },

  listar: async (): Promise<RegistroProducao[]> => {
    try {
      const res = await fetch(`${API_BASE}/registros`);
      if (!res.ok) throw new Error("Falha ao buscar");
      return await res.json();
    } catch (error) {
      console.error("Erro ao listar:", error);
      return [];
    }
  }
};
