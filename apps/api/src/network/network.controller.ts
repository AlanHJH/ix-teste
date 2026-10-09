import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  ApiWrite,
  apiArray,
  apiDate,
  apiErrorSchema,
  apiInteger,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";
import { paginate, parsePageQuery } from "../pagination";
import { ResolvedStatusDto } from "../contracts/input.dto";
import { GroupingIdParamDto } from "../contracts/params.dto";
import {
  NetworkDevicesQueryDto,
  NetworkIncidentsQueryDto,
  NetworkTopologyPathQueryDto,
  NetworkTopologyQueryDto,
} from "../contracts/query.dto";
import { NetworkService } from "./network.service";

const topologyDeviceSchema = {
  type: "object" as const,
  description: "CPE ativa e seu caminho lógico na rede de acesso.",
  properties: {
    serial: apiString("Serial da CPE.", "KSTLD199FB78"),
    customer_id: apiString("Código do cliente.", "C169781"),
    vendor: apiString("Fabricante.", "Kestrel"),
    model: apiString("Modelo.", "KX-3000"),
    hw_revision: apiString("Revisão de hardware.", "1.2"),
    software_version: apiString("Firmware atual.", "2.4.1"),
    plan_mbps: apiInteger("Velocidade contratada em Mbps.", 300),
    olt: apiString("OLT de atendimento.", "OLT-2"),
    pon: apiString("Porta PON.", "1/7"),
    cto: apiString("Caixa terminal óptica.", "CTO-2-17-03"),
    city: apiString("Cidade.", "Serra Alta"),
    neighborhood: apiString("Bairro.", "Jardim Aurora"),
    logical_drop_id: {
      ...apiString(
        "Identificador lógico estimado do drop.",
        "L-DROP-KSTLD199FB78",
      ),
      nullable: true,
    },
  },
  required: [
    "serial",
    "customer_id",
    "vendor",
    "model",
    "hw_revision",
    "software_version",
    "plan_mbps",
    "olt",
    "pon",
    "cto",
    "city",
    "neighborhood",
    "logical_drop_id",
  ],
};

const detectedIncidentSchema = {
  type: "object" as const,
  description: "Agrupamento calculado a partir de sinais correlacionados.",
  properties: {
    id: apiString("Identificador estável do agrupamento.", "pon-olt2-ja"),
    severity: {
      type: "string" as const,
      enum: ["critical", "high", "medium", "low"],
      description: "Severidade operacional.",
    },
    scope: {
      type: "string" as const,
      enum: ["firmware", "network", "equipment", "customer"],
      description: "Natureza predominante do agrupamento.",
    },
    title: apiString(
      "Título curto para triagem.",
      "Degradação coletiva na fibra",
    ),
    location: apiString("Recorte técnico ou geográfico afetado."),
    affected: apiInteger("Quantidade estimada de CPEs afetadas.", 42),
    score: apiInteger("Pontuação de prioridade entre 0 e 100.", 98),
    confidence: apiString("Confiança da correlação.", "Alta"),
    ruleVersion: apiString("Versão das regras determinísticas.", "detector-v2"),
    scoreComponents: {
      type: "object",
      description: "Componentes normalizados usados no score explicável.",
      additionalProperties: { type: "number" },
    },
    signal: apiString("Sinal dominante que originou o agrupamento."),
    evidence: apiArray(
      apiString("Evidência textual."),
      "Evidências correlacionadas.",
    ),
    recommendation: apiString("Próxima ação recomendada."),
    owner: apiString("Equipe responsável sugerida.", "Rede externa"),
    cost: apiNumber("Impacto financeiro estimado em reais.", 1320),
    costLabel: apiString("Explicação do cálculo de impacto."),
  },
  required: [
    "id",
    "severity",
    "scope",
    "title",
    "location",
    "affected",
    "score",
    "confidence",
    "signal",
    "evidence",
    "recommendation",
    "owner",
    "cost",
    "costLabel",
  ],
};

@ApiTags("Rede")
@Controller("network")
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @ApiRead({
    summary: "Obter visão executiva da rede",
    description:
      "Consolida KPIs do parque, série semanal de chamados, agrupamentos detectados e leitura executiva. É a fonte principal dos cards e gráficos do dashboard.",
    responseDescription: "Visão operacional consolidada.",
    dashboardResource: true,
    schema: {
      type: "object",
      properties: {
        asOf: apiDate(
          "Data mais recente disponível na telemetria.",
          "2026-08-09",
        ),
        kpis: {
          type: "object",
          description: "Indicadores consolidados do parque e do suporte.",
          properties: {
            activeCpes: apiInteger("CPEs ativas.", 1500),
            oltCount: apiInteger("OLTs com CPEs ativas.", 3),
            ponCount: apiInteger("Portas PON com CPEs ativas.", 24),
            ticketGrowthPct: apiNumber(
              "Variação percentual recente de chamados.",
              18,
            ),
            affectedCpes: apiInteger(
              "CPEs presentes em sinais de problema.",
              84,
            ),
            repeatCustomers: apiInteger(
              "Clientes reincidentes na janela analisada.",
              31,
            ),
            estimatedImpact: apiNumber(
              "Impacto financeiro estimado em reais.",
              18450,
            ),
          },
          required: [
            "activeCpes",
            "oltCount",
            "ponCount",
            "ticketGrowthPct",
            "affectedCpes",
            "repeatCustomers",
            "estimatedImpact",
          ],
        },
        weeklyTickets: apiArray(
          {
            type: "object",
            properties: {
              week: apiString("Início da semana no formato DD/MM.", "03/08"),
              total: apiInteger("Total de chamados na semana.", 135),
              slowness: apiInteger("Chamados de lentidão.", 54),
              disconnected: apiInteger("Chamados sem conexão.", 38),
              wifi: apiInteger("Chamados de Wi-Fi.", 43),
            },
            required: ["week", "total", "slowness", "disconnected", "wifi"],
          },
          "Série temporal semanal por categoria.",
        ),
        incidents: apiArray(
          detectedIncidentSchema,
          "Agrupamentos ainda ativos.",
        ),
        readout: {
          type: "object",
          description:
            "Síntese editorial baseada nas regras analíticas do sistema.",
          properties: {
            headline: apiString("Conclusão principal."),
            summary: apiString("Resumo das prioridades recomendadas."),
          },
          required: ["headline", "summary"],
        },
      },
      required: ["asOf", "kpis", "weeklyTickets", "incidents", "readout"],
    },
  })
  @Get("overview")
  overview() {
    return this.network.getOverview();
  }

  @ApiRead({
    summary: "Buscar caminho topológico por cliente ou serial",
    description:
      "Localiza CPEs ativas por código do cliente ou serial e devolve OLT, PON, CTO e localidade para navegação direta no mapa.",
    responseDescription: "Página de caminhos topológicos encontrados.",
    schema: apiPageSchema(
      topologyDeviceSchema,
      "Resultados da busca topológica.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["relevance", "customer_id_asc", "customer_id_desc", "serial_asc"],
    defaultSort: "relevance",
    defaultPageSize: 8,
  })
  @ApiQuery({
    name: "q",
    required: true,
    description:
      "Trecho do código do cliente ou serial; mínimo útil de dois caracteres.",
    example: "C169",
  })
  @ApiInvalidRequest("Busca, paginação ou ordenação inválida.")
  @Get("topology/path")
  async topologyPath(@Query() params: NetworkTopologyPathQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 8,
        defaultSort: "relevance",
        allowedSorts: [
          "relevance",
          "customer_id_asc",
          "customer_id_desc",
          "serial_asc",
        ],
      },
    );
    const result = await this.network.findTopologyPath(
      params.q,
      pagination.page,
      pagination.pageSize,
      pagination.sort,
    );
    return paginate(
      result.data,
      result.totalItems,
      pagination.page,
      pagination.pageSize,
    );
  }

  @ApiRead({
    summary: "Listar dispositivos de uma CTO",
    description:
      "Lista as CPEs ativas exatamente no ramo OLT/PON/CTO informado. Os três filtros são necessários para retornar dados.",
    responseDescription: "Página de dispositivos do ramo selecionado.",
    schema: apiPageSchema(topologyDeviceSchema, "CPEs da CTO selecionada."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["customer_id_asc", "customer_id_desc", "serial_asc"],
    defaultSort: "customer_id_asc",
    defaultPageSize: 100,
  })
  @ApiQuery({
    name: "olt",
    required: true,
    description: "OLT exata.",
    example: "OLT-2",
  })
  @ApiQuery({
    name: "pon",
    required: true,
    description: "Porta PON exata.",
    example: "1/7",
  })
  @ApiQuery({
    name: "cto",
    required: true,
    description: "CTO exata.",
    example: "CTO-2-17-03",
  })
  @ApiInvalidRequest("Escopo topológico, paginação ou ordenação inválida.")
  @Get("topology/devices")
  topologyDevices(@Query() params: NetworkDevicesQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultPageSize: 100,
        defaultSort: "customer_id_asc",
        allowedSorts: ["customer_id_asc", "customer_id_desc", "serial_asc"],
      },
    );
    return this.network
      .getTopologyDevices(
        params.olt,
        params.pon,
        params.cto,
        pagination.page,
        pagination.pageSize,
        pagination.sort,
      )
      .then((result) =>
        paginate(
          result.data,
          result.totalItems,
          pagination.page,
          pagination.pageSize,
        ),
      );
  }

  @ApiRead({
    summary: "Obter árvore da topologia de acesso",
    description:
      "Retorna totais do parque e os filhos do nível selecionado. Sem filtros lista OLTs; com OLT lista PONs; com OLT e PON lista CTOs. Também explicita limitações do dataset físico.",
    responseDescription: "Recorte navegável da topologia.",
    dashboardResource: true,
    schema: {
      type: "object",
      properties: {
        totals: {
          type: "object",
          description: "Totais de CPEs, OLTs, PONs e CTOs.",
          required: ["cpes", "olts", "pons", "ctos"],
          properties: {
            cpes: apiInteger("Total de CPEs ativas.", 1500),
            olts: apiInteger("Total de OLTs.", 3),
            pons: apiInteger("Total de PONs.", 24),
            ctos: apiInteger("Total de CTOs.", 120),
          },
        },
        olts: {
          type: "array",
          description: "OLTs e seus totais.",
          items: {
            type: "object",
            required: [
              "olt",
              "cpes",
              "pons",
              "ctos",
              "cities",
              "neighborhoods",
            ],
            properties: {
              olt: apiString("Identificador da OLT."),
              cpes: apiInteger("CPEs ativas na OLT."),
              pons: apiInteger("PONs usadas na OLT."),
              ctos: apiInteger("CTOs usadas na OLT."),
              cities: apiArray(apiString("Cidade."), "Cidades atendidas."),
              neighborhoods: apiArray(
                apiString("Bairro."),
                "Bairros atendidos.",
              ),
            },
          },
        },
        pons: {
          type: "array",
          description: "PONs da OLT selecionada.",
          items: {
            type: "object",
            required: ["pon", "cpes", "ctos"],
            properties: {
              pon: apiString("Identificador da PON."),
              cpes: apiInteger("CPEs ativas na PON."),
              ctos: apiInteger("CTOs usadas na PON."),
            },
          },
        },
        ctos: {
          type: "array",
          description: "CTOs da PON selecionada.",
          items: {
            type: "object",
            required: ["cto", "cpes", "city", "neighborhood"],
            properties: {
              cto: apiString("Identificador da CTO."),
              cpes: apiInteger("CPEs ativas na CTO."),
              city: apiString("Cidade."),
              neighborhood: apiString("Bairro."),
            },
          },
        },
        selected: {
          type: "object",
          description: "OLT e PON atualmente selecionadas.",
          required: ["olt", "pon"],
          properties: {
            olt: { ...apiString("OLT selecionada."), nullable: true },
            pon: { ...apiString("PON selecionada."), nullable: true },
          },
        },
        limitations: {
          type: "object",
          description: "Limitações conhecidas dos identificadores físicos.",
          required: [
            "hasCableIds",
            "hasDropIds",
            "hasLogicalDropIds",
            "message",
          ],
          properties: {
            hasCableIds: {
              type: "boolean",
              description: "Há IDs físicos de cabo.",
            },
            hasDropIds: {
              type: "boolean",
              description: "Há IDs físicos de drop.",
            },
            hasLogicalDropIds: {
              type: "boolean",
              description: "Há IDs lógicos estimados.",
            },
            message: apiString("Explicação das limitações."),
          },
        },
      },
      required: ["totals", "olts", "pons", "ctos", "selected", "limitations"],
    },
  })
  @ApiQuery({
    name: "olt",
    required: false,
    description: "OLT usada para expandir as PONs.",
    example: "OLT-2",
  })
  @ApiQuery({
    name: "pon",
    required: false,
    description: "PON usada para expandir as CTOs.",
    example: "1/7",
  })
  @Get("topology")
  topology(@Query() params: NetworkTopologyQueryDto) {
    return this.network.getTopology(params.olt, params.pon);
  }

  @ApiRead({
    summary: "Listar agrupamentos detectados",
    description:
      "Lista correlações determinísticas ainda não resolvidas, ordenadas por prioridade, quantidade afetada ou título.",
    responseDescription: "Página de agrupamentos detectados.",
    schema: apiPageSchema(
      detectedIncidentSchema,
      "Agrupamentos calculados ativos.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["score_desc", "affected_desc", "title_asc"],
    defaultSort: "score_desc",
  })
  @ApiInvalidRequest("Paginação ou ordenação inválida.")
  @Get("incidents")
  async incidents(@Query() params: NetworkIncidentsQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultSort: "score_desc",
        allowedSorts: ["score_desc", "affected_desc", "title_asc"],
      },
    );
    const incidents = await this.network.getIncidents();
    const sorted = [...incidents].sort((left, right) => {
      if (pagination.sort === "affected_desc") {
        return right.affected - left.affected;
      }
      if (pagination.sort === "title_asc") {
        return left.title.localeCompare(right.title, "pt-BR");
      }
      return right.score - left.score;
    });
    const offset = (pagination.page - 1) * pagination.pageSize;
    return paginate(
      sorted.slice(offset, offset + pagination.pageSize),
      sorted.length,
      pagination.page,
      pagination.pageSize,
    );
  }

  @ApiRead({
    summary: "Obter agrupamento detectado",
    description:
      "Retorna uma correlação calculada pelo identificador estável enquanto ela permanecer ativa.",
    responseDescription: "Agrupamento detectado.",
    schema: detectedIncidentSchema,
    dashboardResource: true,
  })
  @ApiParam({
    name: "id",
    description: "Identificador do agrupamento.",
    example: "pon-olt2-ja",
  })
  @ApiNotFoundResponse({
    description: "Agrupamento não encontrado ou já resolvido.",
    schema: apiErrorSchema,
  })
  @Get("incidents/:id")
  async incident(@Param() params: GroupingIdParamDto) {
    const incident = (await this.network.getIncidents()).find(
      (item) => item.id === params.id,
    );
    if (!incident) throw new NotFoundException("Incidente não encontrado");
    return incident;
  }

  @ApiWrite({
    summary: "Resolver agrupamento detectado",
    description:
      "Marca um agrupamento calculado como resolvido para removê-lo das filas e indicadores ativos. Não altera telemetria nem inventário.",
    responseDescription: "Confirmação do encerramento.",
    schema: {
      type: "object",
      properties: {
        grouping_id: apiString("Identificador encerrado.", "pon-olt2-ja"),
        status: {
          type: "string",
          enum: ["resolved"],
          description: "Estado final aceito.",
        },
      },
    },
  })
  @ApiParam({
    name: "id",
    description: "Identificador do agrupamento.",
    example: "pon-olt2-ja",
  })
  @ApiBody({
    description: "Solicitação explícita de resolução.",
    schema: {
      type: "object",
      required: ["status"],
      properties: {
        status: { type: "string", enum: ["resolved"], example: "resolved" },
      },
    },
  })
  @ApiBadRequestResponse({
    description: "Status de encerramento inválido.",
    schema: apiErrorSchema,
  })
  @ApiNotFoundResponse({
    description: "Agrupamento não encontrado.",
    schema: apiErrorSchema,
  })
  @Patch("incidents/:id/status")
  closeIncident(
    @Param() params: GroupingIdParamDto,
    @Body() body: ResolvedStatusDto,
  ) {
    return this.network.closeDetectedGrouping(params.id, body.status);
  }
}
