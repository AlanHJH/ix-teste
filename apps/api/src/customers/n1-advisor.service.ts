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

export type N1AdvisorReply = {
  assistantMessage: string;
  nextSteps: string[];
  options: N1AdvisorOption[];
  documentation: string;
  disposition: "continue" | "resolve_phone" | "escalate_noc" | "schedule_visit";
  model: "openai" | "fallback";
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
  },
  required: [
    "assistantMessage",
    "nextSteps",
    "options",
    "documentation",
    "disposition",
  ],
} as const;

const instructions = `Você é o copiloto de atendimento N1 da Ondaluz. Você ajuda o atendente durante uma ligação curta, usando apenas o contexto fornecido: equipamento do cliente, sinais técnicos já calculados, chamados recentes e agrupamentos ativos confirmados pelo NOC.

Regras:
- explique primeiro o provável problema em linguagem simples e deixe claro quando ainda for uma hipótese;
- faça no máximo uma pergunta ou solicitação segura por vez, adequada para um atendente pedir ao cliente por telefone;
- ofereça até três opções de próximo passo, como confirmar LEDs, testar perto do roteador, informar se outros dispositivos falham, escalar ao NOC ou agendar visita;
- não peça senha, código de autenticação, dados pessoais desnecessários ou qualquer ação perigosa;
- não declare que reiniciou, corrigiu, escalou ou agendou algo: apenas recomende a ação e deixe a decisão com o atendente;
- se existir um agrupamento ativo do NOC que alcance o cliente, trate-o como contexto prioritário e explique o que ele muda no atendimento;
- registre uma documentação curta, pronta para o campo de relato do chamado, sem inventar fatos;
- escolha disposition=resolve_phone somente quando a resposta indicar que o sintoma foi resolvido ou que a orientação telefônica foi suficiente; use escalate_noc para padrão coletivo ou investigação; use schedule_visit para evidência de sinal físico ou falha persistente que exige campo; caso contrário, continue.`;

function normalize(value: string): string {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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
  if (nextSteps.length === 0 || nextSteps.length > 4) return null;
  return {
    assistantMessage: candidate.assistantMessage.trim().slice(0, 1_200),
    nextSteps: nextSteps.slice(0, 4).map((item) => item.trim()),
    options: options.slice(0, 3),
    documentation: candidate.documentation.trim().slice(0, 600),
    disposition: candidate.disposition as N1AdvisorReply["disposition"],
    model: "openai",
  };
}

function contextForPrompt(profile: SupportProfile) {
  return {
    customer: profile.customer,
    equipment: profile.equipment,
    calculatedDecision: profile.decision,
    activeNocGroupings: profile.activeIncidents,
    recentTickets: profile.recentTickets,
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
          max_output_tokens: 900,
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
