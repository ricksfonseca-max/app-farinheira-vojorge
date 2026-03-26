export const api = {
  salvar: async (payload: any) => {
    try {
      const response = await fetch('https://api.fsk.tec.br/api/registro-qualidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, data_hora: new Date().toISOString() }),
      });
      return response.ok;
    } catch (error) {
      console.error("Erro na API Global:", error);
      return false;
    }
  }
};
