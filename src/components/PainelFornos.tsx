import { ReactNode, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Download, Droplets, Flame, Gauge, Minus, Timer } from "lucide-react";
import { EstadoForno, EstadoGeral, TEXTO_ACAO, umidadeApi } from "@/services/umidade";

const INTERVALO_MS = 10000;

const ESTILO_ACAO: Record<string, { caixa: string; texto: string }> = {
  reduzir: { caixa: "border-amber-500/60 bg-amber-500/10", texto: "text-amber-400" },
  aumentar: { caixa: "border-sky-500/60 bg-sky-500/10", texto: "text-sky-400" },
  manter: { caixa: "border-emerald-500/50 bg-emerald-500/10", texto: "text-emerald-400" },
  amostra_invalida: { caixa: "border-rose-500/60 bg-rose-500/10", texto: "text-rose-400" },
};
const ESTILO_NEUTRO = { caixa: "border-slate-700 bg-slate-800/40", texto: "text-slate-400" };

function fmt(v: number | null | undefined, casas = 1) {
  return v === null || v === undefined ? "–" : v.toFixed(casas).replace(".", ",");
}

function minutosAte(iso: string | null, agora: number) {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - agora) / 60000);
}

function horaLocal(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "–";
}

function CartaoForno({ f, agora }: { f: EstadoForno; agora: number }) {
  const s = f.sugestao;
  const estilo = ESTILO_ACAO[s.acao] || ESTILO_NEUTRO;
  const alvo = f.parametros.umidade_alvo;
  const banda = f.parametros.banda_morta;
  const umid = f.ultima_amostra?.umidade ?? null;
  const corUmid =
    umid === null ? "text-slate-500" : Math.abs(umid - alvo) <= banda ? "text-emerald-400" : umid > alvo ? "text-amber-400" : "text-sky-400";
  const falta = minutosAte(f.proxima_amostra_em, agora);
  const idadeLeitura = f.leitura ? Math.round((agora - new Date(f.leitura.lido_em).getTime()) / 1000) : null;
  const Icone = s.acao === "reduzir" ? ArrowDown : s.acao === "aumentar" ? ArrowUp : Minus;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0f172a] p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black uppercase tracking-tight text-slate-100">{f.forno}</h3>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
            f.leitura?.rodando ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"
          }`}
        >
          {f.leitura ? (f.leitura.rodando ? "GIRANDO" : "PARADO") : "SEM LEITURA"}
          {idadeLeitura !== null && idadeLeitura > 60 ? ` · há ${Math.round(idadeLeitura / 60)} min` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Medida icone={<Gauge size={14} />} rotulo="Rotação" valor={`${fmt(f.leitura?.velocidade_hz)} Hz`} cor="text-slate-100" />
        <Medida
          icone={<Flame size={14} />}
          rotulo="Vapor"
          valor={`${fmt(f.leitura?.pressao_bar)} bar`}
          detalhe={f.leitura?.tsat_c ? `${fmt(f.leitura.tsat_c, 0)} °C` : undefined}
          cor="text-orange-400"
        />
        <Medida
          icone={<Droplets size={14} />}
          rotulo={`Umidade (alvo ${fmt(alvo)}%)`}
          valor={umid === null ? "–" : `${fmt(umid)}%`}
          detalhe={f.ultima_amostra ? horaLocal(f.ultima_amostra.coletada_em) : undefined}
          cor={corUmid}
        />
        <Medida
          icone={<Timer size={14} />}
          rotulo="Próxima amostra"
          valor={falta === null ? "agora" : falta <= 0 ? "AGORA" : `${falta} min`}
          cor={falta !== null && falta <= 0 ? "text-rose-400 animate-pulse" : "text-slate-100"}
        />
      </div>

      <div className={`mt-3 rounded-lg border-2 p-3 ${estilo.caixa}`}>
        <div className="flex items-center justify-between gap-3">
          <div className={`flex items-center gap-2 text-xl font-black ${estilo.texto}`}>
            <Icone size={22} />
            {TEXTO_ACAO[s.acao] || s.acao.toUpperCase()}
          </div>
          {s.velocidade_sugerida_hz !== null && (
            <div className="text-right">
              <div className={`font-mono text-2xl font-black ${estilo.texto}`}>{fmt(s.velocidade_sugerida_hz)} Hz</div>
              {s.delta_hz !== null && Math.abs(s.delta_hz) >= 0.05 && (
                <div className="font-mono text-xs text-slate-400">
                  {s.delta_hz > 0 ? "+" : ""}
                  {fmt(s.delta_hz)} Hz
                </div>
              )}
            </div>
          )}
        </div>
        <p className="mt-2 text-sm leading-snug text-slate-300">{s.motivo}</p>
        {s.avisos?.length > 0 && (
          <ul className="mt-2 space-y-1">
            {s.avisos.map((a) => (
              <li key={a} className="flex items-start gap-1.5 text-xs text-amber-300/90">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Modo conselheiro: ajuste a rotação na IHM.</span>
        <span title={f.modelo.motivo}>
          K {fmt(s.ganho_k, 2)} %/Hz{" "}
          {f.modelo.k !== null && `· dados: ${fmt(f.modelo.k, 2)} (${f.modelo.n} am.${f.modelo.confiavel ? ", confiável" : ""})`}
        </span>
      </div>
    </div>
  );
}

function Medida({ icone, rotulo, valor, detalhe, cor }: { icone: ReactNode; rotulo: string; valor: string; detalhe?: string; cor: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
        {icone} {rotulo}
      </div>
      <div className={`font-mono text-lg font-bold ${cor}`}>{valor}</div>
      {detalhe && <div className="font-mono text-[11px] text-slate-500">{detalhe}</div>}
    </div>
  );
}

export function PainelFornos({ atualizar = 0 }: { atualizar?: number }) {
  const [estado, setEstado] = useState<EstadoGeral | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());

  const carregar = useCallback(async () => {
    try {
      setEstado(await umidadeApi.estado());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "indisponível");
    } finally {
      setAgora(Date.now());
    }
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(t);
  }, [carregar, atualizar]);

  if (!estado) {
    return (
      <div className="mb-6 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-500">
        {erro ? `Sugestão de rotação indisponível (${erro}).` : "Carregando fornos..."}
      </div>
    );
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Controle de umidade · fornos</h2>
        <div className="flex items-center gap-3 text-xs">
          {(erro || estado.coleta.ultimo_erro) && (
            <span className="flex items-center gap-1 text-amber-400" title={erro || estado.coleta.ultimo_erro || ""}>
              <AlertTriangle size={13} /> {erro ? "serviço sem resposta" : "falha na leitura do CLP"}
            </span>
          )}
          <a href={umidadeApi.urlExportar("amostras")} className="flex items-center gap-1 text-slate-500 hover:text-emerald-400">
            <Download size={13} /> amostras
          </a>
          <a href={umidadeApi.urlExportar("sugestoes")} className="flex items-center gap-1 text-slate-500 hover:text-emerald-400">
            <Download size={13} /> sugestões
          </a>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {estado.fornos.map((f) => (
          <CartaoForno key={f.forno} f={f} agora={agora} />
        ))}
      </div>
    </section>
  );
}
