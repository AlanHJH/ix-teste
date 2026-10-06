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
  apiErrorSchema,
  apiInteger,
  apiPageSchema,
  apiString,
} from "../openapi";

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
    },
    tool_trace: apiArray(
      { type: "object" },
      "Ferramentas MCP chamadas, argumentos e prévias de saída.",
    ),
    error: { ...apiString("Erro terminal, quando houver."), nullable: true },
    created_at: apiString("Criação em ISO 8601."),
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
        },
        summary: {
          type: "object",
          description: "Contagem de investigações por estado.",
        },
        incidents: {
          type: "array",
          items: { type: "object" },
          description: "Incidentes recentes relacionados.",
        },
      },
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
  list(
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "100",
    @Query("sort") sort = "created_at_desc",
    @Query("status") status = "",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultPageSize: 100,
      defaultSort: "created_at_desc",
      allowedSorts: ["created_at_desc", "created_at_asc"],
    });
    return this.investigations.list(
      pagination.page,
      pagination.pageSize,
      pagination.sort,
      status,
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
        reasoningEffort: apiString("Esforço de raciocínio configurado."),
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

  @ApiWrite({
    summary: "Disparar investigações por métricas",
    description:
      "Executa o detector de candidatos, ignora escopos já cobertos, deduplica investigações ativas e enfileira análises somente quando o agente está configurado.",
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
  triggerManual(@Body() body: { objective?: string }) {
    return this.investigations.triggerManual(body.objective ?? "");
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
  retry(@Param("investigationId") investigationId: string) {
    return this.investigations.retry(investigationId);
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
    @Param("investigationId") investigationId: string,
    @Body()
    body: {
      decision?: "approve" | "reject";
      reviewer?: string;
      note?: string;
    },
  ) {
    if (body.decision !== "approve" && body.decision !== "reject") {
      throw new BadRequestException("Decisão deve ser approve ou reject.");
    }
    return this.investigations.review(
      investigationId,
      body.decision,
      body.reviewer ?? "",
      body.note ?? "",
    );
  }
}
