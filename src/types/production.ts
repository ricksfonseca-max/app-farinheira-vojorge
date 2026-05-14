export interface ProductionRecord {
  id: number;
  data_hora: string;
  responsavel: string;
  umidade: number;
  pressao: number;      // <--- Lida do Node-RED
  forno: string;
  tipo_farinha: string;
  peneira: string;
  foto?: string;
  // --- NOVAS COLUNAS ---
  turno_num?: number;
  cliente?: string;
  produto?: string;
  ensaque?: string;
}

export interface ProductionFormData {
  umidade: number;
  pressao: number;
  forno: string;
  tipoFarinha: string;
  peneira: string;
  usuario: string;
  foto?: string;
  cliente?: string;
  produto?: string;
  ensaque?: string;
}
