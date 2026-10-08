# Experimento de organização DDD

Este documento registra a primeira etapa de uma organização baseada em Domain-Driven Design, usando os conceitos de Eric Evans de forma pragmática: bounded contexts, linguagem ubíqua, separação entre entrada, aplicação e infraestrutura e dependências explícitas.

## Objetivo e limite do experimento

O objetivo desta etapa é testar se os limites de domínio melhoram a manutenção do backend NestJS sem alterar a funcionalidade observável. Por isso, não foram alterados:

- rotas REST ou MCP;
- nomes de parâmetros e envelopes de resposta;
- regras de negócio, queries ou persistência;
- comportamento do frontend;
- contratos OpenAPI/Swagger e MCP.

Os contextos de **Atendimento/Tickets**, **Diagnósticos**, **Incidentes** e **Dashboard** possuem separação tática entre domínio/aplicação e persistência. Customers, Network e Investigations também não dependem mais diretamente de `DatabaseService`: usam a porta `SQL_EXECUTOR`, fornecida pela infraestrutura. Os demais contextos foram encapsulados em módulos NestJS com a mesma direção de dependência, preparando a expansão posterior.

## Bounded contexts atuais

| Contexto               | Responsabilidade                                                 | Entrada pública atual  |
| ---------------------- | ---------------------------------------------------------------- | ---------------------- |
| Sistema                | healthcheck, catálogo e descoberta                               | `SystemModule`         |
| Clientes/N1            | cadastro consolidado, diagnóstico de atendimento e orientação N1 | `CustomersModule`      |
| Atendimento            | chamados, desfechos e fila NOC                                   | `TicketsModule`        |
| Rede                   | visão executiva, topologia e agrupamentos detectados             | `NetworkModule`        |
| Inventário             | CPEs, hardware, firmware e topologia lógica                      | `InventoryModule`      |
| Telemetria             | Informs e métricas diárias                                       | `TelemetryModule`      |
| Diagnósticos           | testes TR-143 e filtros facetados                                | `DiagnosticsModule`    |
| Incidentes             | agrupamentos operacionais criados/aprovados pelo NOC             | `IncidentsModule`      |
| Operação da plataforma | cargas e candidatos analíticos                                   | `OperationsModule`     |
| Investigações          | ciclo de investigação, agente e revisão humana                   | `InvestigationsModule` |
| Dashboard              | composição e preferências do painel                              | `DashboardModule`      |
| Integração             | transporte MCP e bridge OpenAPI                                  | `McpModule`            |

Esses nomes são limites de negócio, não apenas pastas técnicas. Uma regra de um contexto não deve ser importada diretamente por outro; a colaboração deve acontecer por um caso de uso ou contrato público exportado pelo módulo.

## Composição NestJS

`AppModule` agora funciona como composição da aplicação. Ele não registra controllers e services de negócio diretamente. Cada contexto declara:

- seus controllers, que são adaptadores de entrada;
- seus providers de aplicação;
- as dependências de infraestrutura que importa;
- somente os services que outros contextos precisam consumir em `exports`.

`InfrastructureModule` fornece `DatabaseService`, `TypeOrmDataSourceService`, `OpenApiCatalogService` e a porta `SQL_EXECUTOR`. Ele é compartilhado explicitamente pelos contextos; não é global. Isso mantém a dependência visível no `imports` de cada módulo, sem fazer a camada de aplicação conhecer o pool PostgreSQL. O Dashboard usa TypeORM com `synchronize: false`; consultas analíticas, carga `COPY` e SQL com CTEs continuam em adapters SQL explícitos.

O `McpModule` é um adaptador de integração. Ele importa os casos de uso exportados pelos contextos e monta o gateway. O gateway não deve ser tratado como domínio: ele traduz transporte MCP para casos de uso REST/aplicação, preservando a mesma validação.

```text
AppModule
├── InfrastructureModule
├── SystemModule
├── CustomersModule
├── TicketsModule              ← fatia-piloto
├── NetworkModule
├── InventoryModule
├── TelemetryModule
├── DiagnosticsModule
├── IncidentsModule
├── OperationsModule
├── InvestigationsModule
├── DashboardModule
└── McpModule                  ← adaptador de integração
```

## Direção de dependências

```text
presentation/controller → application/use case → domain
                                     ↓
                              infrastructure adapter

REST/MCP → módulos de contexto → InfrastructureModule
```

Nos contextos com separação tática, os arquivos `domain/` concentram tipos e regras; `application/*-repository.ts` define portas; o service coordena o caso de uso; e `infrastructure/postgres-*.repository.ts` contém o SQL. Nos contextos Customers, Network e Investigations, a mesma direção começa pela porta compartilhada `SQL_EXECUTOR`; o próximo passo é quebrá-la em repositórios de caso de uso mais específicos.

## O que avaliar antes de expandir

1. `npm run verify` deve continuar verde.
2. As rotas REST, Swagger, MCP e o frontend devem carregar sem alterações visíveis.
3. Um contexto deve poder ser testado com seus providers sem importar o `AppModule` inteiro.
4. Um contexto não deve precisar conhecer SQL, controller ou detalhes internos de outro contexto.
5. Os controllers devem receber casos de uso/queries por injeção, sem instanciar repositórios.
6. Os exports de cada módulo devem permanecer pequenos e intencionais.

Com os critérios atendidos para Tickets, a migração tática recomendada é:

1. `IncidentsModule`: regras de escopo e ciclo de vida de agrupamentos.
2. `CustomersModule`: perfil de suporte como read model e políticas de decisão N1.
3. `InvestigationsModule`: casos de uso de investigação e revisão humana, mantendo o agente como adaptador externo.
4. Contextos de consulta MCP: alinhar seus read models com os contratos públicos, sem misturar o modelo de escrita.

O frontend não precisou ser alterado nesta etapa porque continua consumindo os mesmos contratos HTTP. A separação de domínio deve aparecer primeiro no backend; uma reorganização do frontend só será necessária se as telas passarem a refletir bounded contexts ou casos de uso diferentes.
