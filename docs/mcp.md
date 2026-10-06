# Servidor MCP

O MCP está integrado ao mesmo projeto NestJS da API REST e usa o mesmo pool PostgreSQL. Clientes, inventário, telemetria, diagnósticos, chamados e operação permanecem como domínios de consulta. O domínio `application` completa a paridade com as jornadas REST e encaminha mutações para os mesmos serviços e validações do backend. O agente de investigação não recebe essas ferramentas de escrita: sua allowlist continua exclusivamente de leitura.

## Endpoints locais

- catálogo: `GET http://localhost:3000/mcp`;
- clientes: `/mcp/customers`;
- inventário: `/mcp/inventory`;
- telemetria: `/mcp/telemetry`;
- diagnósticos: `/mcp/diagnostics`;
- chamados: `/mcp/tickets`;
- operação: `/mcp/operations`.
- aplicação: `/mcp/application`.
- bridge OpenAPI: `/mcp/openapi`.

Todos usam Streamable HTTP. O proxy web também encaminha `/mcp/*` em `http://localhost:8080`.

## Bridge OpenAPI para o dashboard

O endpoint `/mcp/openapi` é gerado do mesmo documento usado pelo Swagger. Cada `operationId` REST vira uma ferramenta MCP com título, descrição, schema de entrada, anotações de leitura/escrita e metadados do método e caminho HTTP. Parâmetros de path e query e propriedades do corpo JSON são convertidos automaticamente; a chamada da ferramenta é encaminhada para a rota REST correspondente.

O recurso `ondaluz://openapi/dashboard-routes` contém somente operações simultaneamente marcadas com `x-dashboard-resource: true` e `x-read-only: true`. Esse é o catálogo compacto usado para informar à IA quais fontes existem. Ele não carrega dados operacionais: depois de gerar o plano, o navegador continua buscando valores diretamente pelas rotas REST. Assim, adicionar ou alterar uma rota no controller atualiza Swagger, bridge MCP e descoberta do dashboard no mesmo reinício, sem manter uma lista manual paralela.

As ferramentas de coleção usam `page`, `pageSize` e `sort`, com resposta padronizada em `data`, `page`, `pageSize`, `totalItems` e `totalPages`. O domínio `application` completa a paridade com as jornadas REST de dashboard, preferências do dashboard, filtros facetados, topologia, suporte N1, fila NOC, agrupamentos e investigações. As mutações continuam fora da allowlist do agente de investigação: elas podem ser chamadas por um cliente MCP autorizado, mas nunca são descobertas pelo agente que propõe agrupamentos.

## Agrupamentos

O domínio de operação publica `operations_list_grouping_candidates` e `operations_list_active_groupings`. A primeira ferramenta calcula candidatos nos escopos parque, OLT, PON, CTO, cliente, firmware, equipamento e região, com quantidade, percentual afetado e sinal dominante. A segunda retorna os agrupamentos confirmados pelo NOC que ainda estão ativos, incluindo escopo, causa provável, orientação e impacto. O agente usa candidatos como ponto de partida e pode usar agrupamentos ativos para contextualizar o atendimento N1.

As ferramentas dos seis domínios de dados não criam, aprovam, encerram ou alteram agrupamentos. O domínio `application` expõe as mesmas operações validadas da REST para clientes MCP interativos. A aprovação continua exigindo revisor identificado e o backend recalcula o alcance no inventário antes da criação; essas ferramentas não entram na allowlist do agente autônomo.

## Limites do protótipo

Os endpoints não possuem autenticação e devem permanecer restritos ao ambiente local. Produção exige TLS, autenticação, autorização por provedor e papel, paginação, cotas, auditoria e filtragem de dados sensíveis.
