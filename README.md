# Ondaluz Ops

Protótipo de decisão operacional para a Ondaluz Telecom. A aplicação cruza inventário, Informs TR-069, diagnósticos TR-143 e chamados para atender duas jornadas:

- **NOC:** mostra problemas ativos agrupados por alcance e ordenados pelo lugar em que uma ação resolve mais clientes;
- **Suporte N1:** a partir do código do cliente, informa causa provável, evidências e fala sugerida, permite abrir o chamado individual e define o encaminhamento.

## Caminho rápido para avaliação

| Pedido do enunciado                    | Onde está atendido                                                 |
| -------------------------------------- | ------------------------------------------------------------------ |
| Diagnóstico curto para a diretoria     | [`docs/diagnostico-diretoria.md`](docs/diagnostico-diretoria.md)   |
| Arquitetura para 300 mil CPEs          | [`docs/arquitetura.md`](docs/arquitetura.md)                       |
| Protótipo NOC, N1, cadastros e mapa    | Aplicação em `http://localhost:8080` após subir o Compose          |
| Hipóteses, ambiguidades e uso de IA    | [`docs/log-decisoes.md`](docs/log-decisoes.md)                     |     |
| Evidências reproduzíveis               | [`docs/consultas-evidencias.sql`](docs/consultas-evidencias.sql)   |
| Integração com ferramentas de IA       | [`docs/mcp.md`](docs/mcp.md)                                       |
| Agente OpenAI e revisão humana         | [`docs/agente-investigacao.md`](docs/agente-investigacao.md)       |
| Cobertura integral do enunciado        | [`docs/conformidade-enunciado.md`](docs/conformidade-enunciado.md) |
| Execução integral com um único comando | `docker compose up --build`                                        |

## Estrutura da entrega

Os três documentos obrigatórios ficam versionados exclusivamente em `docs/`:

```text
docs/
├── diagnostico-diretoria.md
├── arquitetura.md
└── log-decisoes.md
```

O pacote `ondaluz-pack/` é um insumo local e **não faz parte do repositório**. Ele está protegido pelo `.gitignore`; não use `git add -f` para incluí-lo. O avaliador deve obtê-lo separadamente e colocar a pasta completa na raiz do projeto, ao lado de `README.md` e `docker-compose.yml`.

## Executar

Pré-requisitos: Docker Desktop (ou Docker Engine com Compose) e pelo menos 4 GB livres no disco interno do Docker para a carga.

1. Coloque o pacote recebido na raiz do projeto. O caminho final deve ser exatamente `./ondaluz-pack/data/...`:

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

Para executar investigações reais com o agente, copie `.env.example` para `.env`, defina `OPENAI_API_KEY` localmente e reinicie o Compose. Sem a chave, todas as demais telas continuam funcionando e a aba **Revisão IA** mostra o estado de configuração sem simular uma resposta do modelo. Na visão do NOC, os detectores verificam o parque a cada cinco minutos, descartam candidatos duplicados e encaminham apenas problemas novos confirmados pelo agente para aprovação humana. O agente usa `gpt-6-luna` com raciocínio econômico e orçamento adaptativo de consultas; veja os controles de custo e contexto em [`docs/agente-investigacao.md`](docs/agente-investigacao.md).

A primeira execução importa 5,5 milhões de Informs e gera agregados diários. O serviço `data-loader` termina após a carga; execuções seguintes reutilizam o volume de forma idempotente.

Para confirmar que a carga terminou:

```bash
curl http://localhost:3000/health
```

O retorno deve conter `"status":"ok"`. Em uma máquina comum, a primeira carga pode levar alguns minutos; acompanhe com `docker compose logs -f data-loader`.

Se o loader retornar `No space left on device`, use `docker system df` para conferir o espaço do Docker. A importação cria arquivos temporários durante a agregação, além do volume persistente; libere cache de build antigo apenas se necessário e repita a carga com `docker compose down -v`.

3. Abra [http://localhost:8080](http://localhost:8080). O backend unificado fica em [http://localhost:3000](http://localhost:3000): o catálogo REST está em `/api` e o catálogo MCP em `/mcp`. O proxy web também publica os endpoints MCP em `http://localhost:8080/mcp/*`.

4. Rode a verificação ponta a ponta depois que os serviços estiverem saudáveis:

```bash
npm run smoke
```

O smoke test consulta o healthcheck, a fila do NOC e os quatro clientes de demonstração pelo mesmo proxy usado pela interface. Os casos cobrem as três saídas esperadas para o N1: resolver por telefone, escalar ao NOC e agendar visita.

Casos úteis para demonstração:

| Cliente   | Caso esperado                                |
| --------- | -------------------------------------------- |
| `C545968` | incidente coletivo de fibra no Jardim Aurora |
| `C373254` | instabilidade do firmware Kestrel 2.4.1      |
| `C171248` | Turbo 500 incompatível com porta de 100 Mbps |
| `C361578` | cobertura Wi-Fi resolvível por telefone      |

Para refazer a carga do zero:

```bash
docker compose down -v
docker compose up --build
```

O pacote de dados, o enunciado e o ZIP original estão no `.gitignore` e **não devem ser publicados**.

Antes de publicar, esta verificação deve terminar sem imprimir arquivos de dados:

```bash
git ls-files ondaluz-pack/ '*.csv' '*.csv.gz' '*.zip'
```

Sem saída significa que o pacote continua fora do repositório.

## Stack e estrutura

```text
apps/api/   NestJS, REST, MCP, PostgreSQL e importador por COPY streaming
apps/web/   Vite, React, TypeScript e Recharts
docs/       diagnóstico, arquitetura, decisões e consultas de evidência
```

O PostgreSQL guarda os dados do protótipo e produz uma visão materializada diária por CPE/firmware. A tabela bruta de Informs é `UNLOGGED` por ser reconstruível a partir do pacote; os dados de negócio permanecem em tabelas normais.

A aplicação NestJS publica REST e MCP na mesma porta e compartilha o mesmo pool PostgreSQL. Os seis domínios de dados MCP permanecem somente leitura; o domínio `application` espelha as jornadas REST, inclusive mutações validadas. O agente de investigação carrega apenas uma allowlist de consultas e não recebe essas ferramentas de escrita. Consulte o [contrato e as instruções de conexão](docs/mcp.md). Nesta fase a interface não possui autenticação e deve permanecer restrita ao ambiente local.

A documentação REST é publicada em três formatos sincronizados: Swagger UI em [`/api/docs`](http://localhost:8080/api/docs), OpenAPI JSON em [`/api/openapi.json`](http://localhost:8080/api/openapi.json) e OpenAPI YAML em [`/api/openapi.yaml`](http://localhost:8080/api/openapi.yaml). O bridge [`/mcp/openapi`](http://localhost:8080/mcp/openapi) transforma automaticamente cada `operationId` desse contrato em uma ferramenta MCP e publica um recurso compacto apenas com as rotas permitidas ao dashboard. Descrições, parâmetros, corpos e validações continuam declarados no controller, junto do endpoint correspondente, evitando uma segunda fonte de verdade.

Principais rotas:

- `GET /api` (catálogo unificado)
- `GET /health`
- `GET /api/docs` (Swagger UI)
- `GET /api/openapi.json` e `GET /api/openapi.yaml` (contrato para ferramentas)
- `GET /api/network/overview`
- `POST /api/dashboard/compose` (gera somente o plano visual; não envia dados operacionais ao modelo)
- `GET /api/network/incidents?page=1&pageSize=25&sort=score_desc`
- `GET /api/network/topology/devices?olt=OLT-2&pon=1/1&cto=CTO-2-11-01&page=1&pageSize=50&sort=customer_id_asc`
- `GET /api/customers?q=C373254&page=1&pageSize=25&sort=relevance&status=active`
- `GET /api/customers/search?q=C545&page=1&pageSize=8&sort=customer_id_asc&status=all`
- `GET /api/customers/:customerId` (cadastro e histórico de equipamentos)
- `GET /api/customers/:customerId/support`
- `GET /api/inventory?page=1&pageSize=50&sort=customer_id_asc`
- `GET /api/inventory/:serial`
- `GET /api/inventory/topology?olt=OLT-2&pon=1/7&page=1&pageSize=50&sort=customer_id_asc`
- `GET /api/telemetry/informs?serial=SERIAL&page=1&pageSize=50&sort=ts_desc`
- `GET /api/telemetry/daily-metrics?page=1&pageSize=50&sort=day_desc`
- `GET /api/tickets?page=1&pageSize=25&sort=opened_at_desc`
- `GET /api/tickets/:ticketId`
- `POST /api/tickets`
- `GET /api/investigations?page=1&pageSize=25&sort=created_at_desc`
- `POST /api/investigations/trigger/groupings` (varredura especializada por candidatos de agrupamento)
- `POST /api/investigations/trigger/metrics` (alias compatível)
- `POST /api/investigations/:investigationId/retry`
- `PATCH /api/investigations/:investigationId/review`
- `GET /api/tickets/noc-queue?page=1&pageSize=100&sort=opened_at_asc` (chamados N1 ativos no Kanban do NOC)
- `PATCH /api/tickets/:ticketId/noc-status` (move um chamado recebido para em andamento)
- `GET /api/incidents?page=1&pageSize=25&sort=severity_desc`, `POST /api/incidents` e `PATCH /api/incidents/:incidentId/status` (agrupamentos criados pelo NOC)
- `PATCH /api/network/incidents/:groupingId/status` (encerramento persistente de agrupamentos detectados)
- `GET /api/incidents/options` (autocomplete de OLT, PON, CTO, cliente/CPE, firmware, equipamento e região)
- `GET /api/operations/dataset-loads?page=1&pageSize=50&sort=started_at_desc`
- `GET /api/operations/grouping-candidates?page=1&pageSize=25&sort=priority_desc`
- `GET /api/operations/active-groupings?page=1&pageSize=25&sort=severity_desc`
- `GET /mcp` (catálogo MCP)
- `/mcp/customers`, `/mcp/inventory`, `/mcp/telemetry`, `/mcp/diagnostics`, `/mcp/tickets`, `/mcp/operations`, `/mcp/application` e `/mcp/openapi` (Streamable HTTP)

Todas as rotas REST de coleção usam `page`, `pageSize` e `sort`. O retorno mantém o mesmo envelope em todos os domínios: `data`, `page`, `pageSize`, `totalItems` e `totalPages`. Resumos e opções auxiliares aparecem em `meta`, sem alterar o contrato principal. O MCP usa o mesmo modelo de paginação e oferece no domínio `application` as jornadas REST que não pertencem aos seis domínios de dados.

Na interface, a aba **Cadastros** oferece uma listagem paginada de clientes e equipamentos, com pesquisa por código, serial, fabricante, modelo, CTO ou localidade e atalho para testar um cliente ativo no N1. A aba **Mapa de entidades** torna visível a relação entre a topologia física (OLT, PON, CTO e CPE), as tabelas de sinais, a visão materializada, as regras e as jornadas NOC/N1. A visão **Hardware e capacidade** detalha a cadeia fabricante/modelo/revisão/firmware/LAN/plano até as ações de rollback ou bloqueio e troca. A visão **Infraestrutura física** inclui um grafo navegável com zoom e arraste: a seleção expande OLT → PON → CTO → CPE/cliente e permite ver as conexões reais de cada ramo. O dataset não fornece IDs individuais de cabo, splitter ou drop; essa limitação fica visível na tela para que o grafo não invente uma rastreabilidade física.

O **Dashboard adaptativo** é editado somente por conversa. O bridge MCP deriva do OpenAPI um catálogo compacto das rotas marcadas com `x-dashboard-resource`; o compositor recebe descrições, parâmetros e schemas, mas não recebe telemetria, clientes, chamados ou incidentes. A IA devolve um plano validado com blocos e bindings permitidos. Depois, o navegador resolve esses bindings diretamente pelas APIs REST. A composição fica persistida por usuário; atualizações periódicas e o botão **Atualizar dados** não chamam o modelo nem consomem tokens. Novas rotas documentadas entram automaticamente no bridge e só ficam disponíveis ao compositor quando forem explicitamente marcadas como recurso do dashboard.

Um **chamado de suporte** registra o contato de um cliente e é aberto pelo N1. Quando o encaminhamento é “Escalar para o NOC”, ele entra no Kanban sem virar automaticamente um agrupamento. O quadro de operação humana tem somente duas colunas — **Chamado recebido** e **Chamado em andamento** — e contém apenas chamados individuais. Um **agrupamento** representa um problema técnico compartilhado e pode explicar muitos chamados. Seja proposto pela IA ou criado pelo NOC, depois da aprovação ele tem exatamente a mesma estrutura, o mesmo card, o mesmo ciclo de vida e a mesma ação de encerramento; a origem é apenas metadado, e o vínculo com um chamado é opcional. Todos ficam juntos na seção **Agrupamentos detectados** e nunca ocupam uma coluna do Kanban. O operador pode criar um agrupamento escolhendo parque, OLT, PON, CTO, cliente/CPE, firmware, equipamento ou região. Esses vínculos usam autocomplete alimentado pelo inventário; PON depende da OLT e CTO depende de OLT e PON. A API valida novamente o valor escolhido e calcula o impacto potencial.

Na seção **Onde agir primeiro**, o detector procura candidatos nos mesmos oito escopos a cada cinco minutos. O agente consulta evidências somente leitura pelo MCP e entrega uma proposta para validação humana. O sinal analítico não aparece como agrupamento ativo: somente a aprovação do NOC faz a API recalcular o alcance no inventário, criar o agrupamento e disponibilizar seu protocolo ao N1. Quando o agrupamento nasce de um chamado escalado, os dois registros ficam vinculados, o chamado é encerrado e desaparece do Kanban. O NOC também pode encerrar diretamente um chamado em andamento ou qualquer agrupamento ativo. O agrupamento encerrado deixa de aparecer ao N1 e não aceita novos vínculos, enquanto os registros permanecem no histórico para auditoria. Não existe uma terceira coluna de finalizados. A allowlist MCP usada pelo agente continua somente leitura; escritas REST e MCP interativas passam pelos mesmos serviços validados.

## Desenvolvimento e validação

Com Node.js 20+:

```bash
npm ci
npm run verify
```

`verify` executa build, testes, verificação de tipos, formatação e auditoria de dependências. Para desenvolvimento com recarga automática, use `npm run dev` com o PostgreSQL já disponível.

O repositório também inclui CI em `.github/workflows/ci.yml`: cada push e pull request repete a verificação e constrói as imagens de produção sem depender do dataset.

## Checklist antes de publicar

```bash
npm ci
npm run verify
docker compose up --build -d
npm run smoke
git status --short
```

- confirme que `ondaluz-pack/`, `enunciado.pdf` e o ZIP original não aparecem no `git status`;
- faça um teste visual nas abas **Visão NOC**, **Atendimento N1** e **Revisão IA**;
- publique o repositório somente depois de revisar os documentos e o diff final;
- não inclua credenciais, `.env`, dados ou artefatos de build.

O motor de decisão fica isolado em `apps/api/src/customers/decision-engine.ts`, com testes das regras e de suas precedências. As regras são intencionalmente explicáveis: nenhuma recomendação depende de um score opaco.

## Documentos da entrega

- [Diagnóstico para a diretoria](docs/diagnostico-diretoria.md)
- [Arquitetura proposta](docs/arquitetura.md)
- [Log de decisões](docs/log-decisoes.md)
- [Consultas de evidência](docs/consultas-evidencias.sql)
- [Servidor MCP e integração com IA](docs/mcp.md)
- [Agente OpenAI e revisão humana](docs/agente-investigacao.md)
- [Matriz de conformidade com o enunciado](docs/conformidade-enunciado.md)
