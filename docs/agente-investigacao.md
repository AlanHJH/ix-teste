# Agente de investigação e revisão humana

O agente é uma camada opcional sobre os detectores determinísticos. Ele recebe um candidato já delimitado, consulta os seis domínios MCP somente leitura e devolve uma conclusão estruturada. A ingestão, os agregados, as regras e as telas continuam funcionando sem chave OpenAI.

## Fluxo

1. Uma regra, agenda ou operador cria uma solicitação com escopo e janela.
2. O orquestrador deduplica e limita concorrência, ferramentas, contexto e tamanho das respostas.
3. O agente consulta evidências pelo MCP e devolve categoria, severidade, alcance, confiança, causa provável, contraindícios e recomendação.
4. O backend valida o schema, as fontes, o escopo e a exigência de revisão humana.
5. O NOC confirma, corrige ou rejeita. Somente depois um incidente pode ser criado.

O modelo não recebe ferramentas de escrita. Reboot, rollback, configuração, visita e ordem de serviço nunca são executados automaticamente.

## Configuração local

Copie `.env.example` para `.env`, informe `OPENAI_API_KEY` e reinicie o Compose. As variáveis `AGENT_*` controlam concorrência, raciocínio, número máximo de ferramentas, paginação e contexto. Sem a chave, a aba **Revisão IA** mostra o estado indisponível em vez de simular uma resposta.

## Limites para produção

Antes de uso real ainda são necessários autenticação, autorização por provedor e papel, gestão de segredos, auditoria imutável, política de retenção, avaliação de qualidade/custo e runbooks para indisponibilidade do modelo.
