# Diagnóstico para a diretoria

**Período analisado:** 6 de julho a 30 de agosto de 2026

**Público:** Ricardo, CEO

> Para a demonstração atual do fluxo N1 → NOC, consulte também o [registro
> detalhado da OLT-2/PON 1/7](caso-pon-1-7.md) e o [roteiro de
> apresentação](roteiro-apresentacao.md). Este documento mantém a visão
> executiva do período completo; o registro novo detalha a investigação
> operacional e a decisão humana feita sobre uma PON específica.

**Conclusão:** o aumento de chamados não tem uma causa única. Há três problemas independentes, com tratamentos diferentes. A prioridade é corrigir o trecho compartilhado de fibra no Jardim Aurora, conter o firmware Kestrel 2.4.1 e bloquear novas ativações incompatíveis do Turbo 500. Trocar todos os Tuim e reiniciar todo o parque diariamente custaria caro sem atacar as causas observadas.

## O que mudou

Os chamados técnicos passaram de **825 nas duas primeiras semanas para 1.058 nas duas últimas: +28,2%**. No mesmo comparativo, houve mais 22 escalonamentos ao NOC e mais 36 visitas. Esse excesso representa pelo menos **R$ 9.064 de custo direto adicional por quinzena** (atendimentos, escalonamentos e visitas), sem incluir hora extra, perda de receita, desgaste da marca ou cancelamentos.

## O que está causando o aumento

| Causa                  | Alcance e evidência principal                                                                                        | Custo direto associado | Confiança                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------: | ---------------------------------------------------- |
| Fibra no Jardim Aurora | 112 equipamentos nas portas 1/7 e 1/8 da OLT-2; cerca de 66 milhões de erros FEC em sete dias; 139 chamados recentes |           **R$ 8.007** | **Alta.** A peça exata depende de inspeção em campo. |
| Firmware Kestrel 2.4.1 | 1.865 equipamentos com memória crítica ou reinícios repetidos; 2.539 reinícios; 358 chamados recentes                |           **R$ 7.069** | **Alta.** Um rollback canário confirma causalidade.  |
| Turbo 500 em Norvik A  | 377 clientes em plano acima de 100 Mbps com porta limitada a 100 Mbps; 322 chamados de lentidão                      |           **R$ 9.596** | **Alta.** A incompatibilidade é objetiva.            |

Os custos por causa não devem ser somados: um mesmo cliente pode aparecer em mais de um grupo. O valor de R$ 9.064 mede apenas o aumento global entre as quinzenas; os valores da tabela medem recortes operacionais associados a cada causa.

### 1. Degradação coletiva de fibra no Jardim Aurora — agir primeiro

As portas **1/7 e 1/8 da OLT-2** passaram de 12 chamados técnicos nas duas primeiras semanas para mais de 150 nas duas últimas. Entre as 112 CPEs ativas com telemetria recente, foram registrados aproximadamente **66 milhões de erros FEC**, coerentes com degradação física da transmissão óptica. As duas portas atendem o Jardim Aurora e compartilham o trecho que passa pela **CE-JA-03**.

No grupo houve 139 chamados recentes, 39 visitas residenciais e 33 escalonamentos. O gasto direto de R$ 8.007 inclui R$ 4.680 em visitas que não corrigem uma causa compartilhada. Uma inspeção da rede externa custa R$ 650.

**Confiança alta.** Concentração espacial, crescimento temporal e métrica física apontam para o mesmo alcance. A inspeção deve distinguir conector, emenda, splitter ou cabo alimentador; os dados não permitem afirmar qual peça falhou.

**Ação:** abrir um único incidente, inspecionar CE-JA-03 e o trecho comum das PON 1/7 e 1/8, vincular os chamados e suspender visitas residenciais isoladas enquanto a causa compartilhada estiver ativa.

### 2. Instabilidade do firmware Kestrel 2.4.1 — conter e testar

Depois da atualização de 20 a 24 de julho, a versão 2.4.1 passou a apresentar queda de memória e reinícios. Na última semana, 1.865 equipamentos ativos entraram em condição crítica, houve **2.539 reinícios** e a memória livre chegou a **1,9%**. Em 30 de agosto, 696 equipamentos em 2.4.1 estavam abaixo de 10% de memória; na versão 2.3.8, nenhum.

Reiniciar o roteador libera memória temporariamente e explica por que a orientação do suporte parece funcionar, mas o problema retorna.

**Confiança alta.** A sequência atualização → degradação → reinícios → chamados é consistente e específica da versão. A confirmação controlada ainda é necessária.

**Ação:** congelar o rollout, acionar o fabricante com as evidências e fazer rollback canário para 2.3.8. Comparar memória, reinícios e chamados por 72 horas antes de ampliar.

### 3. Turbo 500 em Norvik revisão A — correção direcionada

Foram encontrados **377 clientes** com plano superior a 100 Mbps usando Norvik NV-G1 revisão A, cuja conexão local permanece limitada a 100 Mbps. Após o upgrade, o grupo gerou 322 chamados de lentidão e 128 escalonamentos ao NOC.

O teste remoto TR-143 pode aprovar o caminho entre a CPE e o servidor da operadora, mas não garante a velocidade na porta usada pelo cliente. Por isso, o procedimento atual pode classificar o caso como Wi-Fi mesmo diante de uma limitação física.

**Confiança alta.** Plano, data do upgrade, revisão do hardware, negociação da porta e chamados convergem. A troca dos 377 equipamentos por Kestrel, incluindo visita, custaria até **R$ 199.810**; esse é custo potencial de correção, separado do custo já incorrido.

**Ação:** bloquear novos upgrades incompatíveis, avisar os afetados e priorizar a troca de quem já reclamou ou apresenta maior risco de cancelamento.

## O que fazer com as propostas existentes

| Proposta                                  | Decisão                     | Motivo                                                                                                                                                 |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trocar todos os Tuim por R$ 1,2 milhão    | **Não aprovar**             | As taxas por mil clientes ficaram próximas entre Tuim, Kestrel e Norvik. A concentração de Tuim no Jardim Aurora confundia fabricante com localização. |
| Reiniciar todo o parque às 4h             | **Não executar**            | O reinício mascara a regressão e cria indisponibilidade. Não corrige fibra degradada nem porta limitada a 100 Mbps.                                    |
| Tratar teste remoto aprovado como Wi-Fi   | **Revisar**                 | O teste não mede necessariamente a entrega até o dispositivo e não detecta a limitação local do Norvik A.                                              |
| Enviar técnico para todo caso persistente | **Priorizar por evidência** | Visita residencial não resolve incidente compartilhado nem regressão de firmware.                                                                      |

## Ordem de ação nas próximas 72 horas

1. **Hoje:** abrir um incidente de rede para OLT-2/PON 1/7 e 1/8, inspecionar CE-JA-03 e interromper visitas individuais no grupo.
2. **Hoje:** congelar o Kestrel 2.4.1 e iniciar rollback canário, medindo memória e reinícios.
3. **Até 24 horas:** bloquear Turbo 500 em Norvik A e gerar a lista dos 377 clientes para contato e troca priorizada.
4. **Em 48 a 72 horas:** medir a redução de FEC, reinícios e chamados antes de ampliar cada correção.

O protótipo transforma essa ordem em fila operacional e dá ao N1 uma resposta diferente para cada causa. Ele recomenda e explica; não executa rollback, reboot ou visita sem decisão humana.
