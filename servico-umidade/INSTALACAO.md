# Instalação no servidor da fábrica (`~/industria-v4`)

Roteiro para o servidor Ubuntu que já roda o `docker-compose.yml` do `industria-v4`
(MySQL, Redis, Node-RED em modo host, app-farinheira). Cada etapa diz o que deve aparecer (✅).
Se algo sair diferente, pare e verifique antes de seguir.

## Etapa 1 · Código do app na branch nova

```bash
cd ~/industria-v4/app-farinheira && git status --short && git branch --show-current
```
✅ Nenhum arquivo listado (sem alterações locais). Se aparecer algum, **não continue**: guarde as
alterações antes (`git stash` ou um commit).

```bash
git fetch origin && git checkout feature/sugestao-umidade-fornos && git pull && git log --oneline -3
```
✅ Os três últimos commits da branch.

## Etapa 2 · Banco e usuário no MySQL + arquivo de configuração

Use só letras e números na senha e no PIN (a senha entra numa URL).

```bash
cd ~/industria-v4
read -s -p "Senha nova do usuário 'umidade' no MySQL (letras e números): " PWU; echo
read -s -p "PIN do supervisor para a tela (números): " PIN; echo
docker exec -i mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' 2>/dev/null <<SQL
CREATE DATABASE IF NOT EXISTS controle_umidade CHARACTER SET utf8mb4;
CREATE DATABASE IF NOT EXISTS controle_umidade_teste CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'umidade'@'%' IDENTIFIED BY '${PWU}';
ALTER USER 'umidade'@'%' IDENTIFIED BY '${PWU}';
GRANT ALL PRIVILEGES ON controle_umidade.* TO 'umidade'@'%';
GRANT ALL PRIVILEGES ON controle_umidade_teste.* TO 'umidade'@'%';
GRANT SELECT ON industria_v4.controle_qualidade TO 'umidade'@'%';
FLUSH PRIVILEGES;
SQL
cat > umidade.env <<EOF
BANCO=mysql://umidade:${PWU}@mysql:3306/controle_umidade
TEST_BANCO_URL=mysql://umidade:${PWU}@mysql:3306/controle_umidade_teste
SENHA_SUPERVISOR=${PIN}
FONTE_PROCESSO_URL=http://host.docker.internal:1880/api/fornos
MODO_INICIAL=linha_base
FUSO_HORARIO_PADRAO=-03:00
TZ=America/Sao_Paulo
EOF
chmod 600 umidade.env && unset PWU PIN
docker exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW GRANTS FOR umidade"' 2>/dev/null
```
✅ Três linhas `GRANT ...` (controle_umidade, controle_umidade_teste e SELECT em controle_qualidade).

O usuário `umidade` só enxerga os próprios bancos e **lê** a tabela de apontamentos. Ele não
tem acesso aos bancos da Evolution, do peeler etc.

## Etapa 3 · Serviço no docker-compose

```bash
cd ~/industria-v4 && cp docker-compose.yml docker-compose.yml.bak-$(date +%F-%H%M) && python3 - <<'EOF'
p = "docker-compose.yml"
linhas = open(p, encoding="utf-8").read().split("\n")
if any(l.strip() == "servico-umidade:" for l in linhas):
    raise SystemExit("servico-umidade já está no compose: nada alterado.")
if "volumes:" not in linhas:
    raise SystemExit("Seção 'volumes:' não encontrada: nada alterado.")
i = linhas.index("volumes:")
while i > 0 and linhas[i - 1].startswith("#"):
    i -= 1
bloco = """  # ------------------------------------------------
  # 🌡️ 12. CONTROLE DE UMIDADE DOS FORNOS (Python)
  # ------------------------------------------------
  servico-umidade:
    container_name: servico-umidade
    build: ./app-farinheira/servico-umidade
    restart: always
    env_file: ./umidade.env
    extra_hosts:
      - "host.docker.internal:host-gateway"
    volumes:
      - ./app-farinheira/servico-umidade/config/fornos.json:/app/config/fornos.json:ro
    depends_on:
      - mysql
""".split("\n")
open(p, "w", encoding="utf-8").write("\n".join(linhas[:i] + bloco + linhas[i:]))
print("OK: servico-umidade adicionado")
EOF
docker compose config -q && echo "compose válido"
```
✅ `OK: servico-umidade adicionado` e `compose válido`.

Para desfazer: `cp docker-compose.yml.bak-<data> docker-compose.yml`.

## Etapa 4 · Testes contra o MySQL de verdade

```bash
cd ~/industria-v4 && docker compose build servico-umidade && \
docker compose run --rm servico-umidade python -m unittest discover -s tests -t . 2>&1 | tail -4
```
✅ `Ran 68 tests` e `OK`. Os testes usam o banco `controle_umidade_teste`; o banco de
produção não é tocado.

## Etapa 5 · Subir

```bash
cd ~/industria-v4 && docker compose up -d --build servico-umidade app-farinheira && sleep 20 && \
docker compose ps servico-umidade app-farinheira && curl -s localhost:3000/umidade-api/saude; echo
```
✅ Os dois containers `Up`. O `saude` responde em JSON. Enquanto o fluxo `/api/fornos` não existir
no Node-RED, ele mostra `"ok": false` com erro 404, e o painel mostra "falha na leitura do CLP".
Isso é esperado nesta etapa.

Abra `https://qualidade.fsk.tec.br`: o painel aparece em **Linha de base** e os apontamentos já
contam para o comparativo "antes" (umidade, setpoint e variação).

## Etapa 6 · Node-RED (depois de levantar os %MW)

1. Importe `servico-umidade/nodered/fluxo-api-fornos.json` (Menu → Import).
2. Ligue o nó **modbus-read** do M580 em **Escala leitura Modbus** e ajuste os índices e as escalas.
3. Teste: `curl -s localhost:1880/api/fornos`.

O painel passa a mostrar rosca, rotação e vapor em até 15 s.

**Opcional (Redis):** ligue **Prepara SET no Redis** a um nó `redis-command` (comando `SET`) e
troque no `umidade.env` para `FONTE_PROCESSO_URL=redis://redis:6379/3?chave=umidade:fornos`.
Depois rode `docker compose up -d servico-umidade`.

## Voltar para a versão anterior

```bash
cd ~/industria-v4/app-farinheira && git checkout main && cd .. && \
docker compose stop servico-umidade && docker compose up -d --build app-farinheira
```

Os dados no MySQL ficam guardados. Para remover tudo: `DROP DATABASE controle_umidade;`.
