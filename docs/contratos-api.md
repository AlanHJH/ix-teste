# Contratos de integração

Este documento é o guia legível dos contratos da Ondaluz Ops. Ele complementa, e não substitui, o documento OpenAPI gerado pela aplicação e as descrições de input/output publicadas pelos servidores MCP.

O objetivo desta camada é tornar explícitos nome, tipo, obrigatoriedade, nulabilidade, limites, enumerações, formato de data, exemplos e erros conhecidos sem mudar a lógica dos endpoints, os envelopes existentes ou as regras de negócio.

As entradas REST passam por DTOs NestJS com `class-validator` e `class-transformer`. O pipeline global transforma query strings em instâncias dos DTOs, rejeita propriedades desconhecidas (`whitelist` + `forbidNonWhitelisted`) e devolve a lista de falhas no campo `message` do envelope de erro. Corpos, parâmetros de rota, paginação e filtros repetíveis têm classes próprias em `apps/api/src/contracts/`.

As respostas JSON também são verificadas em runtime contra o schema de sucesso publicado no OpenAPI. O validador usa o mesmo documento servido em `/api/openapi.json`, preserva o objeto retornado e interrompe a resposta com erro interno se um service produzir campos, tipos, enums ou obrigatoriedades incompatíveis. Assim, a documentação deixa de ser apenas descritiva: ela funciona como contrato executável entre backend, frontend e bridge MCP.

## Fontes canônicas

Em execução local, as fontes de contrato são:

- Swagger UI: `GET /api/docs`;
- OpenAPI JSON: `GET /api/openapi.json`;
- OpenAPI YAML: `GET /api/openapi.yaml`;
- catálogo REST resumido: `GET /api`;
- catálogo MCP: `GET /mcp`;
- ferramentas MCP por domínio: `/mcp/customers`, `/mcp/inventory`, `/mcp/telemetry`, `/mcp/diagnostics`, `/mcp/tickets`, `/mcp/operations`, `/mcp/application` e `/mcp/openapi`.

O Swagger e o bridge MCP são derivados dos mesmos decorators dos controllers. Portanto, a operação REST, seu `operationId`, parâmetros, corpo, schema de sucesso, erros e metadados de leitura/escrita devem ser atualizados no mesmo local.

## Convenções de tipos

| Representação      | Contrato                                                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Texto              | `string`; a descrição informa finalidade e, quando aplicável, comprimento máximo.                                                       |
| Inteiro            | `integer`; limites e unidade aparecem no schema ou na descrição.                                                                        |
| Decimal            | `number`; percentuais, valores financeiros e medições preservam a unidade descrita.                                                     |
| Booleano           | `boolean`.                                                                                                                              |
| Data               | `string` com `format: date`, em `YYYY-MM-DD`.                                                                                           |
| Data/hora          | `string` com `format: date-time`, ISO 8601, normalmente UTC.                                                                            |
| Ausência conhecida | Campo presente com `nullable: true`; isso é diferente de campo opcional.                                                                |
| Enumeração         | `enum` lista os valores aceitos ou retornados.                                                                                          |
| Coleção            | `array`, com schema explícito dos itens.                                                                                                |
| Objeto dinâmico    | Permitido somente quando o próprio contrato explica a extensão, como argumentos MCP, configuração não secreta ou catálogo de operações. |

## DTOs e validação em runtime

Os DTOs de entrada documentam e validam:

- corpos de dashboard, tickets, incidentes, investigações e atendimento N1;
- parâmetros de rota como `customerId`, `ticketId`, `serial` e identificadores de investigação;
- consultas paginadas, filtros facetados, escopos topológicos, estados e ordenações.

Os serviços continuam responsáveis pelas regras de negócio e pelas allowlists específicas de cada operação. O DTO garante forma, tipo, presença, tamanho e enum; o service continua decidindo, por exemplo, se uma ordenação pertence àquela consulta e se o escopo possui CPEs ativas.

Para as saídas, o controller publica o schema completo em `ApiRead`/`ApiWrite`; o interceptor `OpenApiResponseValidationInterceptor` executa esse schema depois do service. Os nomes existentes, inclusive snake_case dos read models e o envelope de paginação, foram preservados.

Campos marcados em `required` sempre fazem parte da resposta ou da requisição documentada. Um campo nullable continua obrigatório quando aparece em `required`: seu valor pode ser `null`, mas o nome do campo não deve desaparecer.

## Paginação

Coleções REST e ferramentas MCP paginadas usam o mesmo contrato:

```json
{
  "data": [],
  "page": 1,
  "pageSize": 25,
  "totalItems": 0,
  "totalPages": 0
}
```

| Campo        | Tipo                      | Regra                                                                   |
| ------------ | ------------------------- | ----------------------------------------------------------------------- |
| `data`       | `array`                   | Registros da página atual, já filtrados e ordenados.                    |
| `page`       | `integer`                 | Página iniciando em `1`; mínimo `1`.                                    |
| `pageSize`   | `integer`                 | Mínimo `1`; o máximo específico aparece no OpenAPI e no `x-pagination`. |
| `totalItems` | `integer`                 | Total antes da paginação.                                               |
| `totalPages` | `integer`                 | Total calculado; pode ser `0` quando não há registros.                  |
| `meta`       | `object`, quando presente | Resumo, filtros ou contexto auxiliar; não altera o envelope principal.  |

Os parâmetros de entrada são `page`, `pageSize` e `sort`. Cada operação enumera os valores permitidos de `sort`, informa o padrão e registra limites no extension `x-pagination`.

## Erros HTTP

As respostas HTTP JSON seguem o envelope NestJS documentado por `apiErrorSchema`:

```json
{
  "statusCode": 400,
  "message": "Parâmetro sort inválido.",
  "error": "Bad Request"
}
```

| Campo        | Tipo                             | Significado                                                                 |
| ------------ | -------------------------------- | --------------------------------------------------------------------------- |
| `statusCode` | `integer`                        | Status HTTP efetivamente retornado.                                         |
| `message`    | `string`, `string[]` ou `object` | Mensagem operacional, lista de falhas de validação ou contexto estruturado. |
| `error`      | `string`                         | Categoria HTTP, como `Bad Request`, `Not Found` ou `Service Unavailable`.   |

Casos documentados:

- `400 Bad Request`: filtro, paginação, enum, corpo ou dependência de entrada inválida. Quando a causa é específica, o decorator do endpoint descreve a regra e fornece exemplo.
- `404 Not Found`: cliente, CPE, chamado, incidente, agrupamento ou investigação inexistente ou já encerrado.
- `503 Service Unavailable`: a API está viva, mas o dataset ainda não terminou de carregar. O campo `message` pode conter `{ "status": "loading", "dataset": null }` ou o estado disponível da carga.
- `500 Internal Server Error`: falha inesperada. Todos os contratos base de leitura e escrita documentam o mesmo envelope para esse caso.

O contrato de erro descreve a resposta pública; não expõe stack trace, segredo, SQL ou credencial. Mensagens reais podem ser mais específicas, mas preservam os três campos e o status HTTP.

## REST: grupos e contratos

Todas as rotas abaixo têm parâmetros, sucesso e erros detalhados no OpenAPI. A tabela serve como mapa de descoberta.

| Domínio       | Operações                                                                                                                                                                                             |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sistema       | `GET /health`, `GET /api`                                                                                                                                                                             |
| Clientes/N1   | `GET /api/customers`, `/filter-options`, `/search`, `/:customerId`, `/:customerId/support`; `POST /:customerId/n1-chat`                                                                               |
| Rede          | `GET /api/network/overview`, `/topology/path`, `/topology/devices`, `/topology`, `/incidents`, `/incidents/:id`; `PATCH /incidents/:id/status`                                                        |
| Inventário    | `GET /api/inventory`, `/topology`, `/:serial`                                                                                                                                                         |
| Telemetria    | `GET /api/telemetry/informs`, `/daily-metrics`                                                                                                                                                        |
| Diagnósticos  | `GET /api/diagnostics`, `/filter-options`                                                                                                                                                             |
| Chamados      | `GET /api/tickets`, `/filter-options`, `/noc-queue`, `/:ticketId`; `POST /api/tickets`; `PATCH /api/tickets/:ticketId/noc-status`                                                                     |
| Incidentes    | `GET /api/incidents`, `/options`; `POST /api/incidents`; `PATCH /api/incidents/:incidentId/status`                                                                                                    |
| Operação      | `GET /api/operations/dataset-loads`, `/grouping-candidates`, `/active-groupings`                                                                                                                      |
| Investigações | `GET /api/investigations`, `/config`; `POST /api/investigations/trigger/metrics`, `/trigger/groupings`, `/trigger/scheduled`, `/trigger/manual`, `/:id/retry`; `PATCH /api/investigations/:id/review` |
| Dashboard     | `POST /api/dashboard/compose`; `GET` e `PUT /api/dashboard/preferences/:userId`                                                                                                                       |

Os objetos de negócio seguem a mesma regra: campos retornados estão listados em `properties`, campos sempre presentes em `required`, campos sem valor em `nullable`, e datas usam `date` ou `date-time`. Objetos compostos importantes — perfil de suporte, incidente operacional, investigação, topologia e composição do dashboard — não são mais publicados como objetos sem propriedades.

## MCP

Os servidores MCP usam Streamable HTTP. Cada ferramenta publica nome, descrição, schema de entrada e anotações de segurança. O resultado bem-sucedido contém dados estruturados e uma representação textual JSON para clientes que não consomem `structuredContent`; o conteúdo de negócio segue os mesmos nomes, tipos e envelopes da REST quando a ferramenta representa uma operação REST.

O bridge `/mcp/openapi` transforma cada `operationId` documentado em ferramenta. As ferramentas recebem parâmetros de path/query e propriedades do corpo conforme o OpenAPI e encaminham a chamada para a rota correspondente. `x-read-only: true` marca consultas; `x-read-only: false` marca mutações. O recurso `ondaluz://openapi/dashboard-routes` inclui somente operações simultaneamente read-only e `x-dashboard-resource: true`.

### Ferramentas por domínio

- `customers`: `customers_search`, `customers_get`.
- `inventory`: `inventory_search_devices`, `inventory_get_device`, `inventory_topology`.
- `telemetry`: `telemetry_list_informs`, `telemetry_list_daily_metrics`.
- `diagnostics`: `diagnostics_list`.
- `tickets`: `tickets_list`, `tickets_get`.
- `operations`: `operations_list_dataset_loads`, `operations_list_grouping_candidates`, `operations_list_active_groupings`.
- `application`: saúde, dashboard, topologia, suporte N1, fila NOC, incidentes, agrupamentos detectados e investigações, incluindo as mutações interativas validadas.
- `openapi`: uma ferramenta por `operationId` REST, com o mesmo contrato do OpenAPI.

Recursos MCP publicados incluem `ondaluz://<domain>/about`, recursos de cliente, dispositivo, chamado, suporte, agrupamento, documento OpenAPI e rotas do dashboard. Recursos são leitura; escritas continuam sendo ferramentas explicitamente identificadas.

Falhas de validação de input no MCP são reportadas pelo protocolo MCP como resultado de ferramenta com erro. No bridge OpenAPI, a execução preserva o status e o envelope HTTP da rota REST; nos servidores de domínio, a mensagem textual/estruturada mantém a causa validada pelo mesmo backend. Em nenhum dos dois casos o cliente deve interpretar uma mensagem de erro como dado de negócio.

## Regras de evolução

1. Alterações de nome, tipo, nulabilidade, enum, limite ou formato são mudanças de contrato e devem ser refletidas no controller, no OpenAPI, no MCP e nos testes.
2. Não remover ou renomear `operationId` sem migrar consumidores REST, bridge MCP e recursos do dashboard.
3. Manter `data`, `page`, `pageSize`, `totalItems` e `totalPages` nas coleções; adicionar contexto em `meta` quando necessário.
4. Erros novos devem declarar status, causa, envelope e exemplo no Swagger.
5. Preferir schemas fechados para objetos de negócio; usar objetos dinâmicos apenas com justificativa documentada.
6. Esta documentação não autoriza mudança funcional: qualquer alteração de regra, validação runtime, autenticação ou persistência deve ser tratada como mudança separada.
