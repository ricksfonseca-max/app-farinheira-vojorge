# Serviço de sugestão de rotação dos fornos

Serviço Python (Docker) que lê a **rotação** e a **pressão do vapor** dos dois fornos
rotativos, recebe a **umidade** apontada pelo operador no app Farinheira (a cada ~20 min) e
**sugere a rotação** de cada forno. Ele grava tudo em banco para avaliar o modelo ao fim do mês.

> **Modo conselheiro:** o serviço **não escreve nada no CLP**. Ele só sugere. O operador
> decide e ajusta a rotação na IHM. O serviço registra se a sugestão foi seguida.

```
M580 ──Modbus──► Node-RED ──GET /api/fornos (15 s)──► servico-umidade ◄──POST /api/amostras── App Farinheira
                                                          │  SQLite (/dados/umidade.db)
                                                          └──► GET /api/fornos ──► Painel no app
```

Usa apenas a biblioteca padrão do Python, sem `pip install`. A imagem é pequena e não depende de internet.

---

## 1. Como o modelo calcula

**Tempo de residência ∝ 1 / rotação** (mais rápido = sai mais úmida) e
**taxa de secagem ∝ (T_vapor − T_massa)** (vapor mais frio = seca menos).

1. **Temperatura do vapor:** pressão do manômetro + 1,013 bar → tabela de vapor saturado.
   Exemplos: 7 bar = 170 °C, 8 bar = 175 °C.
2. **Fator de vapor:** `fator = (Tsat − 100) / (Tsat_ref − 100)`, que vale 1,0 com o vapor de referência (175 °C).
3. **Rotação base:** `base = rotação / fator`, ou seja, a rotação equivalente com o vapor de referência.
4. **Amostra de umidade:** o serviço calcula a **base média enquanto aquela massa estava no forno**
   (janela de `t_residencia_min`, terminando `t_coleta_min` antes da coleta) e corrige:

   ```
   erro          = umidade − umidade_alvo
   Δbase         = −alfa × erro / K          (limitado a ± passo_max_hz; 0 dentro da banda morta)
   base_desejada = base_janela + Δbase
   sugestão      = base_desejada × fator_atual (limitada a f_min_hz … f_max_hz)
   ```

5. **Entre amostras (feedforward):** a cada leitura, `sugestão = base_desejada × fator_atual`.
   Se o vapor cai, a sugestão de reduzir a rotação aparece **na hora**, sem esperar a próxima amostra.

Partir da **janela**, e não da rotação atual, garante três coisas:

- **não corrige duas vezes:** se a amostra ainda reflete a rotação antiga, o alvo calculado é o mesmo;
- **não acumula:** se o operador não aplicar a sugestão, a próxima amostra repete a mesma sugestão;
- **não perde a compensação de vapor:** ela continua valendo mesmo quando a umidade está boa.

Isso foi verificado com um forno simulado nos testes (`tests/test_servico.py`). Numa queda de vapor
de 8 para 6,5 bar, a umidade fica em 12,0 % seguindo as sugestões; sem ação, ela vai para 14,7 %.
Com a massa de entrada 1,5 ponto mais úmida, a umidade volta para dentro da banda em três amostras, sem oscilar.

### Travas

| Situação | O que o serviço faz |
|---|---|
| Umidade fora de 2–30 % | `CONFIRA A AMOSTRA`: não usa o valor |
| Amostra com mais de 40 min | Guarda, mas não corrige |
| Sem leitura do CLP há mais de 2 min | `SEM DADOS`: nunca sugere com dado velho |
| Forno parado / vapor insuficiente | `PARADO` / `SEM VAPOR` |
| Erro dentro de ± banda morta | Não corrige (evita reagir a ruído da medição) |
| Correção grande | Limitada a `passo_max_hz` por amostra |
| Sugestão fora da faixa | Limitada a `f_min_hz` … `f_max_hz` |

---

## 2. Instalação

### 2.1 Node-RED: endpoint `/api/fornos`

1. Importe `nodered/fluxo-api-fornos.json` (Menu → Import).
2. Ligue a saída do seu nó **modbus-read** do M580 na entrada do nó **Escala leitura Modbus**.
3. Ajuste os índices e as escalas desse nó para o seu mapa de `%MW`. O exemplo usa:

   | %MW | Conteúdo |
   |---|---|
   | %MW100 | Rotação forno 1 em Hz × 10 |
   | %MW101 | Rotação forno 2 em Hz × 10 |
   | %MW102 | Pressão do vapor em bar × 10 (manométrica) |
   | %MW103 | bit0 = forno 1 girando, bit1 = forno 2 girando |

4. Teste: `http://192.168.10.201:1880/api/fornos` deve responder:

   ```json
   {"fornos":[{"forno":"Forno 01","velocidade_hz":42.5,"pressao_vapor_bar":7.8,"rodando":true}, ...]}
   ```

No M580, a rotação vem do inversor: a frequência de saída do Altivar, lida pelo DDT do drive na
rede Ethernet ou pelo retorno analógico. Copie esse valor para os `%MW` acima numa seção ST:

```
%MW100 := REAL_TO_INT(Forno1_FreqSaida_Hz * 10.0);
%MW101 := REAL_TO_INT(Forno2_FreqSaida_Hz * 10.0);
%MW102 := REAL_TO_INT(Vapor_Pressao_bar * 10.0);
%MW103.0 := M_Forno1.xFbk_Contato;
%MW103.1 := M_Forno2.xFbk_Contato;
```

Use a **frequência real de saída** do inversor, não a referência. Se a unidade for rpm em vez de Hz,
basta manter a mesma unidade em todo o sistema e ajustar `f_min_hz`/`f_max_hz`.

### 2.2 Subir os containers

Na raiz do repositório:

```bash
docker compose up -d --build
docker compose logs -f servico-umidade
```

Se já existe um container Python no servidor, basta copiar a pasta `servico-umidade/` e rodar
`python -m app` com as mesmas variáveis de ambiente.

O app acessa o serviço por `/umidade-api/`: o `nginx.conf` do app encaminha para `servico-umidade:8000`
na rede do Docker. Os dois containers precisam estar no mesmo compose ou na mesma rede Docker.

### 2.3 Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `FONTE_PROCESSO_URL` | – | Endpoint do Node-RED com rotação e vapor |
| `REGISTROS_URL` | – | Opcional: `/api/registros` do Node-RED, para importar apontamentos perdidos |
| `INTERVALO_LEITURA_S` | 15 | Período de leitura do processo |
| `LEITURA_VALIDADE_S` | 120 | Idade máxima da leitura para sugerir |
| `FUSO_HORARIO_PADRAO` | -03:00 | Fuso para datas sem fuso vindas do Node-RED |
| `TOKEN_API` | – | Se definido, `POST /api/amostras` exige o cabeçalho `X-Token` |
| `BANCO` | /dados/umidade.db | Arquivo SQLite (fica no volume `dados-umidade`) |

### 2.4 Parâmetros por forno: `config/fornos.json`

`padrao` vale para todos; dentro de `fornos` você sobrescreve por forno. Reinicie o container após alterar.

| Parâmetro | Padrão | O que é |
|---|---|---|
| `umidade_alvo` | 12,0 | Umidade desejada (%) |
| `banda_morta` | 0,3 | Erro (%) que não gera correção |
| `ganho_k` | 0,5 | % de umidade por Hz. **O mais importante: levantar nos dados (seção 3)** |
| `alfa` | 0,5 | Fração do erro corrigida por amostra (0,3 conservador … 1,0 agressivo) |
| `passo_max_hz` | 2,0 | Correção máxima por amostra |
| `f_min_hz` / `f_max_hz` | 20 / 60 | Faixa permitida para sugestão |
| `t_residencia_min` | 30 | Tempo da massa do início ao fim do forno. **Medir** |
| `t_coleta_min` | 5 | Tempo entre a saída do forno e a leitura do medidor |
| `tsat_ref_c` | 175 | Temperatura de vapor de referência (≈ 8 bar) |
| `t_produto_c` | 100 | Temperatura da massa enquanto evapora |
| `usar_k_aprendido` | false | Usa o K estimado pelos dados quando ele for confiável |

---

## 3. O mês de coleta (fase 1)

1. **Semana 1:** confira se rotação, vapor e umidade estão corretos no painel. Meça o
   `t_residencia_min` real: marque a massa (ou observe uma mudança de produto) e cronometre.
2. **Semanas 2 a 4:** o operador segue as sugestões quando concordar. Para o serviço conseguir
   **medir o K**, a rotação precisa variar. Peça alguns **degraus planejados**, por exemplo +3 Hz por
   uma hora e depois −3 Hz, em turnos tranquilos.
3. O painel mostra o K estimado (`dados: 0,42 (18 am., confiável)`). Ele passa a ser confiável com
   15 ou mais amostras de janela estável, rotação variando 2 Hz ou mais e R² de pelo menos 0,3.
4. **Fim do mês:** exporte os CSV (abrem direto no Excel brasileiro) e avalie:
   - `GET /umidade-api/api/exportar/amostras.csv`: umidade + rotação/vapor da janela de cada amostra
   - `GET /umidade-api/api/exportar/sugestoes.csv`: sugestão, motivo e se foi aplicada (`aplicada` = 1/0)
   - `GET /umidade-api/api/exportar/leituras.csv?dias=7`: série de rotação e vapor

   Compare a variação da umidade nos períodos em que a sugestão foi seguida com os períodos em que
   não foi. Com K e tempo de residência validados, ative `usar_k_aprendido` ou fixe o K medido e
   decida pela fase 2 (malha fechada, com o setpoint escrito no CLP e limites no próprio CLP).

---

## 4. API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | 200 se a leitura do CLP está em dia, 503 se não |
| GET | `/api/fornos` | Estado dos fornos + sugestão atual (usado pelo painel) |
| GET | `/api/fornos/{forno}` | Um forno (`Forno%2001`) |
| POST | `/api/amostras` | `{"forno","umidade","data_hora","responsavel","tipo_farinha","peneira"}` → sugestão |
| GET | `/api/amostras`, `/api/sugestoes`, `/api/leituras` | `?forno=&dias=&horas=&limite=` |
| GET | `/api/exportar/{amostras\|sugestoes\|leituras}.csv` | CSV com `;`, vírgula decimal e hora local |

## 5. Testes

```bash
cd servico-umidade
python -m unittest discover -s tests -t .
```

São 43 testes: tabela de vapor, regras do modelo, simulação de forno (perturbação de massa,
queda de vapor, operador ignorando a sugestão), sincronização com o Node-RED e a API HTTP de ponta a ponta.
