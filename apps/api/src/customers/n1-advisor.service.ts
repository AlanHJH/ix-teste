import { Injectable } from "@nestjs/common";
import OpenAI from "openai";
import type { ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { CustomersService } from "./customers.service";

export type N1ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type N1AdvisorOption = {
  id: string;
  label: string;
  description: string;
};

export type N1DeepAnalysis = {
  headline: string;
  summary: string;
  causes: Array<{
    title: string;
    likelihood: "alta" | "média" | "baixa";
    evidence: string[];
    counterEvidence: string[];
  }>;
  path: Array<{
    step: number;
    title: string;
    action: string;
    why: string;
    decision: string;
  }>;
  confirmed: string[];
  unknowns: string[];
  customerScript: string;
  escalation: string;
  model: "openai" | "fallback";
};

export type N1AdvisorReply = {
  assistantMessage: string;
  nextSteps: string[];
  options: N1AdvisorOption[];
  documentation: string;
  disposition: "continue" | "resolve_phone" | "escalate_noc" | "schedule_visit";
  model: "openai" | "fallback";
  deepAnalysis: N1DeepAnalysis;
};

type SupportProfile = Awaited<
  ReturnType<CustomersService["getSupportProfile"]>
>;

const replySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    assistantMessage: { type: "string" },
    nextSteps: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 4,
    },
    options: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          description: { type: "string" },
        },
        required: ["id", "label", "description"],
      },
    },
    documentation: { type: "string" },
    disposition: {
      type: "string",
      enum: ["continue", "resolve_phone", "escalate_noc", "schedule_visit"],
    },
    deepAnalysis: {
      type: "object",
      additionalProperties: false,
      properties: {
        headline: { type: "string" },
        summary: { type: "string" },
        causes: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              likelihood: {
                type: "string",
                enum: ["alta", "média", "baixa"],
              },
              evidence: {
                type: "array",
                items: { type: "string" },
                maxItems: 4,
              },
              counterEvidence: {
                type: "array",
                items: { type: "string" },
                maxItems: 3,
              },
            },
            required: ["title", "likelihood", "evidence", "counterEvidence"],
          },
        },
        path: {
          type: "array",
          minItems: 3,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              step: { type: "integer" },
              title: { type: "string" },
              action: { type: "string" },
              why: { type: "string" },
              decision: { type: "string" },
            },
            required: ["step", "title", "action", "why", "decision"],
          },
        },
        confirmed: {
          type: "array",
          items: { type: "string" },
          maxItems: 6,
        },
        unknowns: {
          type: "array",
          items: { type: "string" },
          maxItems: 6,
        },
        customerScript: { type: "string" },
        escalation: { type: "string" },
      },
      required: [
        "headline",
        "summary",
        "causes",
        "path",
        "confirmed",
        "unknowns",
        "customerScript",
        "escalation",
      ],
    },
  },
  required: [
    "assistantMessage",
    "nextSteps",
    "options",
    "documentation",
    "disposition",
    "deepAnalysis",
  ],
} as const;

const instructions = `Você é o copiloto de atendimento N1 da Ondaluz. Você ajuda o atendente durante uma ligação curta, usando apenas o contexto fornecido: equipamento e caminho de rede do cliente, análise prévia de infraestrutura, medições, histórico de problemas do NOC, chamados recentes e agrupamentos ativos confirmados pelo NOC.

Regras:
- explique primeiro o provável problema em linguagem simples e deixe claro quando ainda for uma hipótese;
- faça no máximo uma pergunta ou solicitação segura por vez, adequada para um atendente pedir ao cliente por telefone;
- ofereça até três opções de próximo passo, como confirmar LEDs, testar perto do roteador, informar se outros dispositivos falham, escalar ao NOC ou agendar visita;
- não peça senha, código de autenticação, dados pessoais desnecessários ou qualquer ação perigosa;
- não declare que reiniciou, corrigiu, escalou ou agendou algo: apenas recomende a ação e deixe a decisão com o atendente;
- se existir um agrupamento ativo do NOC que alcance o cliente, trate-o como contexto prioritário e explique o que ele muda no atendimento;
- se o histórico não tiver problema relacionado, reconheça que a hipótese veio das medições e recomende encaminhar o novo sinal ao NOC quando o caso não puder ser resolvido por telefone;
- registre uma documentação curta, pronta para o campo de relato do chamado, sem inventar fatos;
- sempre preencha deepAnalysis com uma leitura ampla do caso: separe causas prováveis de fatos confirmados, use chamados e incidentes como linha do tempo, explique as evidências a favor e contra cada hipótese e monte um caminho das pedras ordenado, com uma decisão explícita em cada etapa;
- use linguagem clara para o operador. Nunca transforme uma correlação em causa confirmada e inclua as lacunas que ainda precisam ser verificadas;
- escolha disposition=resolve_phone somente quando a resposta indicar que o sintoma foi resolvido ou que a orientação telefônica foi suficiente; use escalate_noc para padrão coletivo ou investigação; use schedule_visit para evidência de sinal físico ou falha persistente que exige campo; caso contrário, continue.`;

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isUrgentHealthReport(message: string): boolean {
  const normalized = normalize(message);
  const medicine =
    /\b(remedio|medicamento|comprimido|capsula|dose|dosagem)\b/.test(
      normalized,
    );
  const ingestion = /\b(tomei|ingeri|bebi|usei|consumi|misturei)\b/.test(
    normalized,
  );
  const excess =
    /\b(muito|muita|demais|excesso|overdose|superdosagem|varios|varias)\b/.test(
      normalized,
    );
  const symptoms =
    /\b(passando mal|vomitei|vomito|desmaiei|desmaio|convuls|falta de ar|confus|sonolent|mal estar)\b/.test(
      normalized,
    );
  const explicitEmergency =
    /\b(intoxicacao|intoxicado|envenenamento|overdose|superdosagem)\b/.test(
      normalized,
    );
  const selfHarm = /\b(suicid|me matar|me machucar|tirar minha vida)\b/.test(
    normalized,
  );

  return (
    explicitEmergency ||
    selfHarm ||
    (medicine && ingestion && (excess || symptoms)) ||
    (medicine && excess)
  );
}

function urgentHealthReply(
  profile: SupportProfile,
  message: string,
): N1AdvisorReply {
  return {
    assistantMessage:
      "Esse relato foge do atendimento de internet e pode indicar uma urgência de saúde. Interrompa a triagem técnica. Se houver risco imediato, inconsciência, falta de ar, convulsão ou piora, oriente a ligação para o SAMU 192. Para orientação sobre possível intoxicação, o Disque-Intoxicação atende pelo 0800 722 6001.",
    nextSteps: [
      "Interromper os testes de rede e não registrar o caso como falha técnica confirmada.",
      "Se houver risco imediato ou piora, orientar o SAMU pelo 192.",
      "Para orientação toxicológica, indicar o Disque-Intoxicação: 0800 722 6001.",
    ],
    options: [
      {
        id: "medical_emergency",
        label: "Orientar atendimento médico",
        description:
          "Retirar o relato do fluxo técnico e priorizar um serviço de emergência.",
      },
      {
        id: "poison_center",
        label: "Orientar Disque-Intoxicação",
        description:
          "Indicar o canal toxicológico para receber orientação profissional.",
      },
    ],
    documentation: `Relato fora do escopo técnico com possível urgência de saúde: ${message.trim().slice(0, 260)}. Não concluir causa de rede; orientar atendimento médico adequado.`,
    disposition: "continue",
    deepAnalysis: {
      headline: "Relato fora do escopo técnico — atenção médica imediata",
      summary:
        "O relato menciona possível uso excessivo ou intoxicação por medicamento. A aplicação não consegue avaliar substância, quantidade, horário ou gravidade e não deve converter isso em diagnóstico de conectividade.",
      causes: [
        {
          title: "Possível intoxicação ou reação medicamentosa",
          likelihood: "alta",
          evidence: [
            "O relato contém sinais de ingestão excessiva, mistura de medicamentos ou possível intoxicação.",
            "A situação exige avaliação de um serviço de saúde, não uma investigação de rede.",
          ],
          counterEvidence: [
            "A aplicação não confirma a substância, a quantidade ingerida nem a gravidade dos sintomas.",
          ],
        },
      ],
      path: [
        {
          step: 1,
          title: "Interromper a triagem técnica",
          action:
            "Não pedir reboot, testes de conexão, visita técnica ou qualquer intervenção na CPE.",
          why: "O relato não pode ser explicado com os dados de rede do cliente.",
          decision:
            "Retirar a conversa do fluxo N1/NOC enquanto a possível urgência é atendida.",
        },
        {
          step: 2,
          title: "Acionar emergência se necessário",
          action:
            "Se houver risco imediato, inconsciência, falta de ar, convulsão ou piora, orientar o SAMU 192.",
          why: "Possível intoxicação pode exigir avaliação e atendimento rápidos.",
          decision:
            "Não esperar a conclusão do atendimento de internet para buscar ajuda.",
        },
        {
          step: 3,
          title: "Buscar orientação toxicológica",
          action:
            "Indicar o Disque-Intoxicação 0800 722 6001 para orientação profissional sobre a suspeita.",
          why: "O serviço pode orientar o encaminhamento adequado para intoxicações.",
          decision:
            "Registrar apenas o encaminhamento de segurança, sem inventar diagnóstico ou conduta clínica.",
        },
      ],
      confirmed: [
        "O relato recebido não é suficiente para concluir uma causa de conectividade.",
        `O contexto técnico do cliente ${profile.customer.id} permanece separado desta ocorrência de saúde.`,
      ],
      unknowns: [
        "Substância, quantidade, horário e sintomas não foram informados ou validados.",
        "Não há avaliação clínica disponível neste atendimento técnico.",
      ],
      customerScript:
        "Esse relato pode indicar uma emergência de saúde, não um problema de internet. Vamos interromper o atendimento técnico e buscar ajuda adequada agora. Se houver risco imediato, ligue para o SAMU 192; para orientação sobre intoxicação, ligue para o Disque-Intoxicação 0800 722 6001.",
      escalation:
        "Fora do fluxo N1/NOC: priorizar atendimento de saúde e não classificar o relato como falha de rede.",
      model: "fallback",
    },
    model: "fallback",
  };
}

function buildDeepAnalysis(
  profile: SupportProfile,
  message: string,
  model: "openai" | "fallback",
): N1DeepAnalysis {
  const group = profile.activeIncidents[0];
  const causes: N1DeepAnalysis["causes"] = [];
  const addCause = (cause: N1DeepAnalysis["causes"][number]) => {
    if (
      causes.some((item) => normalize(item.title) === normalize(cause.title))
    ) {
      return;
    }
    causes.push(cause);
  };
  const confidence = normalize(profile.decision.confidence);
  const opticalValue = profile.metrics.optical_rx_min_dbm;

  if (group) {
    addCause({
      title: `Incidente ativo: ${group.title}`,
      likelihood: "alta",
      evidence: [
        `O cliente está no escopo ${group.scope.identifier ?? "do incidente"}.`,
        `${group.affectedCpes.toLocaleString("pt-BR")} CPEs aparecem no mesmo problema.`,
        `O NOC registrou a hipótese: ${group.probableCause}`,
      ],
      counterEvidence: [
        "O incidente explica a correlação, mas não confirma sozinho a experiência atual do cliente.",
      ],
    });
  }

  addCause({
    title: profile.decision.issue,
    likelihood: confidence.includes("alta") ? "alta" : "média",
    evidence: profile.decision.reasons.slice(0, 3),
    counterEvidence: group
      ? [
          "Há um incidente coletivo prioritário que deve ser validado antes de concluir uma causa individual.",
        ]
      : ["Ainda é necessário confirmar o sintoma atual com o cliente."],
  });

  if (opticalValue != null || profile.metrics.optical_low_days > 0) {
    addCause({
      title: "Degradação ou instabilidade no sinal óptico",
      likelihood:
        opticalValue != null && opticalValue < -27 ? "média" : "baixa",
      evidence: [
        opticalValue == null
          ? `${profile.metrics.optical_low_days} dia(s) com sinal óptico abaixo do limite.`
          : `Menor leitura óptica registrada: ${opticalValue} dBm.`,
      ],
      counterEvidence:
        opticalValue != null && opticalValue >= -27
          ? ["A leitura disponível não está abaixo do limite de referência."]
          : [],
    });
  }

  if (
    profile.metrics.reboot_count > 0 ||
    (profile.metrics.mem_min_pct != null && profile.metrics.mem_min_pct < 15)
  ) {
    addCause({
      title: "Instabilidade da CPE ou do software",
      likelihood: "média",
      evidence: [
        profile.metrics.reboot_count > 0
          ? `${profile.metrics.reboot_count} reinício(s) foram observados.`
          : "A CPE apresentou pouca memória livre na janela consultada.",
        `Equipamento: ${profile.equipment.vendor} ${profile.equipment.model}, firmware ${profile.equipment.firmware}.`,
      ],
      counterEvidence: [
        "Os sinais não identificam, sozinhos, se a causa está na CPE ou na rede compartilhada.",
      ],
    });
  }

  const historyCount = profile.allTickets.length;
  const path: N1DeepAnalysis["path"] = [
    {
      step: 1,
      title: "Confirmar o sintoma atual",
      action:
        "Pergunte quando começou, se afeta todos os dispositivos e qual indicador do equipamento está aceso.",
      why: "Separa falha percebida em um dispositivo de indisponibilidade da conexão ou de um padrão coletivo.",
      decision:
        "Se outros dispositivos também falharem, trate como sinal de rede; se apenas um falhar, investigue o dispositivo ou o Wi-Fi local.",
    },
    {
      step: 2,
      title: group
        ? "Priorizar o incidente do NOC"
        : "Comparar com o histórico",
      action: group
        ? `Confira se o relato combina com ${group.incidentId} e mantenha o vínculo.`
        : `Compare o relato com os ${historyCount} chamado(s) e problema(s) já registrados.`,
      why: group
        ? "Existe uma correlação operacional mais forte do que uma hipótese isolada da CPE."
        : "Reincidência, categoria e resolução anterior ajudam a não repetir um teste que já falhou.",
      decision: group
        ? "Se o sintoma estiver no mesmo escopo, registre e encaminhe ao NOC sem prometer prazo."
        : "Se houver repetição sem resolução, aumente a prioridade da investigação em vez de encerrar por orientação genérica.",
    },
    {
      step: 3,
      title: "Executar somente uma verificação segura",
      action:
        profile.decision.action === "resolver_telefone"
          ? "Peça um teste simples próximo ao equipamento e confirme navegação em um dispositivo."
          : "Peça apenas observação de LEDs, teste em outro dispositivo e confirmação visual dos cabos; não remova conectores.",
      why: "A resposta do cliente reduz a incerteza sem criar risco ou alterar a rede remotamente.",
      decision:
        "Se o teste normalizar, confirme estabilidade; se não, preserve o relato e avance para o destino indicado.",
    },
    {
      step: 4,
      title: "Escolher o destino",
      action: profile.decision.actionLabel,
      why: "A decisão combina a hipótese atual, o histórico e a necessidade de investigação fora do N1.",
      decision: profile.preflight.escalation.required
        ? "Escalar para o NOC ou visita conforme a evidência, mantendo a causa como provável até confirmação técnica."
        : "Resolver por telefone somente depois de o cliente confirmar que o sintoma acabou.",
    },
    {
      step: 5,
      title: "Registrar a evidência",
      action:
        "Documente o que o cliente relatou, o teste realizado e o resultado observado.",
      why: "O próximo time precisa receber fatos verificáveis, não apenas a conclusão do atendente.",
      decision:
        "Se permanecer inconclusivo, deixe a lacuna explícita para a próxima equipe.",
    },
  ];

  return {
    headline: group
      ? `Há um caminho coletivo prioritário em ${group.incidentId}.`
      : `A hipótese principal é ${profile.decision.issue}.`,
    summary: `A leitura cruza equipamento, topologia, medições, ${historyCount} chamado(s) e ${profile.problemHistory.length} problema(s) relacionado(s). Use-a como roteiro de investigação, não como confirmação automática da causa.`,
    causes: causes.slice(0, 4),
    path,
    confirmed: [
      `CPE ${profile.equipment.serial} associada a ${profile.equipment.network}.`,
      `${profile.preflight.infrastructureChecked ? "Infraestrutura consultada" : "Infraestrutura não confirmada"}.`,
      `${profile.preflight.measurementsChecked ? "Medições recentes consultadas" : "Medições não disponíveis"}.`,
      group
        ? `Incidente ativo alcança este cliente: ${group.incidentId}.`
        : "Nenhum agrupamento ativo foi encontrado no escopo do cliente.",
    ],
    unknowns: [
      "A telemetria não é um ping em tempo real e não substitui a confirmação com o cliente.",
      "A causa física só pode ser confirmada após validação técnica compatível com o escopo.",
      message.trim()
        ? `O relato mais recente ainda precisa ser comparado com o estado atual: ${message.trim().slice(0, 160)}.`
        : "Ainda falta o relato atual do cliente para fechar a decisão.",
    ],
    customerScript: group
      ? "Já existe uma ocorrência na mesma região ou caminho de rede. Vou registrar o seu relato e encaminhar o caso para a equipe técnica acompanhar a causa sem fazer você repetir todos os testes."
      : profile.decision.sayToCustomer,
    escalation: profile.preflight.escalation.required
      ? `Encaminhar para ${profile.preflight.escalation.target ?? "a equipe técnica"} se o sintoma persistir, se houver padrão coletivo ou se a evidência exigir investigação fora do N1.`
      : "Acompanhar pelo N1 e resolver por telefone somente após confirmação explícita de estabilidade.",
    model,
  };
}

function parseDeepAnalysis(value: unknown): N1DeepAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const likelihoods = new Set(["alta", "média", "baixa"]);
  const causes = Array.isArray(candidate.causes)
    ? candidate.causes.filter(
        (item): item is N1DeepAnalysis["causes"][number] => {
          if (!item || typeof item !== "object") return false;
          const cause = item as Record<string, unknown>;
          return (
            typeof cause.title === "string" &&
            typeof cause.likelihood === "string" &&
            likelihoods.has(cause.likelihood) &&
            Array.isArray(cause.evidence) &&
            Array.isArray(cause.counterEvidence)
          );
        },
      )
    : [];
  const path = Array.isArray(candidate.path)
    ? candidate.path.filter((item): item is N1DeepAnalysis["path"][number] => {
        if (!item || typeof item !== "object") return false;
        const step = item as Record<string, unknown>;
        return (
          typeof step.step === "number" &&
          typeof step.title === "string" &&
          typeof step.action === "string" &&
          typeof step.why === "string" &&
          typeof step.decision === "string"
        );
      })
    : [];
  const strings = (input: unknown) =>
    Array.isArray(input)
      ? input.filter((item): item is string => typeof item === "string")
      : [];
  if (
    typeof candidate.headline !== "string" ||
    typeof candidate.summary !== "string" ||
    causes.length === 0 ||
    path.length < 3 ||
    typeof candidate.customerScript !== "string" ||
    typeof candidate.escalation !== "string"
  ) {
    return null;
  }
  return {
    headline: candidate.headline.trim().slice(0, 240),
    summary: candidate.summary.trim().slice(0, 800),
    causes: causes.slice(0, 4).map((cause) => ({
      title: cause.title.trim().slice(0, 180),
      likelihood: cause.likelihood,
      evidence: strings(cause.evidence).slice(0, 4),
      counterEvidence: strings(cause.counterEvidence).slice(0, 3),
    })),
    path: path.slice(0, 6).map((step) => ({
      step: step.step,
      title: step.title.trim().slice(0, 120),
      action: step.action.trim().slice(0, 300),
      why: step.why.trim().slice(0, 300),
      decision: step.decision.trim().slice(0, 300),
    })),
    confirmed: strings(candidate.confirmed).slice(0, 6),
    unknowns: strings(candidate.unknowns).slice(0, 6),
    customerScript: candidate.customerScript.trim().slice(0, 600),
    escalation: candidate.escalation.trim().slice(0, 500),
    model: "openai",
  };
}

function validateReply(value: unknown): N1AdvisorReply | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const dispositions = new Set([
    "continue",
    "resolve_phone",
    "escalate_noc",
    "schedule_visit",
  ]);
  if (
    typeof candidate.assistantMessage !== "string" ||
    !Array.isArray(candidate.nextSteps) ||
    !Array.isArray(candidate.options) ||
    typeof candidate.documentation !== "string" ||
    typeof candidate.disposition !== "string" ||
    !dispositions.has(candidate.disposition)
  ) {
    return null;
  }
  const nextSteps = candidate.nextSteps.filter(
    (item): item is string =>
      typeof item === "string" && item.trim().length > 0,
  );
  const options = candidate.options.filter((item): item is N1AdvisorOption => {
    if (!item || typeof item !== "object") return false;
    const option = item as Record<string, unknown>;
    return (
      typeof option.id === "string" &&
      typeof option.label === "string" &&
      typeof option.description === "string"
    );
  });
  const deepAnalysis = parseDeepAnalysis(candidate.deepAnalysis);
  if (nextSteps.length === 0 || nextSteps.length > 4 || !deepAnalysis) {
    return null;
  }
  return {
    assistantMessage: candidate.assistantMessage.trim().slice(0, 1_200),
    nextSteps: nextSteps.slice(0, 4).map((item) => item.trim()),
    options: options.slice(0, 3),
    documentation: candidate.documentation.trim().slice(0, 600),
    disposition: candidate.disposition as N1AdvisorReply["disposition"],
    deepAnalysis,
    model: "openai",
  };
}

function contextForPrompt(profile: SupportProfile) {
  return {
    customer: profile.customer,
    equipment: profile.equipment,
    calculatedDecision: profile.decision,
    preflight: profile.preflight,
    problemHistory: profile.problemHistory,
    activeNocGroupings: profile.activeIncidents,
    recentTickets: profile.recentTickets,
    allTickets: profile.allTickets,
  };
}

function fallbackReply(
  profile: SupportProfile,
  message: string,
): N1AdvisorReply {
  const normalized = normalize(message);
  const group = profile.activeIncidents[0];
  const optical =
    normalize(profile.decision.issue).includes("sinal optico") ||
    normalize(profile.decision.issue).includes("fibra");
  const collective = [
    "todos",
    "outro aparelho",
    "outros aparelhos",
    "vizinho",
    "vizinhos",
    "tambem",
    "nao conecta",
  ].some((term) => normalized.includes(term));
  const resolved = [
    "funcionou",
    "normalizou",
    "resolveu",
    "voltou",
    "agora esta normal",
  ].some((term) => normalized.includes(term));

  if (resolved) {
    return {
      assistantMessage:
        "Ótimo, o cliente informou que o sintoma foi resolvido. Confirme se a navegação continua normal e registre o teste realizado antes de encerrar o atendimento.",
      nextSteps: [
        "Confirmar navegação em pelo menos um dispositivo.",
        "Documentar o que foi orientado e o resultado informado pelo cliente.",
      ],
      options: [
        {
          id: "confirm_close",
          label: "Confirmar e resolver por telefone",
          description:
            "Usar quando o cliente confirmar que a conexão voltou ao normal.",
        },
        {
          id: "keep_open",
          label: "Ainda há sintoma",
          description: "Continuar a coleta sem encerrar o chamado.",
        },
      ],
      documentation: `${profile.decision.issue}. Cliente informou melhora após a orientação do N1; confirmar estabilidade antes de resolver.`,
      disposition: "resolve_phone",
      deepAnalysis: buildDeepAnalysis(profile, message, "fallback"),
      model: "fallback",
    };
  }

  if (collective && group) {
    return {
      assistantMessage: `A resposta reforça o agrupamento ativo ${group.incidentId} (${group.title}), que já alcança este cliente. Não repita testes avançados: registre o relato e encaminhe o chamado ao NOC para atuação coletiva.`,
      nextSteps: [
        `Registrar que o sintoma também afeta ${normalized.includes("vizinh") ? "outros clientes" : "mais de um dispositivo"}.`,
        `Vincular o chamado ao agrupamento ${group.incidentId}.`,
        "Informar ao cliente que a equipe técnica está verificando a área.",
      ],
      options: [
        {
          id: "escalate_group",
          label: "Escalar ao NOC",
          description: "Enviar o relato com o agrupamento já identificado.",
        },
        {
          id: "ask_led",
          label: "Confirmar LED LOS",
          description:
            "Pedir apenas a observação visual do indicador, sem intervenção técnica.",
        },
      ],
      documentation: `${group.title}. Cliente confirmou sintoma coletivo durante a ligação; encaminhar ao NOC e manter o vínculo ${group.incidentId}.`,
      disposition: "escalate_noc",
      deepAnalysis: buildDeepAnalysis(profile, message, "fallback"),
      model: "fallback",
    };
  }

  if (
    optical ||
    normalized.includes("los") ||
    normalized.includes("vermelho")
  ) {
    return {
      assistantMessage:
        "O relato é compatível com o sinal óptico já observado no equipamento. Peça ao cliente para informar apenas a cor do LED LOS e se o cabo óptico aparenta estar conectado, sem remover conectores.",
      nextSteps: [
        "Confirmar a cor do LED LOS.",
        "Confirmar visualmente se o cabo está conectado e sem dobra acentuada.",
        "Se o sinal continuar fora da faixa, recomendar visita técnica.",
      ],
      options: [
        {
          id: "los_red",
          label: "LED LOS vermelho",
          description:
            "Indica perda de sinal e reforça a necessidade de visita ou escalonamento.",
        },
        {
          id: "los_off",
          label: "LED LOS apagado",
          description:
            "Continuar a investigação sem concluir causa física ainda.",
        },
      ],
      documentation: `${profile.decision.issue}. Cliente relatou ${message.trim().slice(0, 220)}. Solicitar visita se o LED LOS estiver vermelho ou o sinal permanecer degradado.`,
      disposition: "schedule_visit",
      deepAnalysis: buildDeepAnalysis(profile, message, "fallback"),
      model: "fallback",
    };
  }

  return {
    assistantMessage: `O provável problema continua sendo: ${profile.decision.issue}. Para escolher o próximo passo, peça ao cliente para testar ${profile.decision.action === "resolver_telefone" ? "a conexão próximo ao roteador, preferencialmente em 5 GHz" : "a conexão em outro dispositivo e informar se o sintoma permanece"}.`,
    nextSteps: [
      profile.decision.operatorSteps[0] ??
        "Confirmar quando o sintoma começou.",
      "Registrar a resposta do cliente antes de decidir o encaminhamento.",
    ],
    options: [
      {
        id: "still_present",
        label: "O problema continua",
        description: "Manter o caso aberto e avaliar escalonamento ou visita.",
      },
      {
        id: "customer_tested",
        label: "Cliente testou e melhorou",
        description:
          "Confirmar estabilidade e considerar resolução por telefone.",
      },
    ],
    documentation: `${profile.decision.issue}. Relato recebido do cliente: ${message.trim().slice(0, 260)}`,
    disposition:
      profile.decision.action === "resolver_telefone"
        ? "resolve_phone"
        : profile.decision.action === "agendar_visita"
          ? "schedule_visit"
          : "escalate_noc",
    deepAnalysis: buildDeepAnalysis(profile, message, "fallback"),
    model: "fallback",
  };
}

@Injectable()
export class N1AdvisorService {
  private readonly apiKey = process.env.OPENAI_API_KEY?.trim();
  private readonly model = process.env.OPENAI_MODEL?.trim() || "gpt-6-luna";

  constructor(private readonly customers: CustomersService) {}

  async chat(
    customerId: string,
    message: string,
    history: N1ChatMessage[] = [],
  ): Promise<N1AdvisorReply> {
    const profile = await this.customers.getSupportProfile(customerId);
    const cleanedMessage = message.trim().slice(0, 600);
    if (!cleanedMessage) return fallbackReply(profile, "");

    if (isUrgentHealthReport(cleanedMessage)) {
      return urgentHealthReply(profile, cleanedMessage);
    }

    if (this.apiKey) {
      try {
        const openai = new OpenAI({ apiKey: this.apiKey, maxRetries: 0 });
        const request: ResponseCreateParamsNonStreaming = {
          model: this.model,
          instructions,
          input: JSON.stringify({
            context: contextForPrompt(profile),
            conversation: [
              ...history.slice(-8),
              { role: "user", content: cleanedMessage },
            ],
          }),
          max_output_tokens: 2_200,
          reasoning: { effort: "none", context: "current_turn" },
          store: false,
          text: {
            verbosity: "low",
            format: {
              type: "json_schema",
              name: "ondaluz_n1_advisor_reply",
              description:
                "Próximo passo seguro e documentável para o atendimento N1.",
              strict: true,
              schema: replySchema,
            },
          },
        };
        const response = await openai.responses.create(request);
        const parsed = validateReply(JSON.parse(response.output_text));
        if (parsed) return parsed;
      } catch {
        // O atendimento continua com a orientação determinística e auditável.
      }
    }

    return fallbackReply(profile, cleanedMessage);
  }
}
