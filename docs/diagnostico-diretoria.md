# Diagnóstico para a diretoria

**Período analisado:** 06/07 a 30/08/2026  
**Conclusão:** o aumento de chamados não tem uma causa única. Há três falhas com tratamentos diferentes. A prioridade é corrigir o trecho compartilhado de fibra no Jardim Aurora, conter o firmware Kestrel 2.4.1 e reparar a incompatibilidade criada pela campanha Turbo 500. A troca de todos os Tuim e o reboot diário do parque gastariam muito sem atacar essas causas.

## O que mudou

Os chamados técnicos (lentidão, sem conexão e Wi-Fi) passaram de **825 nas duas primeiras semanas para 1.058 nas duas últimas: +28%**. No mesmo comparativo, os escalonamentos ao NOC foram de 96 para 118 e as visitas, de 85 para 121. Só o incremento de 233 chamados, 22 escalonamentos e 36 visitas representa pelo menos **R$ 9,1 mil de custo direto adicional em duas semanas** (R$ 4.194 + R$ 550 + R$ 4.320), sem contar hora extra, churn e clientes insatisfeitos.

### 1. Degradação coletiva no Jardim Aurora — agir primeiro

As portas **1/7 e 1/8 da OLT-2** saíram de 12 chamados técnicos nas duas primeiras semanas para 152 entre 17 e 30/08 quando se considera o equipamento vinculado ao cliente no momento do chamado. Na última semana, as 112 CPEs ainda ativas no grupo acumularam mais de **65 milhões de blocos FEC não corrigíveis**. As portas atendem o Jardim Aurora e compartilham o alimentador que passa pela **CE-JA-03**.

No recorte recente usado pelo produto, 112 CPEs ativas com telemetria geraram 139 chamados, 39 visitas e 33 escalonamentos, somando **R$ 8 mil** em tratamento. Uma única inspeção de rede externa custa R$ 650, enquanto as visitas residenciais recentes já custaram R$ 4,7 mil e não corrigem um defeito compartilhado.

**Confiança: alta.** Há concentração espacial, crescimento temporal e uma métrica física coerente. Falta apenas a inspeção em campo para distinguir conector, emenda, splitter ou alimentador.

**Ação:** acionar rede externa na CE-JA-03 e nos trechos das PON 1/7 e 1/8. Até validar o segmento comum, vincular os chamados ao incidente e suspender visitas residenciais isoladas nesse grupo.

### 2. Firmware Kestrel 2.4.1 — conter e testar rollback

O rollout ocorreu de 20 a 24/07. Antes do início, em 20/07, não há dias com memória livre abaixo de 10% nessa versão; depois, a condição aparece em centenas de CPEs por dia. Na última semana, CPEs ativas em 2.4.1 chegaram a **1,9% de memória livre** e registraram aproximadamente **2,5 mil eventos de boot**. A versão 2.3.8 não apresenta a mesma queda de memória.

O painel identifica cerca de 1,8 mil CPEs ativas com memória crítica ou repetição de reinício. Entre os afetados houve 358 chamados recentes. O reboot explica por que a orientação do suporte parece resolver: libera memória por algum tempo, mas não remove a causa.

**Confiança: alta.** A sequência atualização → degradação de memória → boots → chamados é consistente, específica da versão e compatível com a cronologia. Ainda é prudente confirmar causalidade com um rollback canário.

**Ação:** congelar o lote 2, abrir chamado com o fabricante e evidências, selecionar um grupo pequeno para rollback a 2.3.8 e comparar por 72 horas memória, boots e chamados. Se a melhora se confirmar, ampliar o rollback.

### 3. Turbo 500 em Norvik revisão A — correção direcionada

A campanha deixou 877 clientes com upgrade ainda ativos no fim do período. Em **377 clientes**, o plano de 500 Mbps ficou associado ao Norvik NV-G1 revisão A cuja porta reporta 100 Mbps de forma permanente. Após o upgrade, esse grupo abriu 322 chamados de lentidão e gerou 128 escalonamentos ao NOC.

O teste TR-143 pode retornar velocidade adequada no caminho entre a CPE e o servidor, mas não elimina o gargalo entre a CPE e o equipamento do cliente. Por isso o procedimento atual pode devolver o caso como Wi-Fi mesmo quando a limitação é física.

**Confiança: alta.** Plano, data do upgrade, revisão de hardware, negociação LAN e texto dos chamados convergem. O custo máximo de trocar os 377 equipamentos por Kestrel, incluindo visita, é **R$ 199,8 mil**; a execução pode ser priorizada pelos clientes que reclamaram ou têm maior risco de churn.

**Ação:** impedir novos upgrades acima de 100 Mbps nesse hardware, avisar proativamente os afetados e criar agenda de troca priorizada. Corrigir também a validação comercial para bloquear combinações incompatíveis.

## O que fazer com as propostas existentes

| Proposta | Decisão | Motivo |
|---|---|---|
| Trocar todos os Tuim por R$ 1,2 milhão | **Não aprovar** | As taxas de chamados por mil clientes são praticamente iguais: Tuim 470, Kestrel 475 e Norvik 478 no recorte de clientes ativos. O aparente problema Tuim é parcialmente geográfico: muitos estão no Jardim Aurora. |
| Reiniciar todo o parque às 4h | **Não executar** | Reinícios diários criam indisponibilidade, escondem a regressão de firmware e não corrigem fibra nem limitação de porta. Usar reboot apenas como mitigação registrada em caso específico. |
| Considerar todo teste de velocidade aprovado como Wi-Fi | **Revisar** | O teste é útil para separar falha WAN, mas não prova a entrega ponta a ponta nem detecta porta LAN a 100 Mbps. |
| Enviar técnico para todo caso persistente | **Priorizar por evidência** | Visita residencial não corrige incidente compartilhado nem firmware. Reservar campo para Rx fora de faixa, drop/conector e troca incompatível. |

## Ordem proposta para as próximas 72 horas

1. **Hoje:** abrir incidente de rede para OLT-2/PON 1/7–1/8, inspecionar CE-JA-03 e parar visitas individuais no grupo.
2. **Hoje:** congelar atualizações Kestrel e iniciar rollback canário, com painel comparando memória e boots.
3. **Em 24 horas:** bloquear novos Turbo 500 para Norvik A e gerar a lista de 377 clientes para contato/troca priorizada.
4. **Em 48–72 horas:** medir redução de FEC, boots e chamados; só então decidir expansão das correções.

O protótipo transforma essa ordem em fila operacional e dá ao N1 uma resposta diferente para cada causa. Ele não automatiza rollback, reboot ou visita: recomenda a ação e expõe a evidência e a confiança para decisão humana.
