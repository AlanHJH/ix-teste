# Log de decisões

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
- O pacote fornecido está ignorado no Git; o README descreve onde colocá-lo.

## Uso de IA

- Na fase inicial, foi usado Codex GPT-5.6 Sol para inventariar os arquivos e procurar indicadores de malware/exploit antes de abrir o pacote, motivado por riscos observados em processos seletivos.
- Nesta implementação, Codex foi usado como ferramenta de apoio para explorar os dados, formular e refutar hipóteses, estruturar SQL, gerar o esqueleto NestJS/React, revisar tipos, escrever testes, documentação e realizar QA no navegador.
- As conclusões não foram aceitas apenas por sugestão da IA: foram verificadas com consultas reproduzíveis sobre os arquivos fornecidos, execução real da carga de 5.496.315 Informs, testes automatizados e inspeção das respostas da API e das duas telas.
- A decisão final sobre regras, prioridades, limites, custos e o que ficou fora do escopo permaneceu humana e está registrada neste arquivo.
