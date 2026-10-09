## Decisões que eu tomaria

| Ordem | Decisão                                                                                     | Por que eu faria isso                                                                                                                               | Critério para avançar ou encerrar                                                                                 |
| ----- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 1     | Abriria um único incidente para OLT-2/PON 1/7 e 1/8 e acionaria rede externa na CE-JA-03.   | O alcance compartilhado, o FEC e os chamados crescem juntos; visitas residenciais não tratam uma causa comum.                                       | FEC volta ao baseline e chamados/quedas do grupo recuam após a correção do trecho.                                |
| 2     | Congelaria o rollout Kestrel 2.4.1 e faria rollback canário para 2.3.8.                     | A degradação surge depois do rollout e é específica da versão, mas correlação temporal ainda precisa de confirmação controlada.                     | O grupo canário melhora memória e boots por 72 horas sem regressão funcional; só então amplio o rollback.         |
| 3     | Bloquearia novos Turbo 500 em Norvik NV-G1 revisão A e priorizaria a troca dos reclamantes. | A porta a 100 Mbps torna impossível entregar 500 Mbps; é uma incompatibilidade objetiva, não uma hipótese de Wi-Fi.                                 | Regra comercial ativa, lista de 377 afetados tratada por risco e ausência de novos upgrades incompatíveis.        |
| 4     | Rejeitaria a troca geral dos Tuim e o reboot diário do parque.                              | As taxas por fabricante são próximas e as duas propostas atacam sintomas ou correlações aparentes, com alto custo e risco operacional.              | Só reabro a hipótese de fabricante se uma taxa normalizada por base, região e versão mostrar diferença relevante. |
| 5     | Manteria ações remotas e ordens de serviço sob confirmação humana.                          | O protótipo produz recomendação explicável e agora tem JWT simples para os operadores, mas ainda não possui 2FA nem trilha operacional de produção. | Automação apenas depois de RBAC, auditoria, canário, rollback seguro e limites por provedor.                      |

Essas decisões não tratam correlação como prova absoluta. Fibra é confirmada por inspeção; firmware, por canário; e a incompatibilidade de capacidade, por inventário e negociação LAN. Enquanto a confirmação ocorre, a solução já reduz desperdício ao agrupar o alcance e orientar o próximo passo correto.

## Hipóteses testadas

| Hipótese                                                    | Resultado                       | Evidência/decisão                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Tuim é equipamento ruim e explica o aumento”               | **Descartada como causa geral** | Chamados por mil clientes ativos ficaram próximos entre fabricantes. A concentração visível de Tuim no Jardim Aurora confundia fabricante com geografia.      |
| O crescimento da campanha Turbo 500 não tem relação técnica | **Parcialmente refutada**       | A campanha em si não degrada a rede, mas expôs 377 Norvik revisão A com porta a 100 Mbps a um plano de 500 Mbps.                                              |
| Kestrel 2.4.1 melhorou memória, como dizem as release notes | **Refutada nos dados de campo** | Após o rollout surgem memória livre abaixo de 10% e muitos boots, ausentes em 2.3.8. Release note e homologação de 48h não substituem telemetria de produção. |
| OLTs “verdes” descartam falha de rede                       | **Refutada**                    | Ping de OLT não observa degradação óptica/FEC em PONs específicas. OLT-2 permaneceu acessível enquanto 1/7 e 1/8 pioraram.                                    |
| Speed test aprovado prova que é Wi-Fi                       | **Descartada**                  | TR-143 mede a CPE contra o servidor; não cobre necessariamente a porta/cabo/dispositivo do cliente e mascara o Norvik A a 100 Mbps.                           |
| Reinício resolve a causa                                    | **Descartada**                  | No firmware, reinício alivia memória temporariamente; não corrige regressão. Também não corrige FEC compartilhado ou limite físico da LAN.                    |
| Todo Rx ruim deve virar visita individual                   | **Refinada**                    | Rx persistente abaixo de -27 dBm fora de cluster indica visita; dentro de uma PON degradada deve ser agregado e tratado na rede.                              |

## Ambiguidades e decisões tomadas

- **Unidades ópticas:** a wiki é incompleta e os valores brutos têm escalas incompatíveis. Pela faixa física e distribuição, normalizei Kestrel dividindo por 1.000, mantive Tuim em dBm e converti Norvik de mW para dBm com `10*log10(valor)`. A regra está isolada no SQL e deve virar contrato versionado por fabricante.
- **Fuso horário:** Informs/diagnósticos estão em UTC e chamados em Brasília. Agregações de operação usam `America/Sao_Paulo` antes de gerar o dia.
- **CPE trocada no período:** o inventário mantém removidos. Consultas operacionais consideram equipamentos ativos; análises históricas devem respeitar `installed_at` e `removed_at`.
- **Troca de firmware no mesmo dia:** `(dia, serial)` não era único na carga real. Preservei as duas versões e defini o grão `(dia, serial, firmware)` para não apagar a transição.
- **Categoria do chamado:** como o enunciado informa que o atendente escolhe rapidamente, usei o conjunto Lentidão/Sem conexão/Wi-Fi para tendência e o texto/resolução apenas como evidência de apoio, nunca como verdade causal isolada.
- **Problema ativo:** no snapshot, significa anomalia observada na janela final de 7 dias. Para óptica isolada, exigi Rx abaixo de -27 dBm em pelo menos 2 dos 3 dias finais, evitando abrir visita por um pico único. A data final exibida é 30/08, sem tratar as poucas horas de 31/08 UTC como dia completo.
- **Custos:** somei os valores unitários fornecidos. Custos de correção (por exemplo, troca de equipamento) aparecem como exposição, separados do custo recente de tratamento. Não estimei receita perdida sem dados suficientes.
- **CPEs afetadas:** o KPI conta seriais únicos na união dos incidentes. Um cliente que aparece simultaneamente em firmware e rede não é contado duas vezes; os cartões preservam o alcance de cada causa.
- **Ação humana:** o protótipo recomenda e explica; não executa RPC, rollback ou ordem de serviço.

## Decisões de produto e engenharia

- Separei duas jornadas em vez de um dashboard único: NOC prioriza grupos; N1 procura um cliente e recebe roteiro.
- Ordenei incidentes por benefício operacional, não pelo número bruto de alarmes.
- Mantive as regras determinísticas e testáveis. O dataset não tem rótulo causal confiável para treinar ML.
- Usei NestJS e Vite/React em monorepo; PostgreSQL centraliza joins e torna as consultas auditáveis.
- A carga usa streaming e é idempotente. O Compose condiciona API e web ao sucesso da etapa anterior.
- Integrei os seis domínios MCP de dados, somente leitura, ao mesmo processo NestJS da API REST, usando uma rota Streamable HTTP por contexto de domínio e camadas `domain`, `application`, `infrastructure` e `presentation`. REST e MCP compartilham porta, ciclo de vida e pool PostgreSQL. Mantive paginação obrigatória e exigi serial para Informs brutos, evitando respostas acidentais com milhões de eventos.
- Acrescentei o domínio MCP `application` para dar paridade às jornadas REST. Ele encaminha consultas e mutações aos mesmos serviços validados, mas suas ferramentas de escrita ficam fora da allowlist do agente de investigação; assim, um cliente MCP interativo tem paridade sem permitir que o agente aprove ou encerre operações sozinho.
- Mantive resumo, descrição, parâmetros, exemplos, respostas, erros e extensões OpenAPI no próprio controller de cada rota. A configuração global do Swagger só define identidade, tags e URLs; o catálogo REST e a descoberta do dashboard são derivados do documento gerado, sem uma lista descritiva paralela.
- Acrescentei um bridge MCP derivado do OpenAPI em `/mcp/openapi`. Cada `operationId` documentado vira automaticamente uma ferramenta, enquanto o gerador do dashboard enxerga somente o subconjunto seguro marcado com `x-dashboard-resource` e `x-read-only`; os valores continuam chegando ao navegador por REST, sem entrar no contexto do modelo.
- Consolidei a implementação MCP em `apps/api/src/mcp`, eliminando um workspace e uma etapa de build que não representavam um serviço independente. Os contratos REST e MCP continuam separados, mas agora pertencem ao mesmo projeto implantável, de acordo com o processo único já usado em execução.
- Mantive o MCP sem autenticação, restrito ao ambiente local, e acrescentei JWT às rotas REST e à interface. O backend unificado não deve ser exposto publicamente; produção exige autenticação forte, autorização por provedor/perfil, TLS, limites e auditoria.
- Especializei o agente para propor agrupamentos nos mesmos escopos disponíveis ao operador: parque, OLT, PON, CTO, cliente, firmware, equipamento e região. Um pré-filtro determinístico reduz o espaço de busca, o agente confirma ou descarta pelo MCP somente leitura e o NOC precisa aprovar antes da criação pela API REST.
- Mantive a aprovação humana como padrão, mas acrescentei um modo opt-in (`AGENT_AUTO_APPROVE_GROUPINGS`) para o backend autoativar apenas candidatos de métricas acima de um limiar explícito (`AGENT_AUTO_APPROVE_MIN_CONFIDENCE`). O modelo continua sem ferramentas de escrita, o escopo é recalculado no inventário e o registro identifica `agente-automatico`.
- Não deixei o modelo definir sozinho a lista final de CPEs afetadas. Na aprovação, a API normaliza o escopo proposto e recalcula o alcance usando o inventário atual; isso evita que um identificador inventado ou uma contagem estimada pelo agente vire estado operacional.
- Removi sinais analíticos brutos da lista de agrupamentos ativos. Eles permanecem como candidatos até a investigação e a aprovação humana, evitando que o N1 trate uma correlação ainda não confirmada como incidente conhecido.
- Separei o dashboard em plano e dados. Usei o MCP somente para descobrir o catálogo de recursos e pedi ao modelo apenas a composição com bindings permitidos; os valores reais chegam depois por REST. Assim, atualizar alertas e indicadores não reenviará o dataset ao modelo nem consumirá tokens. O layout diário fica no navegador por usuário, e uma nova chamada OpenAI acontece somente quando a pessoa pede outra composição.
- O pacote fornecido está ignorado no Git; o README descreve onde colocá-lo.

## Conferência de aderência ao desafio - 06/10/2026

Revisei o enunciado, a implementação e as jornadas executáveis antes de
considerar esta versão pronta para avaliação. O foco foi utilidade para os dois
perfis solicitados, e não acabamento visual isolado.

| Pedido do desafio                                                                                         | Decisão e estado verificável                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diagnóstico curto para a diretoria, com causa, custo, prioridade e resposta às propostas dos stakeholders | Mantive o diagnóstico em [`diagnostico-diretoria.md`](diagnostico-diretoria.md), com três causas separadas, custo direto, nível de confiança e propostas explicitamente aceitas ou recusadas. O PDF correspondente continua limitado a três páginas.                  |
| Arquitetura para detectar continuamente problemas em 300 mil CPEs                                         | Mantive o fluxo Inform -> ingestão -> agregados -> candidato -> validação humana -> agrupamento ativo em [`arquitetura.md`](arquitetura.md). O protótipo usa PostgreSQL e, para produção, separa armazenamento bruto/analítico do estado operacional.                 |
| Operador NOC vê onde agir antes de o suporte escalar                                                      | A Visão NOC agora concentra agrupamentos ativos e propostas da busca ativa. O detector usa somente o banco já carregado, consulta MCP de leitura e exige aprovação humana antes de criar estado operacional. Chamados individuais continuam na fila única de Tickets. |
| Atendente N1 atende em poucos minutos sem conhecimento técnico profundo                                   | A jornada N1 parte do cliente, explica a causa provável e as evidências em linguagem de atendimento e decide entre orientar, escalar para o NOC ou agendar visita. Agrupamentos aprovados aparecem como contexto, sem transformar hipótese em certeza.                |
| Hipóteses descartadas, ambiguidades e uso de IA registrados                                               | As seções anteriores preservam as hipóteses refutadas, decisões de normalização e limites da IA. O modelo não escreve incidentes, não define a lista final de CPEs e não executa ações de rede.                                                                       |
| Node.js/TypeScript, React/TypeScript, banco justificado e execução por Docker                             | A API é NestJS/TypeScript, a interface é React/TypeScript e o PostgreSQL está justificado na arquitetura. `docker compose up --build` sobe banco, carga, API e web.                                                                                                   |
| Entrega pública, sem dataset, com documentação e instruções de execução                                   | O remoto `AlanHJH/ix-teste` está público em GitHub; `.env`, pacote de dados e `enunciado.pdf` são ignorados. README aponta o local do pacote e os documentos obrigatórios permanecem em `docs/`.                                                                      |

### Evidência da última validação

- `npm run smoke` confirmou API saudável, **8.186 CPEs**, **4 agrupamentos** e **4 jornadas N1**.
- A busca ativa de agrupamentos foi disparada contra o banco carregado: encontrou seis candidatos, reconheceu um já coberto por agrupamento ativo e reaproveitou cinco investigações existentes, sem duplicá-las.
- O agente estava configurado, com gatilho métrico a cada cinco minutos e somente ferramentas MCP de leitura. Foram confirmadas propostas pendentes, uma aprovação e uma conclusão inconclusiva; todas preservam trilha de consultas para auditoria.
- A revisão humana permanece obrigatória: só a aprovação recalcula o alcance pelo inventário e cria o agrupamento ativo. Encerrar o agrupamento preserva o histórico e remove seu contexto operacional do N1.

O escopo deliberadamente não inclui autenticação de produção (o JWT atual é uma
credencial fixa de demonstração), execução remota de
ações, rollback automático, abertura de ordens de serviço ou previsão causal
sem confirmação de campo. Essas ausências são escolhas explícitas de segurança
e não impedem a demonstração das jornadas pedidas no desafio.

## Uso de IA

- Na fase inicial, foi usado Codex GPT-5.6 Sol para inventariar os arquivos e procurar indicadores de malware/exploit antes de abrir o pacote, motivado por riscos observados em processos seletivos.
- Nesta implementação, Codex foi usado como ferramenta de apoio para explorar os dados, formular e refutar hipóteses, estruturar SQL, gerar o esqueleto NestJS/React, revisar tipos, escrever testes, documentação e realizar QA no navegador.
- As conclusões não foram aceitas apenas por sugestão da IA: foram verificadas com consultas reproduzíveis sobre os arquivos fornecidos, execução real da carga de 5.496.315 Informs, testes automatizados e inspeção das respostas da API e das duas telas.
- A decisão final sobre regras, prioridades, limites, custos e o que ficou fora do escopo permaneceu humana e está registrada neste arquivo.
