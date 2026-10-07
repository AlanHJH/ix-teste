# Matriz de conformidade com o enunciado

Esta matriz liga cada demanda do `enunciado.pdf` a uma evidência verificável no repositório. “Atendido localmente” significa que o artefato e a validação existem neste checkout; a publicação do repositório é uma etapa externa separada.

| Demanda                                                | Estado              | Evidência                                                                                                                                    |
| ------------------------------------------------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnóstico curto e não técnico                        | Atendido localmente | [`diagnostico-diretoria.md`](diagnostico-diretoria.md) e PDF executivo de 3 páginas gerado a partir das mesmas conclusões                    |
| Causas, custo, prioridade e propostas dos stakeholders | Atendido localmente | Seções do diagnóstico e consultas em [`consultas-evidencias.sql`](consultas-evidencias.sql)                                                  |
| Evidência e confiança por causa                        | Atendido localmente | Tabela e detalhes do diagnóstico; cards NOC exibem evidência e confiança                                                                     |
| Arquitetura para 300 mil CPEs                          | Atendido localmente | [`arquitetura.md`](arquitetura.md)                                                                                                           |
| Fluxo do Inform ao alerta                              | Atendido localmente | Seção “Fluxo do Inform até o alerta” e diagrama de produção                                                                                  |
| Decisões, alternativas descartadas e fora do escopo    | Atendido localmente | Tabela de decisões e seção de escopo em [`arquitetura.md`](arquitetura.md)                                                                   |
| Banco justificado                                      | Atendido localmente | PostgreSQL justificado na arquitetura                                                                                                        |
| Protótipo funcional para NOC                           | Atendido localmente | `apps/web/src/NocOperations.tsx`, `/api/investigations` e `/api/incidents`; propostas exigem revisão humana antes de virar agrupamento ativo |
| Problemas agrupados por cliente, grupo ou rede         | Atendido localmente | `apps/api/src/network/network.service.ts` e criação de agrupamentos por escopo                                                               |
| Protótipo funcional para N1                            | Atendido localmente | `apps/web/src/App.tsx` e `/api/customers/:customerId/support`                                                                                |
| Causa provável, fala e ação em até 6 minutos           | Atendido localmente | Motor em `apps/api/src/customers/decision-engine.ts` e tela Atendimento N1                                                                   |
| Hipóteses testadas e descartadas                       | Atendido localmente | [`log-decisoes.md`](log-decisoes.md)                                                                                                         |
| Ambiguidades e decisões                                | Atendido localmente | [`log-decisoes.md`](log-decisoes.md)                                                                                                         |
| Declaração de uso de IA                                | Atendido localmente | Seção “Uso de IA” em [`log-decisoes.md`](log-decisoes.md)                                                                                    |
| Backend Node.js + TypeScript                           | Atendido localmente | NestJS/TypeScript em `apps/api`                                                                                                              |
| Frontend React + TypeScript                            | Atendido localmente | React/TypeScript em `apps/web`                                                                                                               |
| Docker Compose sobe banco, carga, API e web            | Atendido localmente | `docker-compose.yml`; dependências condicionadas por healthcheck e conclusão da carga                                                        |
| README explica onde colocar dados e como executar      | Atendido localmente | [`../README.md`](../README.md)                                                                                                               |
| Dataset não publicado                                  | Atendido localmente | `ondaluz-pack/`, CSVs, GZIP, ZIP, `.env` e enunciado ignorados pelo Git                                                                      |
| Documentos obrigatórios em `docs/`                     | Atendido localmente | Diagnóstico, arquitetura e log estão neste diretório                                                                                         |
| Repositório Git público                                | Atendido            | Remoto público [`AlanHJH/ix-teste`](https://github.com/AlanHJH/ix-teste), branch padrão `main`, conferido em 06/10/2026                      |

## Validação antes da entrega

```bash
npm ci
npm run verify
docker compose up --build -d
npm run smoke
git status --short
```

Além dos comandos, faça uma inspeção visual das jornadas **Visão NOC** (incluindo a fila de aprovação), **Atendimento N1** e **Tickets**. Confirme que nenhum dado, `.env`, PDF do enunciado ou artefato local aparece na lista de arquivos que será publicada.
