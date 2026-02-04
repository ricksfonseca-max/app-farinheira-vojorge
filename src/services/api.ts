const API_BASE = "https://nodered-v2.fsk.tec.br/api";

export interface RegistroProducao {
  id?: number;
  data_hora?: string;
  umidade: number;
  forno: string;
  tipo_farinha: string;
  peneira: string;
  responsavel: string;
  foto?: string;
}

export const api = {
  salvar: async (dados: RegistroProducao) => {
    try {
      console.log("Enviando dados:", dados); // Debug
      const res = await fetch(`${API_BASE}/producao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
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

  listar: async (): Promise<RegistroProducao[]> => {
    try {
      const res = await fetch(`${API_BASE}/producao`);
      if (!res.ok) throw new Error("Falha ao buscar");
      return await res.json();
    } catch (error) {
      console.error("Erro Listar:", error);
      return [];
    }
  }
};
