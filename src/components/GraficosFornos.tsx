import { KeyboardEvent, PointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Series, TEXTO_MODO, fmt, umidadeApi } from "@/services/umidade";

// Cores validadas contra o fundo escuro do app (#0f172a): azul, laranja e verde-água.
const COR = {
  medido: "#3987e5",
  vapor: "#d95926",
  saida: "#199e70",
  referencia: "#94a3b8", // setpoint e rotação sugerida (linhas de referência, neutras)
  faixa: "rgba(148, 163, 184, 0.14)",
  grade: "#1e293b",
  eixo: "#64748b",
};

const PERIODOS = [
  { rotulo: "6 h", horas: 6 },
  { rotulo: "24 h", horas: 24 },
  { rotulo: "7 dias", horas: 24 * 7 },
  { rotulo: "30 dias", horas: 24 * 30 },
];
const FORNOS = ["Forno 01", "Forno 02"];
const ALTURA = 170;
const MARGEM = { esq: 44, dir: 14, topo: 12, base: 8 };
const ALTURA_EIXO_X = 22;

type Ponto = { t: number; v: number | null };
type SerieGrafico = {
  nome: string;
  cor: string;
  pontos: Ponto[];
  forma: "linha" | "degrau" | "pontos";
  tracejado?: boolean;
  casas: number;
  unidade: string;
  alcanceMs: number; // distância máxima para o cursor "pegar" um ponto
};
type Faixa = { t: number; lo: number; hi: number }[];
type Marco = { t: number; texto: string };

// ------------------------------------------------------------------ utilidades de escala
function passoBonito(bruto: number) {
  const exp = Math.floor(Math.log10(bruto));
  const f = bruto / 10 ** exp;
  const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  return nf * 10 ** exp;
}

function escalaY(valores: number[]) {
  let min = Math.min(...valores);
  let max = Math.max(...valores);
  if (!Number.isFinite(min)) { min = 0; max = 1; }
  if (max - min < 1e-6) { min -= 1; max += 1; }
  const passo = passoBonito((max - min) / 4);
  const lo = Math.floor(min / passo) * passo;
  const hi = Math.ceil(max / passo) * passo;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + passo / 2; v += passo) ticks.push(Number(v.toFixed(6)));
  return { lo, hi, ticks, casas: passo < 1 ? (passo < 0.1 ? 2 : 1) : 0 };
}

function ticksTempo(x0: number, x1: number, largura: number) {
  const alvo = Math.max(2, Math.floor(largura / 90));
  const passos = [15, 30, 60, 120, 180, 360, 720, 1440, 2880, 4320, 10080].map((m) => m * 60000);
  const passo = passos.find((p) => (x1 - x0) / p <= alvo) ?? passos[passos.length - 1];
  const fuso = new Date().getTimezoneOffset() * 60000; // alinha em horas locais redondas
  const ticks: number[] = [];
  for (let t = Math.ceil((x0 - fuso) / passo) * passo + fuso; t <= x1; t += passo) ticks.push(t);
  return { ticks, comDia: x1 - x0 > 36 * 3600000 };
}

function rotuloTempo(t: number, comDia: boolean) {
  const d = new Date(t);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return comDia ? `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}` : hora;
}

/** Valor da série no instante t (degrau: último valor; demais: ponto mais próximo dentro do alcance). */
function valorEm(s: SerieGrafico, t: number): Ponto | null {
  const pts = s.pontos;
  if (!pts.length) return null;
  if (s.forma === "degrau") {
    let achado: Ponto | null = null;
    for (const p of pts) { if (p.t <= t) achado = p; else break; }
    return achado && achado.v !== null ? { t, v: achado.v } : null;
  }
  let melhor: Ponto | null = null;
  let dist = Infinity;
  for (const p of pts) {
    const d = Math.abs(p.t - t);
    if (d < dist && p.v !== null) { dist = d; melhor = p; }
  }
  return melhor && dist <= s.alcanceMs ? melhor : null;
}

// ------------------------------------------------------------------ um painel
function Painel({
  titulo, series, faixa, x0, x1, largura, cursor, setCursor, mostrarEixoX, marcos, aviso,
}: {
  titulo: string;
  series: SerieGrafico[];
  faixa?: Faixa;
  x0: number;
  x1: number;
  largura: number;
  cursor: number | null;
  setCursor: (t: number | null) => void;
  mostrarEixoX: boolean;
  marcos: Marco[];
  aviso?: string;
}) {
  const w = Math.max(10, largura - MARGEM.esq - MARGEM.dir);
  const h = ALTURA - MARGEM.topo - MARGEM.base;
  const alturaTotal = ALTURA + (mostrarEixoX ? ALTURA_EIXO_X : 0);
  const x = (t: number) => MARGEM.esq + ((t - x0) / (x1 - x0)) * w;

  const valores = [
    ...series.flatMap((s) => s.pontos.map((p) => p.v).filter((v): v is number => v !== null)),
    ...(faixa ?? []).flatMap((f) => [f.lo, f.hi]),
  ];
  const temDados = series.some((s) => s.pontos.some((p) => p.v !== null));
  const ey = escalaY(valores);
  const y = (v: number) => MARGEM.topo + h - ((v - ey.lo) / (ey.hi - ey.lo)) * h;
  const tt = ticksTempo(x0, x1, w);

  const caminho = (s: SerieGrafico) => {
    let d = "";
    let aberto = false;
    let anterior: number | null = null;
    s.pontos.forEach((p, i) => {
      if (p.v === null) { aberto = false; return; }
      const px = x(p.t).toFixed(1);
      const py = y(p.v).toFixed(1);
      if (s.forma === "degrau" && aberto && anterior !== null) {
        d += ` L${px},${y(anterior).toFixed(1)} L${px},${py}`;
      } else {
        d += `${aberto ? " L" : " M"}${px},${py}`;
      }
      aberto = true;
      anterior = p.v;
      if (s.forma === "degrau" && i === s.pontos.length - 1) d += ` L${x(x1).toFixed(1)},${py}`;
    });
    return d.trim();
  };

  const caminhoFaixa = () => {
    if (!faixa?.length) return "";
    const topo: string[] = [];
    const base: string[] = [];
    faixa.forEach((f, i) => {
      const ini = x(f.t);
      const fim = x(i < faixa.length - 1 ? faixa[i + 1].t : x1);
      topo.push(`${ini.toFixed(1)},${y(f.hi).toFixed(1)}`, `${fim.toFixed(1)},${y(f.hi).toFixed(1)}`);
      base.unshift(`${fim.toFixed(1)},${y(f.lo).toFixed(1)}`, `${ini.toFixed(1)},${y(f.lo).toFixed(1)}`);
    });
    return `M${[...topo, ...base].join(" L")} Z`;
  };

  const mover = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    const t = x0 + ((px - MARGEM.esq) / w) * (x1 - x0);
    setCursor(Math.min(x1, Math.max(x0, t)));
  };

  const leitura = cursor === null ? [] : series.map((s) => ({ s, p: valorEm(s, cursor) }));
  const cursorX = cursor === null ? null : x(cursor);
  const tooltipEsquerda = cursorX !== null && cursorX > largura * 0.6;

  return (
    <div className="relative">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
        <h4 className="text-xs font-bold uppercase tracking-wide text-slate-300">{titulo}</h4>
        {series.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
            {series.map((s) => (
              <span key={s.nome} className="flex items-center gap-1.5">
                <svg width="18" height="8" aria-hidden="true">
                  <line x1="1" y1="4" x2="17" y2="4" stroke={s.cor} strokeWidth="2" strokeDasharray={s.tracejado ? "4 3" : undefined} strokeLinecap="round" />
                </svg>
                {s.nome}
              </span>
            ))}
          </div>
        )}
      </div>
      <svg width={largura} height={alturaTotal} role="img" aria-label={titulo} className="block select-none">
        {ey.ticks.map((v) => (
          <g key={v}>
            <line x1={MARGEM.esq} x2={MARGEM.esq + w} y1={y(v)} y2={y(v)} stroke={COR.grade} strokeWidth="1" />
            <text x={MARGEM.esq - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10.5" fill={COR.eixo} fontFamily="ui-monospace, monospace">
              {fmt(v, ey.casas)}
            </text>
          </g>
        ))}
        {faixa && <path d={caminhoFaixa()} fill={COR.faixa} />}
        {marcos.map((m) => (
          <g key={m.t}>
            <line x1={x(m.t)} x2={x(m.t)} y1={MARGEM.topo} y2={MARGEM.topo + h} stroke={COR.eixo} strokeWidth="1" />
            <text x={x(m.t) + 4} y={MARGEM.topo + 10} fontSize="10" fill="#cbd5e1">{m.texto}</text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.nome}>
            {s.forma !== "pontos" || s.pontos.length > 1 ? (
              <path d={caminho(s)} fill="none" stroke={s.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={s.tracejado ? "5 4" : undefined} opacity={s.forma === "pontos" ? 0.55 : 1} />
            ) : null}
            {s.forma === "pontos" &&
              s.pontos.map((p) => p.v !== null && (
                <circle key={p.t} cx={x(p.t)} cy={y(p.v)} r="4" fill={s.cor} stroke="#0f172a" strokeWidth="2" />
              ))}
          </g>
        ))}
        {!temDados && (
          <text x={MARGEM.esq + w / 2} y={MARGEM.topo + h / 2} textAnchor="middle" fontSize="12" fill={COR.eixo}>
            {aviso || "Sem dados no período"}
          </text>
        )}
        {cursorX !== null && (
          <g pointerEvents="none">
            <line x1={cursorX} x2={cursorX} y1={MARGEM.topo} y2={MARGEM.topo + h} stroke="#cbd5e1" strokeWidth="1" />
            {leitura.map(({ s, p }) => p && p.v !== null && (
              <circle key={s.nome} cx={x(p.t)} cy={y(p.v)} r="4.5" fill={s.cor} stroke="#0f172a" strokeWidth="2" />
            ))}
          </g>
        )}
        {mostrarEixoX && tt.ticks.map((t) => (
          <text key={t} x={x(t)} y={ALTURA + 14} textAnchor="middle" fontSize="10.5" fill={COR.eixo}>
            {rotuloTempo(t, tt.comDia)}
          </text>
        ))}
        <rect x={MARGEM.esq} y={MARGEM.topo} width={w} height={h} fill="transparent"
          onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setCursor(null)} style={{ touchAction: "pan-y" }} />
      </svg>
      {cursorX !== null && cursor !== null && leitura.some(({ p }) => p) && (
        <div
          className="pointer-events-none absolute z-10 min-w-[150px] rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-xl"
          style={{ top: 28, ...(tooltipEsquerda ? { right: largura - cursorX + 10 } : { left: cursorX + 10 }) }}
        >
          <div className="mb-1 text-[11px] text-slate-400">{rotuloTempo(cursor, true)}</div>
          {leitura.map(({ s, p }) => (
            <div key={s.nome} className="flex items-center gap-2 text-xs">
              <svg width="12" height="6" aria-hidden="true">
                <line x1="1" y1="3" x2="11" y2="3" stroke={s.cor} strokeWidth="2" strokeDasharray={s.tracejado ? "3 2" : undefined} />
              </svg>
              <span className="font-mono font-bold text-slate-100">{p && p.v !== null ? `${fmt(p.v, s.casas)} ${s.unidade}` : "–"}</span>
              <span className="text-slate-400">{s.nome}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ indicadores
function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-slate-500">{rotulo}</div>
      <div className="text-xl font-bold text-slate-100">{valor}</div>
      {detalhe && <div className="text-[11px] text-slate-500">{detalhe}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ componente principal
export function GraficosFornos() {
  const [forno, setForno] = useState(FORNOS[0]);
  const [horas, setHoras] = useState(24);
  const [dados, setDados] = useState<Series | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [cursor, setCursor] = useState<number | null>(null);
  const [verTabela, setVerTabela] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(800);

  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(280, Math.floor(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setDados(await umidadeApi.series(forno, horas));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "indisponível");
    } finally {
      setCarregando(false);
    }
  }, [forno, horas]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 60000);
    return () => clearInterval(t);
  }, [carregar]);

  const graf = useMemo(() => {
    if (!dados) return null;
    const passoMs = dados.passo_min * 60000;
    const alcance = Math.max(passoMs * 2, 120000);
    const leituras = dados.leituras;
    const faixa = dados.faixa_qualidade;
    const temSaida = leituras.some((l) => l.temp_saida_c !== null);
    const umidade: SerieGrafico = {
      nome: "Umidade medida", cor: COR.medido, forma: "pontos", casas: 1, unidade: "%", alcanceMs: 45 * 60000,
      pontos: dados.amostras.map((a) => ({ t: a.t, v: a.umidade })),
    };
    const setpoint: SerieGrafico = {
      nome: "Setpoint", cor: COR.referencia, forma: "degrau", tracejado: true, casas: 1, unidade: "%", alcanceMs: 0,
      pontos: dados.setpoints.map((s) => ({ t: s.t, v: s.umidade_alvo })),
    };
    return {
      faixaUmidade: dados.setpoints.map((s) => ({ t: s.t, lo: s.umidade_alvo - faixa, hi: s.umidade_alvo + faixa })),
      umidade: [umidade, setpoint],
      rotacao: [
        { nome: "Rotação real", cor: COR.medido, forma: "linha", casas: 1, unidade: "Hz", alcanceMs: alcance,
          pontos: leituras.map((l) => ({ t: l.t, v: l.velocidade_hz })) },
        { nome: "Sugerida", cor: COR.referencia, forma: "degrau", tracejado: true, casas: 1, unidade: "Hz", alcanceMs: 0,
          pontos: dados.sugestoes.map((s) => ({ t: s.t, v: s.velocidade_sugerida_hz })) },
      ] as SerieGrafico[],
      vapor: [
        { nome: "Vapor (saturação)", cor: COR.vapor, forma: "linha", casas: 1, unidade: "°C", alcanceMs: alcance,
          pontos: leituras.map((l) => ({ t: l.t, v: l.tsat_c })) },
      ] as SerieGrafico[],
      saida: [
        { nome: "Saída do produto", cor: COR.saida, forma: "linha", casas: 1, unidade: "°C", alcanceMs: alcance,
          pontos: leituras.map((l) => ({ t: l.t, v: l.temp_saida_c })) },
      ] as SerieGrafico[],
      temSaida,
      marcos: dados.modos.slice(1).map((m) => ({ t: m.t, texto: `→ ${TEXTO_MODO[m.modo]}` })),
    };
  }, [dados]);

  const teclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!dados || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    const passo = dados.passo_min * 60000;
    const base = cursor ?? dados.fim;
    setCursor(Math.min(dados.fim, Math.max(dados.inicio, base + (e.key === "ArrowRight" ? passo : -passo))));
  };

  const r = dados?.resumo;
  const pm = r?.por_modo;
  const comparar = pm && pm.linha_base.n > 0 && pm.conselheiro.n > 0;

  return (
    <section className="mb-8 rounded-xl border border-slate-800 bg-[#0f172a] p-4 shadow-2xl">
      {/* filtros: uma linha, acima de tudo */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-700 p-0.5">
          {FORNOS.map((f) => (
            <button key={f} type="button" onClick={() => setForno(f)}
              className={`rounded-md px-3 py-1.5 text-sm font-bold ${forno === f ? "bg-emerald-500/15 text-emerald-400" : "text-slate-400 hover:text-slate-200"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-slate-700 p-0.5">
          {PERIODOS.map((p) => (
            <button key={p.horas} type="button" onClick={() => setHoras(p.horas)}
              className={`rounded-md px-3 py-1.5 text-sm ${horas === p.horas ? "bg-slate-700 font-bold text-slate-100" : "text-slate-400 hover:text-slate-200"}`}>
              {p.rotulo}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setVerTabela((v) => !v)}
          className="ml-auto rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
          {verTabela ? "Ver gráficos" : "Ver tabela"}
        </button>
      </div>

      {erro && !dados && <p className="py-10 text-center text-sm text-slate-500">Gráficos indisponíveis ({erro}).</p>}

      {r && (
        <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Indicador rotulo="Amostras" valor={String(r.geral.n)} detalhe="no período" />
          <Indicador rotulo="Umidade média" valor={r.geral.media === null ? "–" : `${fmt(r.geral.media)}%`} />
          <Indicador rotulo="Variação (desvio)" valor={r.geral.desvio === null ? "–" : `± ${fmt(r.geral.desvio, 2)}`} detalhe="pontos de umidade" />
          <Indicador rotulo="Dentro da faixa" valor={r.geral.dentro_faixa_pct === null ? "–" : `${fmt(r.geral.dentro_faixa_pct, 0)}%`} detalhe={`setpoint ± ${fmt(r.faixa_qualidade)}`} />
          <Indicador rotulo="Erro médio" valor={r.geral.erro_medio_abs === null ? "–" : fmt(r.geral.erro_medio_abs, 2)} detalhe="distância do setpoint" />
        </div>
      )}
      {comparar && pm && (
        <div className="mb-4 rounded-lg border border-emerald-800/50 bg-emerald-500/5 px-3 py-2 text-sm text-slate-300">
          <span className="font-bold text-slate-100">Antes × depois neste período:</span>{" "}
          dentro da faixa {fmt(pm.linha_base.dentro_faixa_pct, 0)}% → {fmt(pm.conselheiro.dentro_faixa_pct, 0)}% · variação ±{" "}
          {fmt(pm.linha_base.desvio, 2)} → ± {fmt(pm.conselheiro.desvio, 2)}
        </div>
      )}

      <div ref={caixa} tabIndex={0} onKeyDown={teclado} onBlur={() => setCursor(null)}
        className={`outline-none transition-opacity ${carregando && dados ? "opacity-60" : "opacity-100"}`}
        aria-label="Gráficos do forno. Use as setas para percorrer o tempo.">
        {graf && dados && !verTabela && (
          <div className="space-y-4">
            <Painel titulo="Umidade da farinha (%)" series={graf.umidade} faixa={graf.faixaUmidade} x0={dados.inicio} x1={dados.fim}
              largura={largura} cursor={cursor} setCursor={setCursor} mostrarEixoX={false} marcos={graf.marcos}
              aviso="Nenhuma amostra de umidade no período" />
            <Painel titulo="Rotação do forno (Hz)" series={graf.rotacao} x0={dados.inicio} x1={dados.fim}
              largura={largura} cursor={cursor} setCursor={setCursor} mostrarEixoX={false} marcos={graf.marcos}
              aviso="Sem leitura de rotação no período" />
            <Painel titulo="Vapor · temperatura de saturação (°C)" series={graf.vapor} x0={dados.inicio} x1={dados.fim}
              largura={largura} cursor={cursor} setCursor={setCursor} mostrarEixoX={!graf.temSaida} marcos={graf.marcos}
              aviso="Sem leitura de vapor no período" />
            {graf.temSaida && (
              <Painel titulo="Saída do produto · PT100 (°C)" series={graf.saida} x0={dados.inicio} x1={dados.fim}
                largura={largura} cursor={cursor} setCursor={setCursor} mostrarEixoX marcos={graf.marcos} />
            )}
            {!graf.temSaida && (
              <p className="text-[11px] text-slate-500">
                Temperatura de saída do produto: aparece aqui assim que o PT100 for ligado ao CLP.
              </p>
            )}
          </div>
        )}
        {dados && verTabela && (
          <div className="max-h-[480px] overflow-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-950 text-left text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Data/hora</th>
                  <th className="px-3 py-2 text-right">Umidade</th>
                  <th className="px-3 py-2 text-right">Setpoint</th>
                  <th className="px-3 py-2 text-right">Diferença</th>
                  <th className="px-3 py-2">Operador</th>
                </tr>
              </thead>
              <tbody>
                {[...dados.amostras].reverse().map((a) => {
                  const dif = a.umidade_alvo === null ? null : a.umidade - a.umidade_alvo;
                  return (
                    <tr key={a.t} className="border-t border-slate-800 text-slate-300">
                      <td className="px-3 py-1.5 text-slate-400">{rotuloTempo(a.t, true)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">{fmt(a.umidade)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono">{fmt(a.umidade_alvo)}%</td>
                      <td className="px-3 py-1.5 text-right font-mono">{dif === null ? "–" : `${dif > 0 ? "+" : ""}${fmt(dif)}`}</td>
                      <td className="px-3 py-1.5 text-slate-400">{a.responsavel || "–"}</td>
                    </tr>
                  );
                })}
                {dados.amostras.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-500">Nenhuma amostra no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
