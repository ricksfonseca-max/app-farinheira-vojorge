export interface ProductionRecord {
  id: string;
  data: string;
  hora: string;
  forno: string;
  umidade: string;
  tipoFarinha: string;
  peneira: string;
  responsavel: string;
  createdAt: Date;
}

export type ProductionFormData = Omit<ProductionRecord, 'id' | 'createdAt'>;
