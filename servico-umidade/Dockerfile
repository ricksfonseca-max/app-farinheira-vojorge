FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORTA=8000 \
    BANCO=/dados/umidade.db \
    CONFIG_FORNOS=/app/config/fornos.json

WORKDIR /app
# Só biblioteca padrão do Python: nenhuma dependência para instalar.
COPY app ./app
COPY config ./config

RUN useradd --system --uid 1000 servico && mkdir -p /dados && chown servico /dados
USER servico
VOLUME ["/dados"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD python -c "import urllib.request,os; urllib.request.urlopen('http://127.0.0.1:%s/saude' % os.environ.get('PORTA','8000'), timeout=4)" || exit 1

CMD ["python", "-m", "app"]
