import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBody,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { InvestigationsService } from "./investigations.service";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  ApiWrite,
  apiArray,
  apiDateTime,
  apiErrorSchema,
  apiInteger,
  apiPageSchema,
  apiString,
} from "../openapi";
import {
  ManualInvestigationDto,
  ReviewInvestigationDto,
} from "../contracts/input.dto";
import {
  IncidentIdParamDto,
  InvestigationIdParamDto,
} from "../contracts/params.dto";
import { InvestigationsListQueryDto } from "../contracts/query.dto";

const investigationSchema = {
  type: "object" as const,
  description:
    "Execução auditável do agente de investigação, incluindo entrada, estado, resultado e rastreio de ferramentas MCP.",
  properties: {
    investigation_id: apiString(
      "Identificador da investigação.",
      "INV-5D2F24A1",
    ),
    dedup_key: apiString(
      "Chave usada para impedir execuções automáticas duplicadas.",
    ),
    trigger_type: {
      type: "string" as const,
      enum: ["metric", "schedule", "manual"],
      description: "Origem do disparo.",
    },
    trigger_label: apiString("Rótulo legível da origem."),
    objective: apiString("Objetivo entregue ao agente."),
    scope: {
      type: "object" as const,
      description: "Escopo inicial da investigação.",
      additionalProperties: true,
    },
    status: {
      type: "string" as const,
      enum: [
        "queued",
        "running",
        "no_problem",
        "inconclusive",
        "pending_review",
        "approved",
        "rejected",
        "failed",
      ],
      description: "Estado atual do fluxo.",
    },
    model: { ...apiString("Modelo utilizado na análise."), nullable: true },
    openai_response_id: {
      ...apiString("ID da resposta para auditoria técnica."),
      nullable: true,
    },
    finding: {
      type: "object" as const,
      nullable: true,
      description: "Achado estruturado devolvido pelo agente.",
      required: [
        "analysisVersion",
        "problemDetected",
        "category",
        "title",
        "severity",
        "confidence",
        "scope",
        "affectedCpes",
        "summary",
        "probableCause",
        "recommendedAction",
        "evidence",
        "counterEvidence",
        "requiresHumanReview",
      ],
      properties: {
        analysisVersion: { type: "string", enum: ["1.0"] },
        problemDetected: { type: "boolean" },
        category: {
          type: "string",
          enum: [
            "optical_degradation",
            "firmware_regression",
            "capacity_mismatch",
            "individual_failure",
            "other",
            "no_problem",
            "inconclusive",
          ],
        },
        title: apiString("Título do achado."),
        severity: {
          type: "string",
          enum: ["critical", "high", "medium", "low"],
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        scope: { type: "object", description: "Escopo normalizado do achado." },
        affectedCpes: apiInteger("CPEs afetadas."),
        summary: apiString("Resumo do achado."),
        probableCause: apiString("Causa provável."),
        recommendedAction: apiString("Ação recomendada."),
        evidence: { type: "array", items: { type: "object" } },
        counterEvidence: { type: "array", items: { type: "object" } },
        requiresHumanReview: { type: "boolean", enum: [true] },
      },
    },
    tool_trace: apiArray(
      {
        type: "object",
        required: ["domain", "tool", "arguments", "outputPreview"],
        properties: {
          domain: apiString("Domínio MCP consultado."),
          tool: apiString("Ferramenta MCP chamada."),
          arguments: { type: "object", additionalProperties: true },
          outputPreview: apiString("Prévia sanitizada da saída."),
        },
      },
      "Ferramentas MCP chamadas, argumentos e prévias de saída.",
    ),
    error: { ...apiString("Erro terminal, quando houver."), nullable: true },
    created_at: apiDateTime("Criação em ISO 8601."),
    reviewed_by: {
      ...apiString("Operador responsável pela revisão."),
      nullable: true,
    },
    review_note: {
      ...apiString("Observação da revisão humana."),
      nullable: true,
    },
    incident_id: {
      ...apiString("Incidente criado após aprovação."),
      nullable: true,
    },
  },
  required: [
    "investigation_id",
    "dedup_key",
    "trigger_type",
    "trigger_label",
    "objective",
    "scope",
    "status",
    "model",
    "openai_response_id",
    "finding",
    "tool_trace",
    "error",
    "created_at",
    "reviewed_by",
    "review_note",
    "incident_id",
  ],
};

const triggerSummarySchema = {
  type: "object" as const,
  description:
    "Resumo de um disparo que pode enfileirar uma ou mais investigações.",
  properties: {
    candidates: apiInteger("Candidatos avaliados pelo detector.", 6),
    queued: apiInteger("Investigações novas ou existentes devolvidas.", 4),
    covered: apiInteger("Candidatos já cobertos por incidente ativo.", 2),
    investigations: apiArray(
      investigationSchema,
      "Investigações relacionadas ao disparo.",
    ),
  },
};

@ApiTags("Investigações IA")
@Controller("investigations")
export class InvestigationsController {
  constructor(private readonly investigations: InvestigationsService) {}

  @ApiRead({
    summary: "Listar investigações do agente",
    description:
      "Consulta o histórico paginado de investigações, com filtros de estado, resumo por status, configuração efetiva e incidentes aprovados relacionados.",
    responseDescription: "Página de investigações e metadados operacionais.",
    schema: apiPageSchema(investigationSchema, "Execuções do agente.", {
      type: "object",
      description: "Contexto adicional para a tela de revisão.",
      properties: {
        config: {
          type: "object",
          description: "Configuração não secreta efetiva.",
          additionalProperties: true,
        },
        summary: {
          type: "object",
          description: "Contagem de investigações por estado.",
          additionalProperties: { type: "integer" },
        },
        incidents: {
          type: "array",
          items: { type: "object", additionalProperties: true },
          description: "Incidentes recentes relacionados.",
        },
      },
      required: ["config", "summary", "incidents"],
    }),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["created_at_desc", "created_at_asc"],
    defaultSort: "created_at_desc",
    defaultPageSize: 100,
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Estado exato da investigação.",
    schema: {
      type: "string",
      enum: [
        "queued",
        "running",
        "no_problem",
        "inconclusive",
        "pending_review",
        "approved",
        "rejected",
        "failed",
      ],
    },
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get()
  list(@Query() params: InvestigationsListQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 100,
        defaultSort: "created_at_desc",
        allowedSorts: ["created_at_desc", "created_at_asc"],
      },
    );
    return this.investigations.list(
      pagination.page,
      pagination.pageSize,
      pagination.sort,
      params.status,
    );
  }

  @ApiRead({
    summary: "Obter configuração do agente",
    description:
      "Expõe somente parâmetros operacionais não secretos: disponibilidade do modelo, agendamento, concorrência, limites de contexto e exigência de aprovação humana.",
    responseDescription: "Configuração efetiva e salvaguardas do agente.",
    schema: {
      type: "object",
      properties: {
        openaiConfigured: {
          type: "boolean",
          description: "Indica se há credencial configurada, sem expô-la.",
        },
        model: apiString("Modelo selecionado."),
        mcpBaseUrl: apiString(
          "URL interna usada pelo agente para acessar o MCP.",
        ),
        scheduleEnabled: {
          type: "boolean",
          description: "Habilitação do disparo agendado.",
        },
        metricTriggerEnabled: {
          type: "boolean",
          description: "Habilitação do detector periódico.",
        },
        metricTriggerIntervalMs: apiInteger(
          "Intervalo entre verificações em milissegundos.",
        ),
        maxConcurrency: apiInteger("Máximo de investigações simultâneas."),
        groupingMaxCandidates: apiInteger("Máximo de candidatos por ciclo."),
        autoGroupingEnabled: {
          type: "boolean",
          description:
            "Indica se o backend pode ativar automaticamente propostas do detector de métricas acima do limiar configurado.",
        },
        autoGroupingMinConfidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description: "Confiança mínima para autoativação de um agrupamento.",
        },
        reasoningEffort: apiString("Esforço de raciocínio configurado."),
        openaiTimeoutMs: apiInteger(
          "Tempo máximo de uma chamada à OpenAI em milissegundos.",
        ),
        maxContextCharacters: apiInteger("Limite de caracteres do contexto."),
        toolCallBudgets: {
          type: "object",
          description: "Orçamentos de chamadas por domínio MCP.",
        },
        mcpPolicy: {
          type: "object",
          description:
            "Allowlist efetiva do agente de investigação, derivada do mesmo registro usado em execução.",
          properties: {
            endpointCount: apiInteger(
              "Quantidade de contextos MCP acessíveis ao agente.",
            ),
            toolCount: apiInteger(
              "Quantidade total de ferramentas permitidas ao agente.",
            ),
            domains: {
              type: "array",
              description: "Domínios e ferramentas liberados para consulta.",
              items: {
                type: "object",
                properties: {
                  domain: apiString("Nome do domínio MCP."),
                  tools: {
                    type: "array",
                    items: apiString("Nome da ferramenta permitida."),
                  },
                },
              },
            },
          },
        },
        humanApprovalRequired: {
          type: "boolean",
          description: "Confirma que achados não viram incidentes sem revisão.",
        },
        writeToolsAvailableToAgent: {
          type: "boolean",
          description:
            "Confirma que o agente não recebe ferramentas de escrita.",
        },
      },
    },
  })
  @Get("config")
  config() {
    return this.investigations.config();
  }

  @ApiRead({
    summary: "Obter uma investigação do agente",
    description:
      "Consulta o estado e o resultado estruturado de uma investigação específica para acompanhamento da análise sob demanda.",
    responseDescription: "Investigação auditável.",
    schema: investigationSchema,
  })
  @ApiParam({
    name: "investigationId",
    description: "Identificador da investigação.",
    example: "INV-5D2F24A1",
  })
  @ApiNotFoundResponse({
    description: "Investigação não encontrada.",
    schema: apiErrorSchema,
  })
  @Get(":investigationId")
  get(@Param() params: InvestigationIdParamDto) {
    return this.investigations.get(params.investigationId);
  }

  @ApiWrite({
    summary: "Analisar um problema de infraestrutura sob demanda",
    description:
      "Ao abrir um problema operacional, reutiliza a análise IA vinculada ou enfileira uma nova investigação focada em possibilidades de solução. A análise é somente leitura e exige revisão humana.",
    responseDescription: "Investigação vinculada ao problema.",
    schema: investigationSchema,
    created: true,
  })
  @ApiParam({
    name: "incidentId",
    description: "Identificador do problema de infraestrutura.",
    example: "INC-74F1FD96",
  })
  @ApiNotFoundResponse({
    description: "Problema de infraestrutura não encontrado.",
    schema: apiErrorSchema,
  })
  @ApiInvalidRequest(
    "O agente não está configurado para executar investigações.",
  )
  @Post("trigger/incident/:incidentId")
  triggerIncident(@Param() params: IncidentIdParamDto) {
    return this.investigations.triggerIncident(params.incidentId);
  }

  @ApiWrite({
    summary: "Disparar investigações por métricas",
    description:
      "Executa o detector de candidatos, ignora escopos já cobertos, deduplica investigações ativas e enfileira análises somente quando o agente está configurado. Se a autoativação estiver habilitada, o backend materializa apenas propostas de métricas que superem o limiar de confiança.",
    responseDescription: "Resumo dos candidatos e investigações enfileiradas.",
    schema: triggerSummarySchema,
    created: true,
  })
  @ApiInvalidRequest(
    "O agente não está configurado para executar investigações.",
  )
  @Post("trigger/metrics")
  triggerMetrics() {
    return this.investigations.triggerMetricCandidates();
  }

  @ApiWrite({
    summary: "Disparar investigações de agrupamentos",
    description:
      "Alias operacional do disparo por métricas, preservado para clientes que nomeiam o fluxo como detecção de agrupamentos.",
    responseDescription: "Resumo dos candidatos e investigações enfileiradas.",
    schema: triggerSummarySchema,
    created: true,
  })
  @ApiInvalidRequest(
    "O agente não está configurado para executar investigações.",
  )
  @Post("trigger/groupings")
  triggerGroupings() {
    return this.investigations.triggerMetricCandidates();
  }

  @ApiWrite({
    summary: "Disparar revisão programada do parque",
    description:
      "Enfileira uma investigação abrangente por janela horária, com deduplicação, para procurar problemas compartilhados ainda não cobertos.",
    responseDescription: "Investigação programada criada ou já existente.",
    schema: investigationSchema,
    created: true,
  })
  @ApiInvalidRequest(
    "O agente não está configurado para executar investigações.",
  )
  @Post("trigger/scheduled")
  triggerScheduled() {
    return this.investigations.triggerScheduled();
  }

  @ApiWrite({
    summary: "Disparar investigação manual",
    description:
      "Enfileira uma investigação com objetivo escrito pelo operador. O texto deve ter entre 10 e 600 caracteres e não concede ferramentas de escrita ao agente.",
    responseDescription: "Investigação manual enfileirada.",
    schema: investigationSchema,
    created: true,
  })
  @ApiBody({
    description: "Pergunta ou hipótese operacional.",
    schema: {
      type: "object",
      required: ["objective"],
      properties: {
        objective: apiString(
          "Objetivo de 10 a 600 caracteres.",
          "Investigue reinicializações recentes nas CPEs Kestrel.",
        ),
      },
    },
  })
  @ApiInvalidRequest("Objetivo inválido ou agente não configurado.")
  @Post("trigger/manual")
  triggerManual(@Body() body: ManualInvestigationDto) {
    return this.investigations.triggerManual(body.objective);
  }

  @ApiWrite({
    summary: "Reprocessar investigação com falha",
    description:
      "Limpa resultado e erro anteriores, retorna a investigação ao estado queued e reinicia o processamento. Somente registros em failed podem ser repetidos.",
    responseDescription: "Investigação reenfileirada.",
    schema: investigationSchema,
    created: true,
  })
  @ApiParam({
    name: "investigationId",
    description: "Identificador da investigação com falha.",
    example: "INV-5D2F24A1",
  })
  @ApiNotFoundResponse({
    description: "Investigação inexistente ou fora do estado failed.",
    schema: apiErrorSchema,
  })
  @Post(":investigationId/retry")
  retry(@Param() params: InvestigationIdParamDto) {
    return this.investigations.retry(params.investigationId);
  }

  @ApiWrite({
    summary: "Revisar achado de uma investigação",
    description:
      "Aprova ou rejeita uma proposta pending_review. Aprovar cria um incidente operacional com escopo recalculado; rejeitar preserva o registro auditável sem ação operacional.",
    responseDescription: "Investigação após a decisão humana.",
    schema: investigationSchema,
  })
  @ApiParam({
    name: "investigationId",
    description: "Identificador da investigação pendente.",
    example: "INV-5D2F24A1",
  })
  @ApiBody({
    description: "Decisão e identificação do revisor.",
    schema: {
      type: "object",
      required: ["decision", "reviewer"],
      properties: {
        decision: {
          type: "string",
          enum: ["approve", "reject"],
          description: "Decisão humana final.",
        },
        reviewer: apiString(
          "Responsável pela decisão, de 2 a 100 caracteres.",
          "noc-alan",
        ),
        note: apiString("Observação opcional de até 1.000 caracteres."),
      },
    },
  })
  @ApiInvalidRequest("Decisão, revisor, observação ou achado inválido.")
  @ApiNotFoundResponse({
    description: "Investigação inexistente ou fora de pending_review.",
    schema: apiErrorSchema,
  })
  @Patch(":investigationId/review")
  review(
    @Param() params: InvestigationIdParamDto,
    @Body() body: ReviewInvestigationDto,
  ) {
    return this.investigations.review(
      params.investigationId,
      body.decision,
      body.reviewer,
      body.note ?? "",
    );
  }
}
