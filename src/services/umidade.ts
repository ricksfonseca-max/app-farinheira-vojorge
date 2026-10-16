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

export type Modo = "linha_base" | "conselheiro";
export type Manipulada = "alimentacao" | "rotacao";

export interface Sugestao {
  forno: string;
  calculada_em: string;
  origem: "amostra" | "vapor" | "setpoint";
  acao: AcaoSugestao;
  motivo: string;
  variavel: Manipulada; // a qual variável os campos *_hz se referem
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
    temp_saida_c: number | null; // PT100 na saída do produto (null até instalar)
    alimentacao_hz: number | null; // rosca dosadora
    rodando: boolean;
    lido_em: string;
  } | null;
  setpoint: {
    umidade_alvo: number;
    alterado_em: string | null;
    alterado_por: string | null;
    origem: "tela" | "configuracao";
  };
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
    faixa_qualidade: number;
    manipulada: Manipulada;
    nome_manipulada: string;
    f_min_hz: number;
    f_max_hz: number;
    setpoint_min: number;
    setpoint_max: number;
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

export interface EstadoModo {
  modo: Modo;
  texto: string;
  alterado_em: string | null;
  alterado_por: string | null;
}

export interface EstadoGeral {
  agora: string;
  coleta: { ultima_ok: string | null; ultimo_erro: string | null };
  modo: EstadoModo;
  pin_exigido: boolean;
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
  modo?: Modo;
  observacao?: string;
}

export interface ResumoUmidade {
  n: number;
  media: number | null;
  desvio: number | null;
  erro_medio_abs: number | null;
  dentro_faixa_pct: number | null;
}

export interface Series {
  forno: string;
  inicio: number; // epoch ms
  fim: number;
  passo_min: number;
  faixa_qualidade: number;
  variavel: Manipulada;
  leituras: {
    t: number; velocidade_hz: number | null; alimentacao_hz: number | null; pressao_bar: number | null;
    tsat_c: number | null; temp_saida_c: number | null; rodando: boolean;
  }[];
  amostras: { t: number; umidade: number; umidade_alvo: number | null; responsavel: string | null; tipo_farinha: string | null; origem: string }[];
  sugestoes: { t: number; velocidade_sugerida_hz: number | null; acao: AcaoSugestao; origem: string; aplicada: number | null; modo: Modo | null }[];
  setpoints: { t: number; umidade_alvo: number; alterado_por: string | null }[];
  modos: { t: number; modo: Modo }[];
  resumo: { geral: ResumoUmidade; por_modo: Record<Modo, ResumoUmidade>; faixa_qualidade: number };
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

const enc = encodeURIComponent;

export const umidadeApi = {
  estado: () => pedir<EstadoGeral>("/api/fornos"),

  registrarAmostra: (amostra: NovaAmostra) =>
    pedir<RespostaAmostra>("/api/amostras", { method: "POST", body: JSON.stringify(amostra) }),

  alterarSetpoint: (forno: string, umidade_alvo: number, usuario: string, pin: string, motivo?: string) =>
    pedir<EstadoForno>(`/api/fornos/${enc(forno)}/setpoint`, {
      method: "POST",
      body: JSON.stringify({ umidade_alvo, usuario, pin, motivo }),
    }),

  alterarModo: (modo: Modo, usuario: string, pin: string, motivo?: string) =>
    pedir<EstadoModo>("/api/modo", { method: "POST", body: JSON.stringify({ modo, usuario, pin, motivo }) }),

  series: (forno: string, horas: number) =>
    pedir<Series>(`/api/series?forno=${enc(forno)}&horas=${horas}`, undefined, 20000),

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

export const TEXTO_MODO: Record<Modo, string> = {
  linha_base: "Linha de base",
  conselheiro: "Conselheiro",
};

/** Número no formato brasileiro (vírgula decimal). */
export function fmt(v: number | null | undefined, casas = 1) {
  return v === null || v === undefined || Number.isNaN(v) ? "–" : v.toFixed(casas).replace(".", ",");
}
