import {
  DashboardBinding,
  DashboardComposition,
  DashboardPlan,
  DashboardWidget,
  DashboardWidgetKind,
  dashboardBindings,
} from "./dashboard.types";

const widgetKinds = new Set<DashboardWidgetKind>([
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
]);
const sizes = new Set(["compact", "half", "wide"]);
const tones = new Set(["neutral", "positive", "warning", "critical"]);
const bindings = new Set<DashboardBinding>(dashboardBindings);

function defaultColumns(size: DashboardWidget["size"]) {
  if (size === "compact") return 8;
  if (size === "half") return 12;
  return 24;
}

const compatibleBindings: Record<DashboardWidgetKind, Set<DashboardBinding>> = {
  metric: new Set([
    "overview.activeCpes",
    "overview.oltCount",
    "overview.ponCount",
    "overview.affectedCpes",
    "overview.repeatCustomers",
    "overview.ticketGrowthPct",
    "overview.estimatedImpact",
  ]),
  timeseries: new Set(["overview.weeklyTickets"]),
  bar: new Set(["overview.ticketMix", "network.topology"]),
  pie: new Set(["overview.ticketMix", "network.topology"]),
  multiseries: new Set(["overview.weeklyTickets"]),
  alerts: new Set(["overview.detectedIncidents", "operations.activeIncidents"]),
  queue: new Set(["operations.nocQueue"]),
  narrative: new Set(["overview.executiveReadout"]),
  table: new Set([
    "inventory.customers",
    "inventory.equipment",
    "telemetry.dailyMetrics",
    "diagnostics.list",
  ]),
  topology: new Set(["network.topology"]),
  map: new Set(["network.topology"]),
};

const scalarBindings = [
  "overview.activeCpes",
  "overview.oltCount",
  "overview.ponCount",
  "overview.affectedCpes",
  "overview.repeatCustomers",
  "overview.ticketGrowthPct",
  "overview.estimatedImpact",
] as const;

export const dashboardPlanJsonSchema = {
  type: "object",
  properties: {
    version: { type: "string", enum: ["1.0"] },
    title: { type: "string", minLength: 3, maxLength: 80 },
    subtitle: { type: "string", minLength: 3, maxLength: 180 },
    refreshSeconds: {
      type: "integer",
      enum: [60, 300, 900, 1800, 3600],
    },
    widgets: {
      type: "array",
      minItems: 3,
      maxItems: 9,
      items: {
        type: "object",
        properties: {
          id: { type: "string", minLength: 2, maxLength: 50 },
          kind: {
            type: "string",
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
          },
          size: {
            type: "string",
            enum: ["compact", "half", "wide"],
          },
          columns: { type: "integer", minimum: 4, maximum: 24 },
          title: { type: "string", minLength: 2, maxLength: 80 },
          description: { type: "string", maxLength: 160 },
          binding: { type: "string", enum: dashboardBindings },
          tone: {
            type: "string",
            enum: ["neutral", "positive", "warning", "critical"],
          },
          config: {
            type: "object",
            properties: {
              limit: { type: "integer", enum: [5, 10, 15] },
              formula: {
                anyOf: [
                  { type: "null" },
                  {
                    type: "object",
                    properties: {
                      operation: {
                        type: "string",
                        enum: [
                          "sum",
                          "average",
                          "difference",
                          "ratio",
                          "percentage",
                        ],
                      },
                      operands: {
                        type: "array",
                        minItems: 2,
                        maxItems: 5,
                        items: { type: "string", enum: scalarBindings },
                      },
                      decimals: { type: "integer", enum: [0, 1, 2] },
                      suffix: { type: "string", maxLength: 12 },
                    },
                    required: ["operation", "operands", "decimals", "suffix"],
                    additionalProperties: false,
                  },
                ],
              },
            },
            required: ["limit", "formula"],
            additionalProperties: false,
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
        additionalProperties: false,
      },
    },
  },
  required: ["version", "title", "subtitle", "refreshSeconds", "widgets"],
  additionalProperties: false,
} as const;

function widget(
  id: string,
  kind: DashboardWidgetKind,
  size: DashboardWidget["size"],
  title: string,
  description: string,
  binding: DashboardBinding,
  tone: DashboardWidget["tone"] = "neutral",
  config: DashboardWidget["config"] = { limit: 5, formula: null },
): DashboardWidget {
  return {
    id,
    kind,
    size,
    columns: defaultColumns(size),
    title,
    description,
    binding,
    tone,
    config,
  };
}

export function alignInfrastructureMetricBindings(
  plan: DashboardPlan,
): DashboardPlan {
  return {
    ...plan,
    widgets: plan.widgets.map((item) => {
      if (item.kind !== "metric") return item;
      const label = `${item.title} ${item.description}`.toLocaleLowerCase(
        "pt-BR",
      );
      if (/\bolts?\b/.test(label)) {
        return { ...item, binding: "overview.oltCount" };
      }
      if (/\bpons?\b|porta[s]? pon/.test(label)) {
        return { ...item, binding: "overview.ponCount" };
      }
      return item;
    }),
  };
}

export function fallbackDashboardPlan(objective: string): DashboardPlan {
  const normalized = objective.toLocaleLowerCase("pt-BR");
  const topologyFocused = /\bolts?\b|\bpons?\b|porta[s]? pon/.test(normalized);
  const advancedFocused =
    /tabela|barra|pizza|multiss[eé]rie|mapa|topologia|telemetria|diagn[oó]stico|drag|drill|f[oó]rmula/.test(
      normalized,
    );
  const supportFocused = /n1|suporte|chamado|atendimento/.test(normalized);
  const incidentFocused = /alerta|incidente|noc|risco|cr[ií]tic/.test(
    normalized,
  );

  const metrics = [
    widget(
      "active-cpes",
      "metric",
      "compact",
      "Parque ativo",
      "CPEs em operação no inventário.",
      "overview.activeCpes",
      "positive",
    ),
    widget(
      "affected-cpes",
      "metric",
      "compact",
      "Clientes sob risco",
      "CPEs únicas presentes nos sinais ativos.",
      "overview.affectedCpes",
      "warning",
    ),
    widget(
      "ticket-growth",
      "metric",
      "compact",
      "Pressão no suporte",
      "Variação dos chamados técnicos recentes.",
      "overview.ticketGrowthPct",
      "critical",
    ),
  ];

  const operational = [
    widget(
      "detected-incidents",
      "alerts",
      "half",
      "Alertas identificados",
      "Sinais analíticos priorizados pela abrangência.",
      "overview.detectedIncidents",
      "critical",
    ),
    widget(
      "active-incidents",
      "alerts",
      "half",
      "Incidentes ativos",
      "Agrupamentos já confirmados pela operação.",
      "operations.activeIncidents",
      "warning",
    ),
    widget(
      "weekly-demand",
      "timeseries",
      "wide",
      "Demanda técnica",
      "Evolução semanal de lentidão, quedas e Wi-Fi.",
      "overview.weeklyTickets",
    ),
    widget(
      "executive-readout",
      "narrative",
      "wide",
      "Leitura executiva",
      "Síntese calculada pelo backend a partir das evidências atuais.",
      "overview.executiveReadout",
    ),
  ];

  if (advancedFocused) {
    return {
      version: "1.0",
      title: "Exploração operacional",
      subtitle:
        "Indicadores, distribuição, topologia e registros detalhados em uma composição interativa.",
      refreshSeconds: 300,
      widgets: [
        widget(
          "affected-rate",
          "metric",
          "compact",
          "Parque sob risco",
          "Percentual calculado entre CPEs afetadas e ativas.",
          "overview.affectedCpes",
          "warning",
          {
            limit: 5,
            formula: {
              operation: "percentage",
              operands: ["overview.affectedCpes", "overview.activeCpes"],
              decimals: 1,
              suffix: "%",
            },
          },
        ),
        widget(
          "ticket-bars",
          "bar",
          "half",
          "Chamados por categoria",
          "Comparação consolidada das categorias técnicas.",
          "overview.ticketMix",
        ),
        widget(
          "ticket-pie",
          "pie",
          "half",
          "Distribuição dos chamados",
          "Participação de cada categoria no volume recente.",
          "overview.ticketMix",
        ),
        widget(
          "ticket-series",
          "multiseries",
          "wide",
          "Tendências por categoria",
          "Lentidão, desconexão e Wi-Fi ao longo das semanas.",
          "overview.weeklyTickets",
        ),
        widget(
          "network-topology",
          "topology",
          "wide",
          "Topologia resumida",
          "Relação entre o parque e suas OLTs.",
          "network.topology",
        ),
        widget(
          "network-map",
          "map",
          "wide",
          "Distribuição territorial",
          "Visão esquemática das regiões atendidas pelas OLTs.",
          "network.topology",
        ),
        widget(
          "customer-table",
          "table",
          "wide",
          "Clientes e planos",
          "Lista pesquisável de clientes do inventário ativo.",
          "inventory.customers",
        ),
        widget(
          "telemetry-table",
          "table",
          "wide",
          "Telemetria recente",
          "Métricas diárias dentro do período selecionado.",
          "telemetry.dailyMetrics",
        ),
        widget(
          "diagnostics-table",
          "table",
          "wide",
          "Diagnósticos recentes",
          "Resultados técnicos dentro do período selecionado.",
          "diagnostics.list",
        ),
      ],
    };
  }

  if (topologyFocused) {
    return {
      version: "1.0",
      title: "Capacidade da infraestrutura",
      subtitle:
        "Inventário ativo de equipamentos e portas que sustentam o parque da rede.",
      refreshSeconds: 300,
      widgets: [
        widget(
          "olt-count",
          "metric",
          "compact",
          "OLTs ativas",
          "Quantidade de OLTs distintas no inventário ativo.",
          "overview.oltCount",
          "positive",
        ),
        widget(
          "pon-count",
          "metric",
          "compact",
          "Portas PON ativas",
          "Quantidade de pares OLT/PON distintos no inventário ativo.",
          "overview.ponCount",
          "positive",
        ),
        metrics[0],
      ],
    };
  }

  if (supportFocused) {
    return {
      version: "1.0",
      title: "Pulso do atendimento",
      subtitle:
        "Demanda, fila operacional e sinais que ajudam o suporte a agir com contexto.",
      refreshSeconds: 300,
      widgets: [
        metrics[2],
        widget(
          "repeat-customers",
          "metric",
          "compact",
          "Clientes reincidentes",
          "Clientes com dois ou mais chamados em 30 dias.",
          "overview.repeatCustomers",
          "warning",
        ),
        metrics[1],
        widget(
          "noc-queue",
          "queue",
          "half",
          "Fila recebida do N1",
          "Chamados individuais aguardando atuação do NOC.",
          "operations.nocQueue",
          "warning",
        ),
        operational[1],
        operational[2],
      ],
    };
  }

  return {
    version: "1.0",
    title: incidentFocused
      ? "Central de riscos da rede"
      : "Visão executiva diária",
    subtitle: incidentFocused
      ? "Alertas, incidentes confirmados e alcance operacional em uma única leitura."
      : "Saúde do parque, pressão no suporte e prioridades atualizadas da operação.",
    refreshSeconds: incidentFocused ? 60 : 300,
    widgets: incidentFocused
      ? [metrics[1], metrics[2], metrics[0], ...operational]
      : [...metrics, operational[2], operational[0], operational[3]],
  };
}

export function validateDashboardPlan(value: unknown): DashboardPlan {
  if (!value || typeof value !== "object") {
    throw new Error("A IA não retornou um plano de dashboard estruturado.");
  }
  const plan = value as Record<string, unknown>;
  if (
    plan.version !== "1.0" ||
    typeof plan.title !== "string" ||
    plan.title.trim().length < 3 ||
    typeof plan.subtitle !== "string" ||
    plan.subtitle.trim().length < 3 ||
    ![60, 300, 900, 1800, 3600].includes(Number(plan.refreshSeconds)) ||
    !Array.isArray(plan.widgets) ||
    plan.widgets.length < 3 ||
    plan.widgets.length > 9
  ) {
    throw new Error("O plano da IA não respeitou o contrato do dashboard.");
  }

  const ids = new Set<string>();
  for (const candidate of plan.widgets) {
    if (!candidate || typeof candidate !== "object") {
      throw new Error("O plano contém um bloco inválido.");
    }
    const item = candidate as Record<string, unknown>;
    item.config ??= { limit: 5, formula: null };
    item.columns ??= defaultColumns(
      String(item.size) as DashboardWidget["size"],
    );
    const kind = String(item.kind) as DashboardWidgetKind;
    const binding = String(item.binding) as DashboardBinding;
    const config = item.config as Record<string, unknown>;
    const formula = config?.formula;
    const validFormula =
      formula === null ||
      (formula !== undefined &&
        typeof formula === "object" &&
        ["sum", "average", "difference", "ratio", "percentage"].includes(
          String((formula as Record<string, unknown>).operation),
        ) &&
        Array.isArray((formula as Record<string, unknown>).operands) &&
        ((formula as Record<string, unknown>).operands as unknown[]).length >=
          2 &&
        ((formula as Record<string, unknown>).operands as unknown[]).every(
          (operand) => scalarBindings.includes(operand as never),
        ) &&
        [0, 1, 2].includes(
          Number((formula as Record<string, unknown>).decimals),
        ) &&
        typeof (formula as Record<string, unknown>).suffix === "string");
    if (
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      !widgetKinds.has(kind) ||
      !sizes.has(String(item.size)) ||
      !Number.isInteger(Number(item.columns)) ||
      Number(item.columns) < 4 ||
      Number(item.columns) > 24 ||
      typeof item.title !== "string" ||
      typeof item.description !== "string" ||
      !bindings.has(binding) ||
      !compatibleBindings[kind].has(binding) ||
      !tones.has(String(item.tone)) ||
      !config ||
      ![5, 10, 15].includes(Number(config.limit)) ||
      !validFormula ||
      (formula && kind !== "metric")
    ) {
      throw new Error("O plano contém um bloco incompatível com sua fonte.");
    }
    ids.add(item.id);
  }
  return value as DashboardPlan;
}

export function validateDashboardComposition(
  value: unknown,
): DashboardComposition {
  validateDashboardPlan(value);
  const composition = value as Record<string, unknown>;
  const discovery = composition.discovery as Record<string, unknown> | null;
  const runtimeData = composition.runtimeData as Record<string, unknown> | null;
  const validDiscovery =
    !!discovery &&
    ((discovery.protocol === "MCP" &&
      discovery.mode === "openapi-bridge" &&
      Number.isInteger(Number(discovery.resourceCount)) &&
      discovery.endpoint === "/mcp/openapi" &&
      discovery.document === "/api/openapi.json") ||
      (discovery.protocol === "OpenAPI" &&
        discovery.mode === "contract-only" &&
        Number.isInteger(Number(discovery.resourceCount)) &&
        discovery.document === "/api/openapi.json") ||
      (discovery.protocol === "MCP" &&
        discovery.mode === "catalog-only" &&
        Number.isInteger(Number(discovery.toolCount))));
  if (
    typeof composition.objective !== "string" ||
    composition.objective.length > 600 ||
    typeof composition.generatedAt !== "string" ||
    Number.isNaN(Date.parse(composition.generatedAt)) ||
    !["openai", "fallback"].includes(String(composition.generatedBy)) ||
    !(composition.model === null || typeof composition.model === "string") ||
    !validDiscovery ||
    !runtimeData ||
    runtimeData.protocol !== "REST" ||
    !Array.isArray(runtimeData.endpoints) ||
    !runtimeData.endpoints.every((endpoint) => typeof endpoint === "string")
  ) {
    throw new Error("A configuração persistida do dashboard é inválida.");
  }
  return value as DashboardComposition;
}
