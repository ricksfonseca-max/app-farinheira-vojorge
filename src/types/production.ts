export interface ProductionRecord {
  id: string;
  data: string;
  hora: string;
  forno: string;
  umidade: number;
  tipoFarinha: string;
  peneira: string;
  responsavel: string;
  createdAt: string;
}

export type ProductionFormData = {
  data: string;
  hora: string;
  forno: string;
  umidade: string;
  tipoFarinha: string;
  peneira: string;
  responsavel: string;
};
