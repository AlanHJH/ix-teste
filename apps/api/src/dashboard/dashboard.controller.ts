import { Body, Controller, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { ApiBody, ApiParam, ApiTags } from "@nestjs/swagger";
import {
  ApiInvalidRequest,
  ApiRead,
  ApiWrite,
  apiArray,
  apiDateTime,
  apiInteger,
  apiString,
} from "../openapi";
import {
  DashboardComposeDto,
  DashboardDefinitionDto,
  DashboardPreferenceDto,
} from "../contracts/input.dto";
import { DashboardIdParamDto, UserIdParamDto } from "../contracts/params.dto";
import { DashboardService } from "./dashboard.service";

const dashboardWidgetSchema = {
  type: "object" as const,
  description:
    "Bloco visual declarativo; não contém código executável nem dados operacionais.",
  properties: {
    id: apiString("Identificador estável do bloco.", "affected-cpes"),
    kind: {
      type: "string" as const,
      enum: [
        "metric",
        "timeseries",
        "bar",
        "pie",
        "multiseries",
        "alerts",
        "queue",
        "narrative",
        "table",
        "topology",
        "map",
      ],
      description: "Componente visual permitido.",
    },
    size: {
      type: "string" as const,
      enum: ["compact", "half", "wide"],
      description: "Classe semântica de tamanho.",
    },
    columns: {
      ...apiInteger("Largura na grade de 24 colunas.", 8),
      minimum: 4,
      maximum: 24,
    },
    title: apiString("Título curto exibido no painel."),
    description: apiString("Explicação do que o bloco apresenta."),
    binding: apiString(
      "Binding permitido que será abastecido pela API REST.",
      "overview.affectedCpes",
    ),
    tone: {
      type: "string" as const,
      enum: ["neutral", "positive", "warning", "critical"],
      description: "Tom visual do bloco.",
    },
    config: {
      type: "object" as const,
      description: "Limite de linhas e fórmula declarativa opcional.",
      required: ["limit", "formula"],
      properties: {
        limit: { type: "integer", enum: [5, 10, 15] },
        formula: {
          nullable: true,
          oneOf: [
            {
              type: "object",
              required: ["operation", "operands", "decimals", "suffix"],
              properties: {
                operation: {
                  type: "string",
                  enum: ["sum", "average", "difference", "ratio", "percentage"],
                },
                operands: {
                  type: "array",
                  minItems: 2,
                  maxItems: 5,
                  items: {
                    type: "string",
                    enum: [
                      "overview.activeCpes",
                      "overview.oltCount",
                      "overview.ponCount",
                      "overview.affectedCpes",
                      "overview.repeatCustomers",
                      "overview.ticketGrowthPct",
                      "overview.estimatedImpact",
                    ],
                  },
                },
                decimals: { type: "integer", enum: [0, 1, 2] },
                suffix: { type: "string", maxLength: 12 },
              },
            },
            { type: "null" },
          ],
        },
      },
    },
  },
  required: [
    "id",
    "kind",
    "size",
    "columns",
    "title",
    "description",
    "binding",
    "tone",
    "config",
  ],
};

const dashboardCompositionSchema = {
  type: "object" as const,
  description:
    "Plano completo e validado para renderização do dashboard dinâmico.",
  properties: {
    version: {
      type: "string" as const,
      enum: ["1.0"],
      description: "Versão do contrato do compositor.",
    },
    title: apiString("Título do dashboard."),
    subtitle: apiString("Contexto complementar."),
    refreshSeconds: apiInteger("Intervalo sugerido de atualização dos dados."),
    widgets: apiArray(dashboardWidgetSchema, "Blocos na ordem de exibição."),
    objective: apiString("Pedido original normalizado."),
    generatedAt: apiDateTime("Data e hora da composição em ISO 8601."),
    generatedBy: {
      type: "string" as const,
      enum: ["openai", "fallback"],
      description: "Motor que produziu o plano.",
    },
    model: {
      ...apiString("Modelo usado quando generatedBy é openai."),
      nullable: true,
    },
    discovery: {
      type: "object" as const,
      description:
        "Bridge MCP, documento OpenAPI e quantidade de rotas REST usadas no planejamento.",
      required: ["protocol", "mode", "resourceCount", "endpoint", "document"],
      properties: {
        protocol: { type: "string", enum: ["MCP", "OpenAPI"] },
        mode: {
          type: "string",
          enum: ["openapi-bridge", "contract-only", "catalog-only"],
        },
        resourceCount: apiInteger("Quantidade de recursos/rotas descobertos."),
        toolCount: { type: "integer", nullable: true },
        endpoint: {
          ...apiString("Endpoint MCP de descoberta."),
          nullable: true,
        },
        document: apiString(
          "Documento de contrato usado na descoberta.",
          "/api/openapi.json",
        ),
      },
    },
    runtimeData: {
      type: "object" as const,
      description: "Endpoints REST que alimentam os bindings no navegador.",
      required: ["protocol", "endpoints"],
      properties: {
        protocol: { type: "string", enum: ["REST"] },
        endpoints: {
          type: "array",
          items: apiString("Rota REST consumida pelo navegador."),
        },
      },
    },
  },
  required: [
    "version",
    "title",
    "subtitle",
    "refreshSeconds",
    "widgets",
    "objective",
    "generatedAt",
    "generatedBy",
    "model",
    "discovery",
    "runtimeData",
  ],
};

const dashboardPreferenceSchema = {
  type: "object" as const,
  description: "Preferência persistida para um usuário local do dashboard.",
  properties: {
    composition: { ...dashboardCompositionSchema, nullable: true },
    updatedAt: {
      ...apiDateTime("Última alteração em ISO 8601."),
      nullable: true,
    },
  },
  required: ["composition", "updatedAt"],
};

const dashboardDefinitionSchema = {
  type: "object" as const,
  properties: {
    dashboardId: apiString("Identificador estável do dashboard."),
    userId: apiString("Usuário proprietário."),
    name: apiString("Nome exibido no seletor."),
    description: apiString("Descrição curta do dashboard."),
    isDefault: { type: "boolean" },
    composition: dashboardCompositionSchema,
    createdAt: apiDateTime("Criação em ISO 8601."),
    updatedAt: apiDateTime("Última alteração em ISO 8601."),
  },
  required: [
    "dashboardId",
    "userId",
    "name",
    "description",
    "isDefault",
    "composition",
    "createdAt",
    "updatedAt",
  ],
};

const dashboardSummarySchema = {
  type: "object" as const,
  properties: {
    dashboardId: apiString("Identificador estável do dashboard."),
    userId: apiString("Usuário proprietário."),
    name: apiString("Nome exibido no seletor."),
    description: apiString("Descrição curta do dashboard."),
    isDefault: { type: "boolean" },
    createdAt: apiDateTime("Criação em ISO 8601."),
    updatedAt: apiDateTime("Última alteração em ISO 8601."),
  },
  required: [
    "dashboardId",
    "userId",
    "name",
    "description",
    "isDefault",
    "createdAt",
    "updatedAt",
  ],
};

const dashboardLibrarySchema = {
  type: "object" as const,
  properties: {
    data: apiArray(dashboardSummarySchema, "Dashboards disponíveis."),
    defaultDashboardId: {
      ...apiString("Dashboard selecionado por padrão."),
      nullable: true,
    },
  },
  required: ["data", "defaultDashboardId"],
};

@ApiTags("Dashboard dinâmico")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboards: DashboardService) {}

  @ApiRead({
    summary: "Compor um dashboard dinâmico",
    description:
      "Transforma um objetivo textual em um plano visual validado. O compositor descobre contratos REST pelo OpenAPI, mas não recebe dados operacionais; o navegador busca os dados depois pelos bindings permitidos.",
    responseDescription: "Composição pronta para renderização.",
    schema: dashboardCompositionSchema,
    created: true,
  })
  @ApiBody({
    description: "Objetivo e, opcionalmente, o plano atual a ser evoluído.",
    schema: {
      type: "object",
      required: ["objective"],
      properties: {
        objective: apiString(
          "Pedido entre 8 e 600 caracteres.",
          "Monte um painel para acompanhar falhas coletivas e fila do NOC.",
        ),
        currentPlan: {
          type: "object",
          description: "Plano 1.0 atual para edição incremental.",
        },
        targetWidgetId: apiString(
          "ID do único bloco a alterar; exige currentPlan.",
        ),
      },
    },
  })
  @ApiInvalidRequest("Objetivo, plano atual ou bloco selecionado inválido.")
  @Post("compose")
  compose(@Body() body: DashboardComposeDto) {
    return this.dashboards.compose(body);
  }

  @ApiRead({
    summary: "Obter preferência de dashboard",
    description:
      "Recupera a composição salva para um identificador local de usuário. Quando não há preferência, composition e updatedAt são nulos.",
    responseDescription: "Preferência atual ou resposta vazia.",
    schema: dashboardPreferenceSchema,
  })
  @ApiParam({
    name: "userId",
    description:
      "Identificador em minúsculas, números e hífen, com 2 a 64 caracteres.",
    example: "noc-alan",
  })
  @ApiInvalidRequest("Identificador de usuário inválido.")
  @Get("preferences/:userId")
  preference(@Param() params: UserIdParamDto) {
    return this.dashboards.getPreference(params.userId);
  }

  @ApiWrite({
    summary: "Salvar preferência de dashboard",
    description:
      "Valida e persiste uma composição completa para o usuário. Uma gravação posterior substitui a preferência anterior do mesmo identificador.",
    responseDescription: "Preferência validada e horário de atualização.",
    schema: dashboardPreferenceSchema,
  })
  @ApiParam({
    name: "userId",
    description:
      "Identificador em minúsculas, números e hífen, com 2 a 64 caracteres.",
    example: "noc-alan",
  })
  @ApiBody({
    description: "Composição completa devolvida anteriormente pelo compositor.",
    schema: {
      type: "object",
      required: ["composition"],
      properties: { composition: dashboardCompositionSchema },
    },
  })
  @ApiInvalidRequest("Identificador ou composição inválida.")
  @Put("preferences/:userId")
  savePreference(
    @Param() params: UserIdParamDto,
    @Body() body: DashboardPreferenceDto,
  ) {
    return this.dashboards.savePreference(params.userId, body.composition);
  }

  @ApiRead({
    summary: "Listar dashboards do usuário",
    description:
      "Retorna o catálogo de dashboards disponíveis para o seletor da aba de dashboard.",
    responseDescription: "Dashboards e seleção padrão.",
    schema: dashboardLibrarySchema,
  })
  @ApiParam({ name: "userId", example: "noc-alan" })
  @ApiInvalidRequest("Identificador de usuário inválido.")
  @Get("dashboards/:userId")
  listDashboards(@Param() params: UserIdParamDto) {
    return this.dashboards.listDashboards(params.userId);
  }

  @ApiRead({
    summary: "Obter um dashboard do catálogo",
    description:
      "Recupera a composição completa de um dashboard escolhido no seletor.",
    responseDescription: "Dashboard completo e composição validada.",
    schema: dashboardDefinitionSchema,
  })
  @ApiParam({ name: "userId", example: "noc-alan" })
  @ApiParam({
    name: "dashboardId",
    example: "dash-8d31f1b7-2a4a-4c9e-8dc9-0a0a67ec7d7d",
  })
  @ApiInvalidRequest("Identificador de usuário ou dashboard inválido.")
  @Get("dashboards/:userId/:dashboardId")
  getDashboard(@Param() params: DashboardIdParamDto) {
    return this.dashboards.getDashboard(params.userId, params.dashboardId);
  }

  @ApiWrite({
    summary: "Criar um dashboard",
    description:
      "Persiste uma composição validada no catálogo do usuário. O primeiro dashboard vira o padrão automaticamente.",
    responseDescription: "Dashboard criado.",
    schema: dashboardDefinitionSchema,
    created: true,
  })
  @ApiParam({ name: "userId", example: "noc-alan" })
  @ApiBody({
    description: "Nome, descrição e composição do novo dashboard.",
    schema: {
      type: "object",
      required: ["name", "composition"],
      properties: {
        name: apiString("Nome exibido no seletor."),
        description: apiString(
          "Descrição curta.",
          "Fila e incidentes críticos.",
        ),
        composition: dashboardCompositionSchema,
        isDefault: { type: "boolean" },
      },
    },
  })
  @ApiInvalidRequest("Nome, composição ou identificador inválido.")
  @Post("dashboards/:userId")
  createDashboard(
    @Param() params: UserIdParamDto,
    @Body() body: DashboardDefinitionDto,
  ) {
    return this.dashboards.createDashboard(params.userId, body);
  }

  @ApiWrite({
    summary: "Salvar um dashboard",
    description:
      "Atualiza nome, descrição e composição de um dashboard existente.",
    responseDescription: "Dashboard atualizado.",
    schema: dashboardDefinitionSchema,
  })
  @ApiParam({ name: "userId", example: "noc-alan" })
  @ApiParam({
    name: "dashboardId",
    example: "dash-8d31f1b7-2a4a-4c9e-8dc9-0a0a67ec7d7d",
  })
  @ApiBody({
    description: "Dados completos do dashboard.",
    schema: {
      type: "object",
      required: ["name", "composition"],
      properties: {
        name: apiString("Nome exibido no seletor."),
        description: apiString("Descrição curta."),
        composition: dashboardCompositionSchema,
        isDefault: { type: "boolean" },
      },
    },
  })
  @ApiInvalidRequest("Dashboard, nome ou composição inválida.")
  @Put("dashboards/:userId/:dashboardId")
  saveDashboard(
    @Param() params: DashboardIdParamDto,
    @Body() body: DashboardDefinitionDto,
  ) {
    return this.dashboards.saveDashboard(
      params.userId,
      params.dashboardId,
      body,
    );
  }

  @ApiWrite({
    summary: "Definir dashboard padrão",
    description:
      "Seleciona qual dashboard será aberto por padrão para o usuário.",
    responseDescription: "Dashboard padrão atualizado.",
    schema: dashboardDefinitionSchema,
  })
  @ApiParam({ name: "userId", example: "noc-alan" })
  @ApiParam({
    name: "dashboardId",
    example: "dash-8d31f1b7-2a4a-4c9e-8dc9-0a0a67ec7d7d",
  })
  @ApiInvalidRequest("Dashboard ou identificador inválido.")
  @Patch("dashboards/:userId/:dashboardId/default")
  setDefaultDashboard(@Param() params: DashboardIdParamDto) {
    return this.dashboards.setDefaultDashboard(
      params.userId,
      params.dashboardId,
    );
  }
}
