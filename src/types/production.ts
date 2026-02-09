export interface ProductionRecord {
  id: number;
  data: string;
  hora: string;
  umidade: number;
  pressao: number;     // <--- NOVO: Pressão do Vapor/Manômetro
  forno: string;
  tipoFarinha: string;
  peneira: string;
  responsavel: string;
  foto?: string;
}

export interface ProductionFormData {
  umidade: number;
  pressao: number;     // <--- NOVO
  forno: string;
  tipoFarinha: string;
  peneira: string;
  usuario: string;
  foto?: string;
}
