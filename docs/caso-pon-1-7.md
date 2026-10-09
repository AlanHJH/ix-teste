# Caso operacional: OLT-2 / PON 1/7

**Atualização do registro:** 9 de outubro de 2026
**Fonte de dados mais recente disponível:** 30 de agosto de 2026
**Público:** diretoria, NOC, N1 e equipe responsável pelo sistema
**Classificação operacional:** problema compartilhado de alta prioridade
**Estado:** agrupamento em mitigação no NOC, aguardando validação física

Este documento registra a análise reproduzível feita no protótipo Ondaluz Ops
para a PON 1/7 da OLT-2. Ele separa fatos observados, interpretação técnica,
limitações e decisão operacional. Nenhuma conclusão abaixo deve ser lida como
prova de que um componente físico específico já foi identificado.

## 1. Resumo executivo

A PON 1/7 apresenta um padrão distribuído de degradação óptica e erros FEC:

- **56 de 62 CPEs** ultrapassaram o critério de FEC elevado na janela recente;
- **54 de 62 CPEs** tiveram pelo menos um registro de recepção óptica abaixo de
  `-27 dBm`;
- **48 de 62 CPEs** repetiram o nível óptico baixo em pelo menos dois dias;
- o sinal aparece nas **8 CTOs** da PON, em vez de ficar concentrado em um
  único cliente ou equipamento;
- os equipamentos afetados incluem fabricantes, modelos e firmwares
  diferentes;
- há **165 chamados de 55 clientes**, principalmente por falta de conexão e
  lentidão;
- dos **33 diagnósticos** encontrados, 13 terminaram e 20 falharam ou não
  responderam.

### Decisão

O NOC deve tratar o caso como **ocorrência coletiva da PON 1/7** e investigar o
trecho óptico compartilhado. A causa mais provável está entre a porta da OLT,
fibra alimentadora, splitter, emenda ou conectores. Os dados atuais não
permitem escolher um desses componentes com segurança.

O agrupamento foi aprovado pela revisão humana e está em mitigação no NOC para a
PON inteira, com 62 CPEs no escopo operacional. A evidência de sinal permanece
56 CPEs afetadas; essa diferença é intencional: na aprovação, a aplicação
recalcula o alcance do agrupamento pelo inventário atual, enquanto preserva a
contagem observada na análise.

## 2. Linha do tempo e auditoria

| Momento    | Evento                               | Resultado                                               |
| ---------- | ------------------------------------ | ------------------------------------------------------- |
| 30/08/2026 | Último dia de telemetria disponível  | Base mais recente para FEC, potência óptica e reinícios |
| 09/10/2026 | Detector de agrupamentos executado   | PON 1/7 identificada como candidata prioritária         |
| 09/10/2026 | Agente confirmou o candidato via MCP | 56/62 CPEs, confiança de 87%, revisão humana exigida    |
| 09/10/2026 | Revisão humana                       | Proposta aprovada e encaminhada ao NOC                  |
| 09/10/2026 | Estado operacional                   | Agrupamento em mitigação, severidade alta               |

Registros de auditoria do protótipo:

- investigação do candidato: `INV-6F43AB9F`;
- reavaliação manual preservada: `INV-757F66F9`;
- agrupamento operacional: `INC-7EC4089F`, em mitigação;
- revisor registrado: `Marina Costa`;
- ação de rede automática: **nenhuma**.

O registro anterior e a reavaliação manual não são apagados quando a proposta é
aprovada. Eles permanecem disponíveis para comparação e auditoria.

## 3. O que foi consultado

O agente recebeu apenas ferramentas MCP de leitura. A análise cruzou os
seguintes domínios:

| Domínio     | Uso no caso                                         | O que ele confirmou                                                                 |
| ----------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Operations  | candidato, agrupamentos ativos e escopo             | concentração de FEC na PON e estado do agrupamento                                  |
| Inventory   | CPE, CTO, fabricante, modelo, firmware e plano      | 62 CPEs ativas distribuídas em 8 CTOs                                               |
| Telemetry   | métricas diárias e, quando necessário, Inform bruto | FEC, potência RX, reinícios e persistência temporal                                 |
| Diagnostics | testes TR-143                                       | volume de testes concluídos e falhos; velocidade não é a causa principal neste caso |
| Tickets     | chamados por cliente e categoria                    | impacto percebido por múltiplos clientes                                            |
| Customers   | contexto de atendimento                             | relação entre cliente, equipamento e topologia                                      |
| Application | estado das jornadas e revisão humana                | proposta na fila, decisão e encaminhamento                                          |

O agente não recebeu ferramentas para reboot, rollback, alteração de OLT,
alteração de CPE, abertura de ordem de serviço ou encerramento de chamado.

## 4. Evidências técnicas

### 4.1 Distribuição por CTO

| CTO         | CPEs ativas | CPEs com FEC elevado | CPEs com RX baixo recorrente | RX médio aproximado |
| ----------- | ----------: | -------------------: | ---------------------------: | ------------------: |
| CTO-2-17-01 |           6 |                    5 |                            6 |          -27,24 dBm |
| CTO-2-17-02 |           7 |                    6 |                            6 |          -27,18 dBm |
| CTO-2-17-03 |          12 |                   10 |                            8 |          -26,93 dBm |
| CTO-2-17-04 |           5 |                    5 |                            3 |          -26,50 dBm |
| CTO-2-17-05 |           7 |                    7 |                            7 |          -27,17 dBm |
| CTO-2-17-06 |           6 |                    5 |                            4 |          -26,90 dBm |
| CTO-2-17-07 |           5 |                    5 |                            2 |          -26,69 dBm |
| CTO-2-17-08 |          14 |                   13 |                           12 |          -27,23 dBm |
| **Total**   |      **62** |               **56** |                       **48** |                   — |

O fato de todas as oito CTOs apresentarem sinais relevantes é o principal
argumento contra tratar o evento como falha individual.

### 4.2 Equipamentos e firmware

Os maiores volumes de FEC incluem CPEs Tuim `TW-AC12` com firmware
`TW1.8.3_r221` e CPEs Kestrel `KX-3000` em versões `2.4.1` e `2.3.8`.
Portanto:

1. o problema não está restrito a um único fabricante;
2. o problema não está restrito a uma única versão de firmware;
3. firmware `2.4.1` continua sendo uma hipótese independente em outros grupos,
   mas não explica sozinho a degradação óptica distribuída desta PON.

### 4.3 Chamados e diagnósticos

Na população de clientes da PON 1/7 foram encontrados:

| Indicador                             | Quantidade |
| ------------------------------------- | ---------: |
| Chamados totais                       |        165 |
| Clientes distintos com chamados       |         55 |
| Chamados de sem conexão               |         73 |
| Chamados de lentidão                  |         79 |
| Chamados de Wi-Fi                     |          6 |
| Diagnósticos TR-143                   |         33 |
| Diagnósticos concluídos               |         13 |
| Diagnósticos com erro ou sem resposta |         20 |

Os diagnósticos concluídos tiveram médias aproximadas de 314,8 Mbps de
download e 194,5 Mbps de upload. Essa média não deve ser usada para declarar a
PON saudável: os testes estão incompletos, os planos são diferentes e o
problema principal aparece nos sinais ópticos e FEC.

## 5. Interpretação técnica

### Fato observado

Grande parte das CPEs de uma mesma porta apresenta FEC elevado e potência RX
baixa, com ocorrência em várias CTOs e em diferentes equipamentos.

### Hipótese mais provável

Há degradação no caminho óptico comum da PON. As possibilidades de campo são:

1. porta óptica ou transceptor associado à OLT;
2. fibra alimentadora da PON;
3. splitter ou ponto de distribuição compartilhado;
4. emenda ou conector com perda/intermitência;
5. combinação de perda óptica e margem insuficiente em um trecho comum.

### O que ainda não foi provado

- qual componente físico falhou;
- se o problema é permanente ou intermitente;
- se o FEC é causa ou consequência de uma perda óptica específica;
- se a PON 1/8 compartilha exatamente o mesmo trecho físico;
- se os níveis atuais continuam iguais, porque a última telemetria disponível é
  de 30/08/2026.

O resultado correto para apresentação é **hipótese de degradação óptica
compartilhada**, e não “fibra rompida” ou “splitter defeituoso” como fato.

## 6. Comparação com outros grupos

A rodada de candidatos avaliou seis grupos prioritários:

| Grupo                         | Sinal        | Alcance observado | Confiança | Leitura                                             |
| ----------------------------- | ------------ | ----------------: | --------: | --------------------------------------------------- |
| OLT-2 / PON 1/7               | FEC          |             56/62 |       87% | Problema coletivo provável                          |
| OLT-2 / PON 1/8               | FEC          |             51/54 |       84% | Outro problema coletivo relevante                   |
| Firmware 2.4.1                | estabilidade |       1.870/1.980 |       77% | Hipótese ampla, ainda não confirmada                |
| Kestrel KX-3000 1.2           | estabilidade |       1.890/3.622 |       22% | Inconclusivo por falta de correspondência nos dados |
| OLT-2 / PON 1/8 / CTO-2-18-02 | FEC          |             11/11 |       83% | Subgrupo forte dentro da PON 1/8                    |
| OLT-2 / PON 1/8 / CTO-2-18-03 | FEC          |             11/11 |       92% | Subgrupo forte dentro da PON 1/8                    |

Conclusão da comparação: a PON 1/7 **não é um caso isolado**, mas deve manter
seu próprio agrupamento porque o escopo mínimo que explica os sinais é a PON.
Não se deve misturá-la automaticamente com a PON 1/8 antes de confirmar o
trecho físico comum.

## 7. Decisão operacional e protocolo

### Para o NOC

1. Coletar telemetria atualizada da OLT-2/PON 1/7.
2. Comparar potência TX/RX e FEC da OLT com os valores observados nas CPEs.
3. Ordenar as oito CTOs pela concentração de perda óptica e FEC.
4. Inspecionar o trecho comum antes de abrir visitas residenciais individuais.
5. Comparar PON 1/7 e PON 1/8 para confirmar ou descartar alimentador
   compartilhado.
6. Após a intervenção, medir FEC, RX, chamados e diagnósticos por pelo menos
   uma janela comparável.

### Para o N1

- informar que há uma ocorrência coletiva em investigação;
- vincular novos chamados ao agrupamento quando a topologia e os sintomas
  forem compatíveis;
- não prometer solução imediata por reinício;
- não agendar visita individual antes da orientação do NOC, salvo risco ou
  sintoma fora do grupo;
- registrar horário, sintoma e impacto do cliente para comparação posterior.

### Mensagem sugerida ao cliente

> Identificamos que o seu atendimento está relacionado a uma instabilidade que
> pode afetar outros clientes conectados ao mesmo trecho da rede. A equipe
> técnica está verificando a conexão compartilhada. Vou registrar seu caso no
> acompanhamento coletivo para evitar que você precise repetir todas as
> informações.

## 8. Limitações e riscos

- A telemetria mais recente disponível é de 30/08/2026; uma decisão de campo
  precisa de coleta atualizada.
- O dataset não possui IDs físicos de cabo, splitter ou drop. O mapa mostra
  topologia lógica e não deve ser apresentado como planta física detalhada.
- Falha de diagnóstico não equivale a velocidade zero.
- FEC elevado e RX baixo são sinais fortes, mas não localizam sozinhos o
  componente físico.
- O agrupamento cobre a PON inteira operacionalmente, mas a contagem de sinal
  continua sendo 56/62; não apresentar 62 como “CPEs comprovadamente com
  defeito”.
- A aprovação criou estado operacional no protótipo, não uma ordem de serviço
  nem uma mudança na rede real.

## 9. Como reproduzir a análise

Com os serviços levantados e o dataset carregado:

```bash
docker compose up --build -d
curl http://localhost:3000/health
npm run smoke
```

Na interface:

1. entrar como administradora ou analista NOC;
2. abrir **Visão NOC**;
3. abrir o agrupamento **Erros FEC elevados na OLT-2 · PON 1/7**;
4. abrir a topologia da OLT-2 e selecionar a PON 1/7;
5. expandir as oito CTOs;
6. abrir uma CTO para comparar CPEs, firmware, níveis e histórico;
7. voltar à revisão para consultar evidências, contrapontos e ferramentas MCP.

Consultas SQL reproduzíveis para o recorte estão em
[`consultas-evidencias.sql`](consultas-evidencias.sql), na seção
**Análise detalhada da OLT-2/PON 1/7**.

## 10. Frase de encerramento para a apresentação

> O sistema não apenas detectou que havia FEC alto. Ele identificou que o
> padrão atravessava as oito CTOs da mesma PON, cruzou telemetria, inventário,
> diagnósticos e chamados pelo MCP, preservou as evidências contrárias, evitou
> atribuir a causa a um único firmware e encaminhou o caso ao NOC somente após
> revisão humana. A próxima decisão correta é investigar o trecho óptico
> compartilhado com dados atuais, não reiniciar clientes individualmente.
