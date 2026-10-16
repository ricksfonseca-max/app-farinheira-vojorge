// Cliente do serviço de sugestão de rotação dos fornos (servico-umidade).
// Em produção o nginx do app encaminha /umidade-api/ para o container Python.
const API_UMIDADE = (import.meta.env.VITE_API_UMIDADE as string | undefined) || "/umidade-api";
const TOKEN_UMIDADE = import.meta.env.VITE_TOKEN_UMIDADE as string | undefined;

export type AcaoSugestao =
  | "manter"
  | "aumentar"
  | "reduzir"
  | "sem_dados"
  | "forno_parado"
  | "sem_vapor"
  | "amostra_invalida"
  | "amostra_antiga";

export interface Sugestao {
  forno: string;
  calculada_em: string;
  origem: "amostra" | "vapor";
  acao: AcaoSugestao;
  motivo: string;
  velocidade_atual_hz: number | null;
  velocidade_sugerida_hz: number | null;
  pressao_bar: number | null;
  tsat_c: number | null;
  umidade: number | null;
  umidade_alvo: number | null;
  erro: number | null;
  delta_hz: number | null;
  delta_amostra_hz?: number | null;
  delta_vapor_hz?: number | null;
  ganho_k: number | null;
  avisos: string[];
}

export interface EstadoForno {
  forno: string;
  leitura: {
    velocidade_hz: number | null;
    pressao_bar: number | null;
    tsat_c: number | null;
    rodando: boolean;
    lido_em: string;
  } | null;
  ultima_amostra: {
    umidade: number;
    coletada_em: string;
    responsavel: string | null;
    tipo_farinha: string | null;
  } | null;
  proxima_amostra_em: string | null;
  sugestao: Sugestao;
  parametros: {
    umidade_alvo: number;
    banda_morta: number;
    f_min_hz: number;
    f_max_hz: number;
    ganho_k: number;
    usar_k_aprendido: boolean;
    t_residencia_min: number;
    intervalo_amostra_min: number;
  };
  modelo: {
    k: number | null;
    r2: number | null;
    n: number;
    faixa_hz: number;
    confiavel: boolean;
    motivo: string;
  };
}

export interface EstadoGeral {
  agora: string;
  coleta: { ultima_ok: string | null; ultimo_erro: string | null };
  fornos: EstadoForno[];
}

export interface NovaAmostra {
  forno: string;
  umidade: number;
  data_hora: string;
  tipo_farinha?: string;
  peneira?: string;
  responsavel?: string;
}

export interface RespostaAmostra {
  amostra_id: number;
  duplicada: boolean;
  sugestao: Sugestao | null;
  observacao?: string;
}

async function pedir<T>(caminho: string, init?: RequestInit, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_UMIDADE}${caminho}`, {
      ...init,
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN_UMIDADE ? { "X-Token": TOKEN_UMIDADE } : {}),
        ...(init?.headers || {}),
      },
    });
    const corpo = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(corpo?.erro || `Erro ${res.status}`);
    return corpo as T;
  } finally {
    clearTimeout(timer);
  }
}

export const umidadeApi = {
  estado: () => pedir<EstadoGeral>("/api/fornos"),

  registrarAmostra: (amostra: NovaAmostra) =>
    pedir<RespostaAmostra>("/api/amostras", { method: "POST", body: JSON.stringify(amostra) }),

  urlExportar: (tabela: "amostras" | "sugestoes" | "leituras", dias = 31) =>
    `${API_UMIDADE}/api/exportar/${tabela}.csv?dias=${dias}`,
};

export const TEXTO_ACAO: Record<AcaoSugestao, string> = {
  manter: "MANTER",
  aumentar: "AUMENTAR",
  reduzir: "REDUZIR",
  sem_dados: "SEM DADOS",
  forno_parado: "PARADO",
  sem_vapor: "SEM VAPOR",
  amostra_invalida: "CONFIRA A AMOSTRA",
  amostra_antiga: "AMOSTRA ANTIGA",
};
