# Ondaluz Ops

Protótipo de decisão operacional para a Ondaluz Telecom. A aplicação cruza inventário, Informs TR-069, diagnósticos TR-143 e chamados para atender duas jornadas:

- **NOC:** mostra problemas ativos agrupados por alcance e ordenados pelo lugar em que uma ação resolve mais clientes;
- **Suporte N1:** a partir do código do cliente, informa causa provável, evidências, fala sugerida e encaminhamento.

## Executar

Pré-requisitos: Docker Desktop (ou Docker Engine com Compose) e pelo menos 4 GB livres para a carga.

1. Coloque o pacote recebido na raiz, mantendo estes caminhos:

```text
ondaluz-pack/
└── data/
    ├── inventory.csv
    ├── informs.csv.gz
    ├── tickets.csv
    └── diagnostics.csv
```

2. Suba toda a solução:

```bash
docker compose up --build
```

A primeira execução importa 5,5 milhões de Informs e gera agregados diários. O serviço `data-loader` termina após a carga; execuções seguintes reutilizam o volume de forma idempotente.

Para confirmar que a carga terminou:

```bash
curl http://localhost:3000/health
```

O retorno deve conter `"status":"ok"`. Em uma máquina comum, a primeira carga pode levar alguns minutos; acompanhe com `docker compose logs -f data-loader`.

3. Abra [http://localhost:8080](http://localhost:8080). A API fica em [http://localhost:3000](http://localhost:3000).

Casos úteis para demonstração:

| Cliente | Caso esperado |
|---|---|
| `C545968` | incidente coletivo de fibra no Jardim Aurora |
| `C373254` | instabilidade do firmware Kestrel 2.4.1 |
| `C171248` | Turbo 500 incompatível com porta de 100 Mbps |

Para refazer a carga do zero:

```bash
docker compose down -v
docker compose up --build
```

O pacote de dados, o enunciado e o ZIP original estão no `.gitignore` e **não devem ser publicados**.

## Stack e estrutura

```text
apps/api/   NestJS, TypeScript, PostgreSQL e importador por COPY streaming
apps/web/   Vite, React, TypeScript e Recharts
docs/       diagnóstico, arquitetura, decisões e consultas de evidência
```

O PostgreSQL guarda os dados do protótipo e produz uma visão materializada diária por CPE/firmware. A tabela bruta de Informs é `UNLOGGED` por ser reconstruível a partir do pacote; os dados de negócio permanecem em tabelas normais.

Principais rotas:

- `GET /health`
- `GET /api/network/overview`
- `GET /api/network/incidents`
- `GET /api/customers/search?q=C545`
- `GET /api/customers/:customerId/support`

## Desenvolvimento e validação

Com Node.js 20+:

```bash
npm install
npm run build
npm test
npm run dev
```

O motor de decisão fica isolado em `apps/api/src/customers/decision-engine.ts`, com testes das regras e de suas precedências. As regras são intencionalmente explicáveis: nenhuma recomendação depende de um score opaco.

## Documentos da entrega

- [Diagnóstico para a diretoria](docs/diagnostico-diretoria.md)
- [Arquitetura proposta](docs/arquitetura.md)
- [Log de decisões](docs/log-decisoes.md)
- [Consultas de evidência](docs/consultas-evidencias.sql)
