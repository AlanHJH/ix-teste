# Registro de implementação e evolução do Ondaluz Ops

**Última atualização:** 9 de outubro de 2026
**Escopo:** funcionalidades implementadas, decisões de produto, melhorias de usabilidade e validações realizadas no protótipo.

## 1. Objetivo da aplicação

O Ondaluz Ops é uma plataforma operacional para provedores de internet. Ela
conecta atendimento N1, NOC, inventário, topologia, telemetria, diagnósticos,
tickets e recursos de IA em um mesmo contexto.

O objetivo é reduzir o atendimento baseado em suposição. Antes de orientar o
cliente ou enviar uma equipe de campo, o sistema deve mostrar:

- quem é o cliente e qual CPE está instalada;
- fabricante, modelo, revisão, firmware e plano contratado;
- caminho OLT → PON → CTO → CPE;
- sinais, medições, diagnósticos e histórico disponíveis;
- tickets relacionados e possível alcance do problema;
- o que já foi confirmado, o que é hipótese e qual é o próximo passo seguro.

A IA recomenda e explica. A decisão operacional continua humana; o sistema não
faz reboot, rollback, alteração de OLT, visita ou encerramento crítico sem uma
ação explícita e validada.

## 2. Fluxo operacional implementado

### 2.1 Dashboard

O dashboard é a entrada de prioridade da operação. Ele reúne dados reais da API
e permite acompanhar:

- CPEs ativas e clientes em risco;
- clientes com sinal de possível falta de conexão;
- evolução semanal de chamados;
- alertas, incidentes e fila do NOC;
- composição de dados por OLT, PON, CTO, equipamento e firmware;
- filtros de período e filtros de listas.

Os blocos são atualizados pela API e exibem estado de carregamento durante a
consulta. O botão **Diagnosticar** leva o operador para a análise completa do
cliente, com caminho de rede, equipamento, medições, histórico e tickets.

### 2.2 Atendimento N1

O N1 é o primeiro nível de suporte. Ao abrir um atendimento, o operador recebe
o contexto do cliente antes de conduzir a ligação:

1. identificação do cliente;
2. CPE, fabricante, modelo, revisão e firmware;
3. plano contratado e dados de conexão;
4. caminho de rede e grupo NOC relacionado;
5. sinais e medições já consultados;
6. chamados recentes e histórico disponível;
7. hipótese inicial, confiança e lacunas de confirmação.

O N1 registra o relato do cliente, segue uma sequência de perguntas e pode
escalar o caso. Quando há indício de impacto compartilhado, a orientação é
encaminhar ao NOC sem declarar a causa física como confirmada.

O copiloto do atendimento:

- recebe o relato da ligação;
- atualiza a hipótese com o novo contexto;
- sugere perguntas e verificações seguras;
- prepara uma fala simples para o cliente;
- ajuda a documentar o chamado;
- não substitui a decisão do atendente.

Relatos que não pertencem ao diagnóstico de rede, como uma emergência de
saúde, são tratados por uma trava de segurança e não devem ser interpretados
como falha de CPE ou infraestrutura.

### 2.3 Visão NOC

O NOC investiga ocorrências que podem atingir vários clientes ou um elemento
compartilhado da rede. Mais de um cliente com o mesmo sintoma é um sinal comum,
mas não é requisito: um único ticket que aponta para uma PON, OLT, CTO ou outro
elemento de infraestrutura também pode ser encaminhado ao NOC.

O fluxo é:

1. receber o ticket ou candidato;
2. consultar o alcance pela topologia e pelo inventário;
3. verificar telemetria, FEC, potência óptica, reinícios e diagnósticos;
4. cruzar chamados e clientes relacionados;
5. comparar hipóteses individuais e compartilhadas;
6. revisar evidências favoráveis, contrárias e ausentes;
7. decidir se o caso deve seguir como ocorrência coletiva;
8. agrupar chamados relacionados quando o alcance for confirmado;
9. manter o grupo em aberto, em mitigação ou encerrado;
10. encerrar os tickets vinculados quando o agrupamento for resolvido e
    registrar o contato ou retorno ao cliente.

O caso detalhado de referência é a OLT-2/PON 1/7, documentado em
[`caso-pon-1-7.md`](caso-pon-1-7.md).

## 3. IA, MCP e auditoria

### 3.1 Agente IA transversal

Foi adicionado um launcher **Agente IA** no canto inferior direito das telas
operacionais. Ele está disponível para todos os perfis do protótipo e recebe o
contexto da tela, cliente, ticket ou elemento técnico selecionado.

O operador pode:

- perguntar sobre o contexto atual;
- pedir explicação de um termo técnico;
- solicitar evidências adicionais;
- pedir comparação entre clientes, CPEs, PONs ou tickets;
- entender o histórico de uma região ou grupo;
- consultar o próximo passo recomendado.

O navegador conversa com o backend. O backend consulta as fontes MCP e devolve
resumo, evidências, limitações e ferramentas consultadas. O navegador não
acessa o MCP diretamente.

### 3.2 Fontes MCP utilizadas

O agente pode consultar, em modo somente leitura:

- clientes;
- inventário de CPEs e equipamentos;
- topologia OLT/PON/CTO;
- telemetria e métricas;
- diagnósticos;
- tickets e histórico;
- operações, grupos NOC e incidentes;
- contratos da própria aplicação.

O contexto enviado à IA preserva o máximo de dados necessários para análise,
mas mantém a separação entre dado bruto, dado normalizado, evidência e
interpretação. Quando a chave da OpenAI não está configurada, há fallback
determinístico baseado nas consultas disponíveis; a interface não deve simular
uma resposta de modelo.

### 3.3 Dados brutos e rastreabilidade

Tickets mantêm o payload original em JSONB, além dos campos normalizados. Isso
permite que uma análise futura use dados que ainda não possuem uma coluna
específica.

As execuções de triagem registram:

- snapshot de entrada;
- equipamento, firmware, plano e topologia encontrados;
- medições, diagnósticos e tickets correlacionados;
- evidências favoráveis e contrárias;
- decisão estruturada;
- confiança;
- modelo ou fallback utilizado;
- ação proposta ou aplicada;
- erro, quando houver;
- data e responsável pela revisão.

Uma reavaliação não apaga a análise anterior. As versões permanecem disponíveis
para comparação e auditoria.

## 4. Triagem automática de tickets

Foi implementada uma triagem recorrente, separada da investigação de grupos do
NOC. O agendador analisa tickets N1 novos ou que falharam na análise a cada 15
minutos, por padrão.

A IA diferencia:

- atendimento individual de um cliente;
- indício de problema compartilhado para o NOC;
- categoria de sintoma;
- necessidade de revisão humana;
- tarefa técnica de campo.

O atendimento individual continua sendo responsabilidade do N1. O NOC avalia
se vários tickets pertencem a uma mesma ocorrência maior e decide o agrupamento.
O ticket não é encerrado automaticamente por uma classificação incerta.

### 4.1 Medição óptica em campo

Foi criada a categoria **Medição óptica em campo** para representar o trabalho
do técnico no trecho compartilhado da rede. Ela é diferente de uma visita
residencial genérica e pode registrar:

- potência na CTO e no splitter;
- entrada e saída óptica;
- conectores e emendas;
- inspeção do trecho comum;
- OTDR ou medidor óptico;
- camada física do trabalho, como poste ou trecho compartilhado;
- responsável e checklist;
- vínculo com a PON, CTO, grupo NOC e clientes relacionados.

O objetivo é evitar dezenas de visitas individuais quando a evidência aponta
para um ponto compartilhado.

### 4.2 Reavaliação manual

A configuração de IA possui uma seção para solicitar novamente a avaliação de
um ticket. O operador localiza o chamado por ID, cliente ou texto do relato,
seleciona o item correto no autocomplete e dispara **Reavaliar com IA**.

O backend executa novamente a análise com os dados atuais e preserva o
histórico. O fluxo não sobrescreve silenciosamente decisões anteriores.

## 5. Topologia e mapa operacional

O mapa foi ajustado para priorizar o ramo selecionado e reduzir dados
irrelevantes na abertura em tela cheia. O operador consegue:

- escolher uma OLT;
- visualizar suas PONs, CTOs e CPEs;
- abrir o detalhe de uma PON sem perder o contexto;
- exibir os filhos diretos de uma PON;
- abrir uma CTO sem fechar o detalhe do pai;
- ver o caminho completo OLT → PON → CTO → CPE;
- identificar a PON pai diretamente no card da CTO;
- atualizar os dados e o histórico de um item problemático;
- distinguir CPEs ativas de informações físicas ainda não cadastradas.

O mapa não inventa cabo, splitter ou drop físico quando o inventário não possui
esse identificador. A ausência é mostrada como lacuna de cadastro.

## 6. Melhorias de interface e usabilidade

### 6.1 Identidade visual

O estilo visual foi aproximado do objetivo de referência do IXC ACS:

- marca e logo IXC ACS;
- paleta escura azul-marinho com acentos ciano e verde;
- cards com hierarquia operacional;
- estados de alerta com cores semânticas;
- contraste reforçado em IDs, títulos e dados técnicos;
- botões e badges consistentes entre Dashboard, N1, NOC, Tickets e
  Equipamentos.

### 6.2 Inventário de equipamentos

A listagem de equipamentos deixou de ser uma tabela extensa e passou a usar um
card por equipamento. Cada card reúne:

- cliente e localidade;
- situação;
- serial da CPE;
- equipamento e revisão;
- firmware;
- plano contratado;
- topologia completa;
- ações para abrir o cliente, a CPE, firmware, plano, OLT, PON ou CTO.

Busca, filtros de situação e ordenação continuam disponíveis. A ordenação foi
movida para um controle explícito com opções de cliente, serial, equipamento,
firmware/plano, topologia e situação.

### 6.3 Tipografia, contraste e carregamento

Foram feitos ajustes recorrentes de leitura:

- IDs de clientes e tickets ficaram mais escuros ou mais contrastados quando
  estavam apagados;
- títulos de análise e subtítulos brancos sobre branco foram corrigidos;
- o campo do N1 Advisor ganhou fundo, texto e placeholder legíveis;
- campos de busca normais foram padronizados para 13px;
- filtros compactos mantêm seu tamanho específico;
- ações de diagnóstico mostram loading enquanto cruzam cadastro, equipamento,
  medições, rede e histórico;
- botões de atualização não fecham o detalhe aberto;
- tooltips explicam siglas e termos técnicos relacionados a redes.

### 6.4 Glossário contextual

O glossário compartilhado explica termos como OLT, PON, CTO, CPE, firmware,
serial, hardware, plano, Mbps, FEC, potência óptica, telemetria, diagnóstico,
incidente, chassi e uplink.

Os tooltips aparecem em cards, headers, detalhes, tabelas legadas, mapas e
contextos do atendimento. A explicação usa linguagem operacional e distingue
fato observado de hipótese.

## 7. Segurança operacional e governança

As recomendações da IA são acompanhadas de confiança, evidências, limitações e
próximo passo. A interface deixa claro quando algo é:

- confirmado;
- hipótese provável;
- aguardando revisão humana;
- não consultado;
- indisponível ou desatualizado.

O agente não recebe ferramentas de escrita. Alterações de ticket, grupo NOC,
estado operacional ou configuração passam pelas rotas normais do backend e
ficam registradas.

O protótipo ainda precisa de endurecimento para produção: autorização por
provedor e papel, gestão de segredos, auditoria imutável, retenção, limites de
custo, avaliação de qualidade e runbooks de indisponibilidade do modelo.

## 8. Validação realizada

As principais validações executadas durante a evolução foram:

- `npm run lint -w @ondaluz/web`;
- `npm test -w @ondaluz/web` — 33 testes aprovados na suíte web;
- `npm run build -w @ondaluz/web`;
- `docker compose up --build -d web`;
- healthcheck da API e dos containers;
- abertura do Dashboard, Visão NOC, Atendimento N1, Tickets e Equipamentos;
- teste do modal de cliente a partir do card de inventário;
- teste da ordenação do inventário;
- validação visual do mapa, detalhes de PON/CTO e cards de equipamentos;
- confirmação dos tooltips técnicos e dos estados de loading.

O build ainda apresenta apenas o aviso conhecido de chunk JavaScript acima de
500 kB; não é uma falha de compilação.

## 9. Documentos relacionados

- [Arquitetura proposta](arquitetura.md)
- [Processo do agente e revisão humana](agente-investigacao.md)
- [Contrato do MCP](mcp.md)
- [Contratos REST e MCP](contratos-api.md)
- [Caso OLT-2/PON 1/7](caso-pon-1-7.md)
- [Roteiro de apresentação](roteiro-apresentacao.md)
- [Diagnóstico para a diretoria](diagnostico-diretoria.md)
- [Consultas reproduzíveis](consultas-evidencias.sql)

## 10. Próximas evoluções sugeridas

1. executar uma validação E2E limpa dos fluxos N1 e NOC com banco resetado e
   múltiplos perfis;
2. validar paridade mecânica entre todos os endpoints REST e ferramentas MCP;
3. adicionar métricas de latência, custo, taxa de fallback e taxa de revisão
   humana da IA;
4. melhorar a responsividade dos cards em telas pequenas;
5. criar permissões específicas para operações sensíveis;
6. registrar autoria de novos pontos de infraestrutura;
7. separar configuração de demonstração de autenticação real de produção;
8. avaliar divisão dos chunks do frontend para reduzir o aviso de build.
