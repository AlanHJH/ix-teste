# Agente de agrupamentos e revisão humana

O agente é uma camada opcional sobre os detectores determinísticos. Sua função no NOC é confirmar ou descartar possíveis problemas compartilhados e propor o menor agrupamento que explique os clientes afetados. Ele recebe um candidato já delimitado, consulta uma allowlist somente leitura distribuída pelos seis domínios de dados e pelo domínio MCP `application`, e devolve uma proposta estruturada. As ferramentas de escrita de `application` ficam fora dessa allowlist. A ingestão, os agregados, as regras e as telas continuam funcionando sem chave OpenAI.

## Fluxo

1. A cada cinco minutos, ou quando o operador usa **Buscar agora**, o pré-filtro calcula candidatos com dados dos últimos sete dias.
2. O detector considera parque, OLT, PON, CTO, cliente, firmware, equipamento e região. Limites mínimos de quantidade e percentual evitam enviar cada variação individual ao modelo.
3. O orquestrador elimina candidatos já cobertos por agrupamento ativo, deduplica investigações e limita concorrência, ferramentas, contexto e tamanho das respostas.
4. O agente começa por `operations_list_grouping_candidates` e confirma a hipótese nos domínios MCP de inventário, telemetria, diagnósticos, chamados, clientes e operação.
5. A conclusão contém categoria, severidade, alcance, confiança, causa provável, evidências favoráveis e contrárias, um roteiro simples para o N1 e a próxima atuação técnica do NOC. O N1 não recebe tarefas de inspeção de métricas ou diagnóstico avançado.
6. O backend valida o schema e as fontes. A proposta fica em **Aguardando humano** na própria seção **Onde agir primeiro**.
7. Ao aprovar, o backend consulta novamente o inventário, normaliza o escopo e recalcula a quantidade de CPEs. Só então cria o agrupamento ativo. Ao rejeitar, mantém o resultado apenas como histórico auditável.
8. O N1 passa a ver o agrupamento quando consulta um cliente que pertence ao alcance aprovado.

## Copiloto conversacional do N1

Ao abrir um cliente na tela **Atendimento N1**, o atendente recebe o provável problema calculado a partir do equipamento, dos sinais, dos chamados recentes e dos agrupamentos ativos do NOC. O bloco **Conduza a ligação com a IA** aceita o relato do cliente em cada rodada, sugere uma pergunta ou verificação segura, oferece opções de encaminhamento e atualiza a documentação sugerida para o chamado.

O endpoint `POST /api/customers/:customerId/n1-chat` usa o contexto do cliente e, quando `OPENAI_API_KEY` está disponível, uma resposta estruturada da OpenAI. Se o modelo estiver indisponível, há uma orientação determinística de contingência. Em ambos os casos, a IA não executa ações nem substitui a decisão do atendente.

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

O modelo não recebe ferramentas de escrita. Ele não cria o agrupamento diretamente e não executa reboot, rollback, configuração, visita ou ordem de serviço. A única escrita ocorre pela API REST depois da aprovação do NOC.

## Configuração local

Copie `.env.example` para `.env`, informe `OPENAI_API_KEY` e reinicie o Compose. As variáveis `AGENT_*` controlam concorrência, raciocínio, número máximo de ferramentas, paginação e contexto. `AGENT_GROUPING_MAX_CANDIDATES` limita quantos candidatos cada varredura pode encaminhar ao agente. Sem a chave, o atendimento N1 usa a orientação determinística e a fila do NOC não simula uma proposta do modelo. O detector consulta apenas as tabelas já carregadas no banco; não há busca externa de dados operacionais.

## Limites para produção

Antes de uso real ainda são necessários autenticação, autorização por provedor e papel, gestão de segredos, auditoria imutável, política de retenção, avaliação de qualidade/custo e runbooks para indisponibilidade do modelo.
