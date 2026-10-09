# Agente de agrupamentos e revisão humana

O agente é uma camada opcional sobre os detectores determinísticos. Sua função no NOC é confirmar ou descartar possíveis problemas compartilhados e propor o menor agrupamento que explique os clientes afetados. Ele recebe um candidato já delimitado, consulta uma allowlist somente leitura distribuída pelos seis domínios de dados e pelo domínio MCP `application`, e devolve uma proposta estruturada. As ferramentas de escrita de `application` ficam fora dessa allowlist. A ingestão, os agregados, as regras e as telas continuam funcionando sem chave OpenAI.

## Fluxo

1. A cada cinco minutos, ou quando o operador usa **Buscar agora**, o pré-filtro calcula candidatos com dados dos últimos sete dias.
2. O detector considera parque, OLT, PON, CTO, cliente, firmware, equipamento e região. Limites mínimos de quantidade e percentual evitam enviar cada variação individual ao modelo.
3. O orquestrador elimina candidatos já cobertos por agrupamento ativo, deduplica investigações e limita concorrência, ferramentas, contexto e tamanho das respostas.
4. O agente começa por `operations_list_grouping_candidates` e confirma a hipótese nos domínios MCP de inventário, telemetria, diagnósticos, chamados, clientes e operação.
5. A conclusão contém categoria, severidade, alcance, confiança, causa provável, evidências favoráveis e contrárias, um roteiro simples para o N1 e a próxima atuação técnica do NOC. O N1 não recebe tarefas de inspeção de métricas ou diagnóstico avançado.
6. O backend valida o schema e as fontes. Por padrão, a proposta fica em **Aguardando humano** na própria seção **Onde agir primeiro**.
7. Ao aprovar, o backend consulta novamente o inventário, normaliza o escopo e recalcula a quantidade de CPEs. Só então cria o agrupamento ativo. Ao rejeitar, mantém o resultado apenas como histórico auditável.
8. Se `AGENT_AUTO_APPROVE_GROUPINGS=true`, somente investigações disparadas por métricas com `confidence` igual ou superior a `AGENT_AUTO_APPROVE_MIN_CONFIDENCE` (padrão `0.9`) passam pela mesma validação de inventário e são criadas automaticamente. Investigações agendadas ou manuais nunca usam esse atalho; o registro identifica `agente-automatico` para auditoria.
9. O N1 passa a ver o agrupamento quando consulta um cliente que pertence ao alcance aprovado.

## Copiloto conversacional do N1

Ao abrir um cliente na tela **Atendimento N1**, o atendente recebe o provável problema calculado a partir do equipamento, dos sinais, dos chamados recentes e dos agrupamentos ativos do NOC. O bloco **Conduza a ligação com a IA** aceita o relato do cliente em cada rodada, sugere uma pergunta ou verificação segura, oferece opções de encaminhamento e atualiza a documentação sugerida para o chamado.

O endpoint `POST /api/customers/:customerId/n1-chat` usa o contexto do cliente e, quando `OPENAI_API_KEY` está disponível, uma resposta estruturada da OpenAI. Se o modelo estiver indisponível, há uma orientação determinística de contingência. Em ambos os casos, a IA não executa ações nem substitui a decisão do atendente.

## Agente IA: agente transversal da aplicação

O **Agente IA** aparece como um launcher global no canto inferior direito das páginas operacionais, disponível para todos os perfis autenticados. O painel recebe o contexto da página e, quando disponível, o cliente, chamado ou problema selecionado. Termos técnicos destacados também podem ser clicados para abrir uma explicação contextual automática. A pergunta é enviada ao backend por `POST /api/assistant/chat`; o backend consulta o catálogo MCP somente leitura e devolve a resposta com resumo, evidências e ferramentas consultadas.

O Agente IA pode cruzar clientes, inventário, telemetria, diagnósticos, chamados, operação e as jornadas da aplicação. O histórico curto e o contexto da interface são metadados, não instruções. Textos retornados pelos dados são tratados como conteúdo não confiável. Sem `OPENAI_API_KEY`, o endpoint mantém uma resposta determinística baseada em consultas MCP e identifica o modo `fallback`.

O recurso fica habilitado por padrão para todos os perfis e usa todas as fontes MCP publicadas em `ondaluz.agent.configuration.v1`, sempre em modo somente leitura. O Agente IA nunca recebe ferramentas de escrita: criação, encerramento, alteração de chamados, agrupamentos, equipamentos ou configurações continuam dependendo das rotas validadas e de confirmação humana. Restrições por papel podem ser adicionadas futuramente sem alterar o contrato do painel.

## Formas de agrupamento

- **Parque:** todas as CPEs ativas, reservado a falhas realmente amplas.
- **OLT:** uma OLT inteira, quando o problema atravessa suas PONs.
- **PON:** uma porta específica dentro de uma OLT.
- **CTO:** uma CTO específica dentro do caminho OLT → PON.
- **Cliente:** uma única CPE quando não existe causa compartilhada comprovada.
- **Firmware:** CPEs que executam a mesma versão.
- **Equipamento:** combinação de fabricante, modelo e revisão de hardware.
- **Região:** CPEs de um mesmo bairro cadastrado no inventário.

O agente deve escolher o menor alcance que ainda explique a evidência. Problemas diferentes não são unidos apenas porque ocorreram no mesmo período.

O modelo não recebe ferramentas de escrita. Ele não cria o agrupamento diretamente e não executa reboot, rollback, configuração, visita ou ordem de serviço. Mesmo no modo automático, a criação é uma decisão do backend, com limiar explícito e escopo recalculado no inventário; o modelo apenas devolve a proposta estruturada.

## Triagem recorrente de tickets N1

A triagem de tickets é um fluxo separado do agente que investiga agrupamentos já detectados. O serviço `TicketTriageSchedulerService` executa a cada 15 minutos por padrão e seleciona somente tickets de origem `n1` com estado `unprocessed` ou `failed`. A análise recebe o relato do cliente e o `source_payload` completo, além do equipamento ativo, firmware, revisão, plano, topologia OLT/PON/CTO, métricas diárias, logs de Inform, diagnósticos recentes e os últimos chamados do mesmo cliente.

O modelo precisa decidir entre atendimento individual N1 e candidato compartilhado para o NOC. Um ticket isolado não é incidente: mesmo quando há indício de falha coletiva, a ação automática permitida é apenas corrigir a categoria ou encaminhar o ticket individual para a fila do NOC. O NOC confirma a abrangência e cria ou vincula o agrupamento. Categoria ambígua, baixa confiança, visita técnica e encerramento permanecem em revisão humana; `TICKET_TRIAGE_AUTO_CLOSE=false` é o padrão.

Cada execução é registrada em `ticket_ai_triage_runs` com snapshot de entrada, decisão estruturada, evidências, confiança, modelo, resposta, ação aplicada e erro. O detalhe REST `GET /api/tickets/:ticketId/triage` e as ferramentas MCP `tickets_get_triage` e `tickets_get_triage_config` permitem auditar o caminho sem expor a chave do modelo. A tela do ticket mantém visível o atendimento normal, os dados do equipamento e o histórico; a triagem aparece como contexto adicional, não como substituição do atendente.

O snapshot de entrada agora inclui perfil do cliente derivado do inventário, equipamento ativo, qualidade/frescor dos dados, linha do tempo consolidada, evidências estruturadas com fonte e horário, chamados correlacionados por cliente, topologia, firmware, equipamento e região, contagem de clientes/equipamentos potencialmente relacionados e incidentes NOC ativos compatíveis. A interface mostra essas informações no detalhe do ticket e explicita as lacunas de coleta para que a ausência de métricas, Inform ou diagnóstico não seja confundida com evidência de normalidade. A ação **Reavaliar com IA** também está disponível na ficha completa e preserva o histórico.

A configuração também oferece a reavaliação manual por `POST /api/tickets/triage/retry` ou pela ferramenta MCP `tickets_retry_triage`. Na interface, o ticket pode ser encontrado pelo ID, cliente ou parte do relato antes da seleção; a API recebe o identificador escolhido, que pode apontar para um ticket N1 ou histórico importado. O backend marca somente o estado corrente como pendente, executa novamente a análise com os sinais atuais e preserva as execuções anteriores para comparação; uma nova execução não apaga nem sobrescreve o registro de auditoria anterior.

## Configuração local

Copie `.env.example` para `.env`, informe `OPENAI_API_KEY` e reinicie o Compose. As variáveis `AGENT_*` controlam concorrência, raciocínio, número máximo de ferramentas, paginação, contexto e o tempo máximo de cada chamada externa (`AGENT_OPENAI_TIMEOUT_MS`, padrão de 90 segundos). `AGENT_GROUPING_MAX_CANDIDATES` limita quantos candidatos cada varredura pode encaminhar ao agente. `AGENT_AUTO_APPROVE_GROUPINGS` permanece `false` por padrão; quando explicitamente habilitada, `AGENT_AUTO_APPROVE_MIN_CONFIDENCE` controla o limiar. Sem a chave, o atendimento N1 usa a orientação determinística e a fila do NOC não simula uma proposta do modelo. O detector consulta apenas as tabelas já carregadas no banco; não há busca externa de dados operacionais.

## Limites para produção

Antes de uso real ainda são necessários autenticação, autorização por provedor e papel, gestão de segredos, auditoria imutável, política de retenção, avaliação de qualidade/custo e runbooks para indisponibilidade do modelo.
