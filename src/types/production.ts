// Adicionamos o campo 'foto' (opcional) nas duas interfaces

export interface ProductionRecord {
  id: number;
  data: string;
  hora: string;
  umidade: number;
  forno: string;
  tipoFarinha: string; // Campo mantido
  peneira: string;     // A famosa Bica
  responsavel: string;
  foto?: string;       // <--- NOVO CAMPO
}

export interface ProductionFormData {
  umidade: number;
  forno: string;
  tipoFarinha: string;
  peneira: string;
  usuario: string;     // Importante para saber quem enviou
  foto?: string;       // <--- NOVO CAMPO
}
