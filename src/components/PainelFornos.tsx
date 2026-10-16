import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, Cog, Download, Droplets, Flame, Gauge, Minus, Pencil, Target, Thermometer, X,
} from "lucide-react";
import { EstadoForno, EstadoGeral, Modo, TEXTO_ACAO, TEXTO_MODO, fmt, umidadeApi } from "@/services/umidade";

const INTERVALO_MS = 10000;
const CHAVE_USUARIO = "umidade_supervisor";

const ESTILO_ACAO: Record<string, { caixa: string; texto: string }> = {
  reduzir: { caixa: "border-amber-500/60 bg-amber-500/10", texto: "text-amber-400" },
  aumentar: { caixa: "border-sky-500/60 bg-sky-500/10", texto: "text-sky-400" },
  manter: { caixa: "border-marca-500/50 bg-marca-500/10", texto: "text-marca-400" },
  amostra_invalida: { caixa: "border-rose-500/60 bg-rose-500/10", texto: "text-rose-400" },
};
const ESTILO_NEUTRO = { caixa: "border-mata-700 bg-mata-800/40", texto: "text-mata-400" };

function lerUsuario() {
  try { return localStorage.getItem(CHAVE_USUARIO) || ""; } catch { return ""; }
}
function salvarUsuario(nome: string) {
  try { localStorage.setItem(CHAVE_USUARIO, nome); } catch { /* sem armazenamento: tudo bem */ }
}

function minutosAte(iso: string | null, agora: number) {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - agora) / 60000);
}

function horaLocal(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "–";
}

function dataLocal(iso: string | null | undefined) {
  return iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "–";
}

// ------------------------------------------------------------------ modal do supervisor
function ModalSupervisor({
  titulo, pinExigido, aoFechar, aoConfirmar, children, textoConfirmar = "Confirmar",
}: {
  titulo: string;
  pinExigido: boolean;
  aoFechar: () => void;
  aoConfirmar: (usuario: string, pin: string, motivo: string) => Promise<void>;
  children?: ReactNode;
  textoConfirmar?: string;
}) {
  const [usuario, setUsuario] = useState(lerUsuario);
  const [pin, setPin] = useState("");
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) { setErro("Informe seu nome."); return; }
    setEnviando(true);
    setErro(null);
    try {
      await aoConfirmar(usuario.trim(), pin, motivo.trim());
      salvarUsuario(usuario.trim());
      aoFechar();
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4" onClick={aoFechar}>
      <form
        onSubmit={enviar}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-mata-700 bg-mata-925 p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-mata-100">{titulo}</h3>
          <button type="button" onClick={aoFechar} className="text-mata-500 hover:text-mata-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          {children}
          <Campo rotulo="Seu nome">
            <input value={usuario} onChange={(e) => setUsuario(e.target.value)} maxLength={60} className={CLASSE_INPUT} />
          </Campo>
          {pinExigido && (
            <Campo rotulo="PIN do supervisor">
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} className={CLASSE_INPUT} />
            </Campo>
          )}
          <Campo rotulo="Motivo (opcional)">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} className={CLASSE_INPUT} />
          </Campo>
          {erro && <p className="text-sm font-medium text-rose-400">{erro}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={aoFechar} className="rounded-lg px-4 py-2 text-sm text-mata-400 hover:bg-mata-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-marca-600 px-4 py-2 text-sm font-bold text-white hover:bg-marca-500 disabled:opacity-50"
          >
            {enviando ? "Salvando..." : textoConfirmar}
          </button>
        </div>
      </form>
    </div>
  );
}

const CLASSE_INPUT =
  "h-10 w-full rounded-lg border border-mata-700 bg-mata-900 px-3 text-mata-100 outline-none focus:border-marca-500";

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-mata-500">{rotulo}</span>
      {children}
    </label>
  );
}

// ------------------------------------------------------------------ cartão de cada forno
function Medida({
  icone, rotulo, valor, detalhe, cor, acao, destaque = false,
}: { icone: ReactNode; rotulo: string; valor: string; detalhe?: ReactNode; cor: string; acao?: ReactNode; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-2 ${destaque ? "border-marca-600/60 bg-marca-500/5" : "border-mata-800 bg-mata-900/60"}`}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-mata-500">
          {icone} {rotulo}
        </div>
        {acao}
      </div>
      <div className={`font-mono text-lg font-bold ${cor}`}>{valor}</div>
      {detalhe && <div className="font-mono text-[11px] text-mata-500">{detalhe}</div>}
    </div>
  );
}

function CartaoForno({
  f, agora, modo, pinExigido, aoAtualizar,
}: { f: EstadoForno; agora: number; modo: Modo; pinExigido: boolean; aoAtualizar: () => void }) {
  const [editando, setEditando] = useState(false);
  const [novoSp, setNovoSp] = useState(String(f.setpoint.umidade_alvo).replace(".", ","));
  const s = f.sugestao;
  const estilo = ESTILO_ACAO[s.acao] || ESTILO_NEUTRO;
  const alvo = f.setpoint.umidade_alvo;
  const faixa = f.parametros.faixa_qualidade ?? f.parametros.banda_morta;
  const umid = f.ultima_amostra?.umidade ?? null;
  const corUmid =
    umid === null ? "text-mata-500" : Math.abs(umid - alvo) <= faixa ? "text-marca-400" : umid > alvo ? "text-amber-400" : "text-sky-400";
  const falta = minutosAte(f.proxima_amostra_em, agora);
  const idadeLeitura = f.leitura ? Math.round((agora - new Date(f.leitura.lido_em).getTime()) / 1000) : null;
  const Icone = s.acao === "reduzir" ? ArrowDown : s.acao === "aumentar" ? ArrowUp : Minus;
  const tempSaida = f.leitura?.temp_saida_c ?? null;
  const porRosca = f.parametros.manipulada === "alimentacao";
  const nomeVM = (f.parametros.nome_manipulada || (porRosca ? "Rosca" : "Rotação")).toLowerCase();

  const salvarSetpoint = async (usuario: string, pin: string, motivo: string) => {
    const valor = Number(novoSp.replace(",", "."));
    if (!Number.isFinite(valor)) throw new Error("Digite um número, ex.: 12,5");
    await umidadeApi.alterarSetpoint(f.forno, valor, usuario, pin, motivo || undefined);
    aoAtualizar();
  };

  return (
    <div className="rounded-xl border border-mata-800 bg-mata-925 p-4 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-black uppercase tracking-tight text-mata-100">{f.forno}</h3>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[11px] font-bold ${
            f.leitura?.rodando ? "bg-marca-500/15 text-marca-400" : "bg-mata-800 text-mata-500"
          }`}
        >
          {f.leitura ? (f.leitura.rodando ? "GIRANDO" : "PARADO") : "SEM LEITURA"}
          {idadeLeitura !== null && idadeLeitura > 60 ? ` · há ${Math.round(idadeLeitura / 60)} min` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Medida
          icone={<Cog size={14} />}
          rotulo="Rosca dosadora"
          valor={`${fmt(f.leitura?.alimentacao_hz)} Hz`}
          detalhe={porRosca ? "ajuste sugerido" : "alimentação"}
          cor="text-mata-100"
          destaque={porRosca}
        />
        <Medida
          icone={<Gauge size={14} />}
          rotulo="Rotação forno"
          valor={`${fmt(f.leitura?.velocidade_hz)} Hz`}
          detalhe={porRosca ? undefined : "ajuste sugerido"}
          cor="text-mata-100"
          destaque={!porRosca}
        />
        <Medida
          icone={<Flame size={14} />}
          rotulo="Vapor"
          valor={`${fmt(f.leitura?.pressao_bar)} bar`}
          detalhe={f.leitura?.tsat_c ? `${fmt(f.leitura.tsat_c, 0)} °C` : undefined}
          cor="text-orange-400"
        />
        <Medida
          icone={<Thermometer size={14} />}
          rotulo="Saída produto"
          valor={tempSaida === null ? "–" : `${fmt(tempSaida)} °C`}
          detalhe={tempSaida === null ? "PT100 a instalar" : "PT100"}
          cor={tempSaida === null ? "text-mata-600" : "text-rose-300"}
        />
        <Medida
          icone={<Droplets size={14} />}
          rotulo="Umidade"
          valor={umid === null ? "–" : `${fmt(umid)}%`}
          detalhe={
            <>
              {f.ultima_amostra ? `amostra ${horaLocal(f.ultima_amostra.coletada_em)}` : "sem amostra"}
              {" · "}
              {falta !== null && falta > 0 ? (
                `próxima em ${falta} min`
              ) : (
                <span className="font-bold text-rose-400 animate-pulse">coletar agora</span>
              )}
            </>
          }
          cor={corUmid}
        />
        <Medida
          icone={<Target size={14} />}
          rotulo="Setpoint"
          valor={`${fmt(alvo)}%`}
          detalhe={`± ${fmt(faixa)}${f.setpoint.alterado_por ? ` · ${f.setpoint.alterado_por}` : ""}`}
          cor="text-mata-100"
          acao={
            <button
              type="button"
              onClick={() => { setNovoSp(String(alvo).replace(".", ",")); setEditando(true); }}
              className="rounded p-1 text-mata-500 hover:bg-mata-800 hover:text-marca-400"
              aria-label={`Alterar setpoint do ${f.forno}`}
              title="Alterar setpoint"
            >
              <Pencil size={13} />
            </button>
          }
        />
      </div>

      {modo === "linha_base" ? (
        <div className="mt-3 rounded-lg border border-dashed border-mata-700 bg-mata-900/40 p-3 text-sm text-mata-400">
          <span className="font-bold text-mata-300">Registrando a linha de base.</span> Opere o forno como de
          costume: as sugestões ficam ocultas até o comparativo "antes" estar completo.
        </div>
      ) : (
        <div className={`mt-3 rounded-lg border-2 p-3 ${estilo.caixa}`}>
          <div className="flex items-center justify-between gap-3">
            <div className={`flex items-center gap-2 text-xl font-black ${estilo.texto}`}>
              <Icone size={22} />
              {TEXTO_ACAO[s.acao] || s.acao.toUpperCase()}
              {["aumentar", "reduzir", "manter"].includes(s.acao) && ` ${nomeVM.toUpperCase()}`}
            </div>
            {s.velocidade_sugerida_hz !== null && (
              <div className="text-right">
                <div className={`font-mono text-2xl font-black ${estilo.texto}`}>{fmt(s.velocidade_sugerida_hz)} Hz</div>
                {s.delta_hz !== null && Math.abs(s.delta_hz) >= 0.05 && (
                  <div className="font-mono text-xs text-mata-400">
                    {s.delta_hz > 0 ? "+" : ""}
                    {fmt(s.delta_hz)} Hz
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="mt-2 text-sm leading-snug text-mata-300">{s.motivo}</p>
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
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-mata-500">
        <span>{modo === "linha_base" ? "Nada é enviado ao CLP." : `Modo conselheiro: ajuste a ${nomeVM} na IHM.`}</span>
        <span title={f.modelo.motivo}>
          K {fmt(s.ganho_k, 2)} %/Hz
          {f.modelo.k !== null && ` · dados: ${fmt(f.modelo.k, 2)} (${f.modelo.n} am.${f.modelo.confiavel ? ", confiável" : ""})`}
        </span>
      </div>

      {editando && (
        <ModalSupervisor
          titulo={`Setpoint de umidade · ${f.forno}`}
          pinExigido={pinExigido}
          aoFechar={() => setEditando(false)}
          aoConfirmar={salvarSetpoint}
          textoConfirmar="Salvar setpoint"
        >
          <Campo rotulo={`Umidade alvo (%) · entre ${fmt(f.parametros.setpoint_min)} e ${fmt(f.parametros.setpoint_max)}`}>
            <input
              value={novoSp}
              onChange={(e) => setNovoSp(e.target.value)}
              inputMode="decimal"
              autoFocus
              className={`${CLASSE_INPUT} font-mono text-lg font-bold`}
            />
          </Campo>
        </ModalSupervisor>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ painel
export function PainelFornos({ atualizar = 0 }: { atualizar?: number }) {
  const [estado, setEstado] = useState<EstadoGeral | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [trocandoModo, setTrocandoModo] = useState(false);

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
      <div className="mb-6 rounded-xl border border-mata-800 bg-mata-900 p-4 text-sm text-mata-500">
        {erro ? `Controle de umidade indisponível (${erro}).` : "Carregando fornos..."}
      </div>
    );
  }

  const modo = estado.modo.modo;
  const outroModo: Modo = modo === "linha_base" ? "conselheiro" : "linha_base";

  return (
    <section className="mb-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-mata-400">Controle de umidade · fornos</h2>
          <button
            type="button"
            onClick={() => setTrocandoModo(true)}
            title="Alterar modo de operação"
            className={`rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
              modo === "linha_base"
                ? "border-mata-600 bg-mata-800 text-mata-300 hover:border-mata-400"
                : "border-marca-600/60 bg-marca-500/10 text-marca-400 hover:border-marca-400"
            }`}
          >
            {modo === "linha_base" ? "● " : "◆ "}
            {TEXTO_MODO[modo]}
            {estado.modo.alterado_em && ` · desde ${dataLocal(estado.modo.alterado_em)}`}
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {(erro || estado.coleta.ultimo_erro) && (
            <span className="flex items-center gap-1 text-amber-400" title={erro || estado.coleta.ultimo_erro || ""}>
              <AlertTriangle size={13} /> {erro ? "serviço sem resposta" : "falha na leitura do CLP"}
            </span>
          )}
          <a href={umidadeApi.urlExportar("amostras")} className="flex items-center gap-1 text-mata-500 hover:text-marca-400">
            <Download size={13} /> amostras
          </a>
          <a href={umidadeApi.urlExportar("sugestoes")} className="flex items-center gap-1 text-mata-500 hover:text-marca-400">
            <Download size={13} /> sugestões
          </a>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {estado.fornos.map((f) => (
          <CartaoForno key={f.forno} f={f} agora={agora} modo={modo} pinExigido={estado.pin_exigido} aoAtualizar={carregar} />
        ))}
      </div>

      {trocandoModo && (
        <ModalSupervisor
          titulo={`Mudar para "${TEXTO_MODO[outroModo]}"`}
          pinExigido={estado.pin_exigido}
          aoFechar={() => setTrocandoModo(false)}
          aoConfirmar={async (usuario, pin, motivo) => {
            await umidadeApi.alterarModo(outroModo, usuario, pin, motivo || undefined);
            await carregar();
          }}
          textoConfirmar={`Mudar para ${TEXTO_MODO[outroModo]}`}
        >
          <p className="text-sm leading-snug text-mata-400">
            {outroModo === "conselheiro"
              ? "Os operadores passam a ver a rotação sugerida. A data de hoje marca o fim do período \"antes\" no comparativo."
              : "As sugestões ficam ocultas e os dados voltam a contar como linha de base (\"antes\")."}
          </p>
        </ModalSupervisor>
      )}
    </section>
  );
}
