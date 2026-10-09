# Roteiro de apresentação: Ondaluz Ops

**Duração sugerida:** 8 a 12 minutos
**Objetivo:** demonstrar como a plataforma transforma dados brutos de rede em
uma decisão operacional explicável para N1 e NOC.

## 1. Abertura — 45 segundos

Mensagem sugerida:

> A plataforma existe para reduzir o tempo entre o primeiro chamado e a
> identificação da causa provável. Ela junta inventário, telemetria,
> diagnósticos, topologia e tickets. O N1 atende o cliente com contexto; o NOC
> enxerga quando vários atendimentos são, na verdade, o mesmo problema de
> infraestrutura.

Não comece apresentando todos os menus. Comece pelo problema operacional:
tratar cada cliente isoladamente gera visitas e diagnósticos repetidos quando a
causa está em um trecho compartilhado.

## 2. Dashboard — 60 segundos

Mostre somente os indicadores que estabelecem contexto:

- CPEs ativas e distribuição por OLT/PON;
- chamados recentes e reincidência;
- agrupamentos ou candidatos prioritários;
- fila do NOC aguardando decisão.

Explique que o dashboard é uma visão de prioridade, não o lugar onde o técnico
faz toda a investigação. A decisão detalhada acontece no NOC ou no atendimento
N1.

## 3. Visão NOC — 2 minutos

Abra o agrupamento da **OLT-2/PON 1/7** e destaque:

1. severidade alta e estado aberto;
2. 56 de 62 CPEs com sinal FEC;
3. escopo operacional de 62 CPEs, recalculado pelo inventário;
4. hipótese de degradação óptica compartilhada;
5. evidências favoráveis e contrapontos;
6. necessidade de validação humana.

Frase importante:

> O sistema não afirma que a fibra ou o splitter falhou. Ele explica por que a
> PON deve ser investigada e deixa claro o que ainda falta confirmar.

## 4. Topologia — 2 minutos

Na topologia da OLT-2:

1. selecione a PON 1/7;
2. mostre as 8 CTOs;
3. abra uma CTO;
4. mostre o caminho OLT → PON → CTO → CPE;
5. compare quantidade de CPEs, FEC, potência óptica e histórico;
6. explique que o mapa tem rastreabilidade lógica, não IDs físicos de cabo ou
   splitter.

Evite abrir vários detalhes simultaneamente. O objetivo é mostrar que o
problema atravessa as CTOs e não pertence a um único cliente.

## 5. Evidências cruzadas — 90 segundos

Explique o papel de cada fonte:

| Fonte        | Pergunta respondida                                      |
| ------------ | -------------------------------------------------------- |
| Inventário   | Quem está conectado, onde e com qual equipamento?        |
| Telemetria   | O sinal se repete? O RX está baixo? Há FEC ou reinícios? |
| Diagnósticos | Os testes concluíram ou ficaram indisponíveis?           |
| Tickets      | Quantos clientes relatam sintomas compatíveis?           |
| Operações    | Já existe agrupamento ou é uma proposta nova?            |

Para a PON 1/7, a evidência é convergente, mas os 20 diagnósticos que falharam
impedem usar velocidade como prova principal.

## 6. N1 e passagem para o NOC — 90 segundos

Abra um cliente pertencente ao grupo e mostre que o N1 recebe:

- cliente e equipamento;
- firmware e plano;
- OLT, PON e CTO;
- sinais disponíveis;
- agrupamento NOC compatível;
- orientação de atendimento.

Explique a diferença:

- **ticket individual:** registra o contato daquele cliente;
- **agrupamento NOC:** representa a causa compartilhada que pode explicar
  vários tickets.

Quando novos tickets pertencem ao grupo, eles são vinculados ao agrupamento em
vez de gerar investigações duplicadas.

## 7. Revisão humana e segurança — 60 segundos

Mostre que o agente:

- consulta MCP somente leitura;
- registra ferramentas, evidências e contrapontos;
- não executa reboot, rollback ou configuração;
- não cria incidente sem revisão humana;
- recalcula o alcance pelo inventário no momento da aprovação.

Mensagem sugerida:

> A IA acelera a análise e organiza a evidência. A decisão operacional continua
> auditável e humana.

## 8. Encerramento — 45 segundos

Use a frase abaixo:

> Neste caso, a plataforma evitou tratar 56 sinais como 56 problemas isolados.
> Ela mostrou uma ocorrência coletiva na PON 1/7, comparou com outros grupos,
> preservou as incertezas e encaminhou uma única investigação para o NOC. O
> próximo passo é confirmar o trecho físico com telemetria atualizada e campo,
> não executar ações indiscriminadas nos clientes.

## 9. Plano B para a demonstração

Se a IA ou a telemetria demorar:

1. deixe o Compose iniciado antes da reunião;
2. confirme `curl http://localhost:3000/health`;
3. abra a Visão NOC e a topologia antes de compartilhar a tela;
4. mantenha este caso documentado como referência;
5. use a ficha já carregada para mostrar evidências e histórico;
6. explique que a aplicação preserva o resultado auditável mesmo quando uma
   consulta individual fica sem resposta.

Não apresente uma captura antiga como se fosse telemetria atual. Diga sempre
qual é a data da última fonte disponível.

## 10. Perguntas prováveis

### “A IA encontrou a causa exata?”

Não. Ela encontrou um padrão compatível com degradação óptica compartilhada e
reduziu o espaço de investigação. A inspeção física confirma o componente.

### “Por que não reiniciar todas as CPEs?”

Porque reinício pode mascarar sintomas, não corrige uma perda óptica comum e
gera indisponibilidade sem confirmar a causa.

### “Por que o agrupamento cobre 62 se 56 têm o sinal?”

56 é a população observada com evidência de FEC; 62 é o alcance operacional
da PON recalculado pelo inventário para que novos chamados compatíveis possam
ser acompanhados no mesmo contexto.

### “Por que não juntar a PON 1/7 e a PON 1/8?”

As duas têm sinais fortes, mas ainda não está comprovado que compartilham o
mesmo componente físico. A aplicação mantém agrupamentos separados até que o
NOC confirme a origem comum.

### “O que falta para produção?”

Telemetria atualizada, IDs físicos de rede, autenticação e autorização de
produção, auditoria imutável, runbooks de campo e validação controlada das
ações automáticas.
