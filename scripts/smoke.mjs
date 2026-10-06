const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:8080").replace(
  /\/$/,
  "",
);

async function getJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`${path} retornou HTTP ${response.status}`);
  }
  return response.json();
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function expectPage(payload, label) {
  expect(Array.isArray(payload.data), `${label} sem data[]`);
  expect(payload.page === 1, `${label} com page inválida`);
  expect(payload.pageSize === 2, `${label} com pageSize inválido`);
  expect(
    Number.isInteger(payload.totalItems) && payload.totalItems >= 0,
    `${label} sem totalItems`,
  );
  expect(
    Number.isInteger(payload.totalPages) && payload.totalPages >= 0,
    `${label} sem totalPages`,
  );
}

const health = await getJson("/health");
expect(health.status === "ok", "healthcheck não está pronto");
expect(
  health.dataset?.status === "complete",
  "a carga do dataset não foi concluída",
);
expect(
  health.interfaces?.openapi === "/api/openapi.json",
  "healthcheck não anuncia o contrato OpenAPI",
);

const openapi = await getJson("/api/openapi.json");
expect(openapi.openapi === "3.0.3", "versão OpenAPI inesperada");
expect(
  Object.keys(openapi.paths ?? {}).length >= 30,
  "contrato OpenAPI não contém todas as jornadas REST",
);
expect(
  openapi.paths?.["/api/inventory"]?.get?.description?.length > 40,
  "inventário sem descrição detalhada no OpenAPI",
);
expect(
  openapi.paths?.["/api/inventory"]?.get?.["x-pagination"]?.style ===
    "page-pageSize-sort",
  "inventário sem metadado de paginação para o dashboard",
);
expect(
  openapi.paths?.["/api/inventory"]?.get?.responses?.["200"]?.content?.[
    "application/json"
  ]?.schema?.properties?.data?.items?.properties?.serial?.description,
  "schema de inventário sem descrição de campos",
);

const overview = await getJson("/api/network/overview");
expect(overview.kpis?.activeCpes > 0, "overview sem CPEs ativas");
expect(
  Array.isArray(overview.incidents) && overview.incidents.length >= 3,
  "fila NOC sem os agrupamentos esperados",
);

const cases = [
  ["C545968", "escalar_noc"],
  ["C373254", "escalar_noc"],
  ["C171248", "agendar_visita"],
  ["C361578", "resolver_telefone"],
];

for (const [customerId, expectedAction] of cases) {
  const profile = await getJson(`/api/customers/${customerId}/support`);
  expect(
    profile.customer?.id === customerId,
    `perfil incorreto para ${customerId}`,
  );
  expect(
    profile.decision?.action === expectedAction,
    `${customerId}: esperado ${expectedAction}, recebido ${profile.decision?.action}`,
  );
  expect(
    typeof profile.decision?.sayToCustomer === "string" &&
      profile.decision.sayToCustomer.length > 0,
    `${customerId}: fala sugerida ausente`,
  );
}

const inventory = await getJson(
  "/api/inventory?page=1&pageSize=2&sort=customer_id_asc",
);
expectPage(inventory, "inventário");
expect(inventory.data.length > 0, "inventário vazio");

const dailyMetrics = await getJson(
  "/api/telemetry/daily-metrics?page=1&pageSize=2&sort=day_desc",
);
expectPage(dailyMetrics, "métricas diárias");

const informs = await getJson(
  `/api/telemetry/informs?serial=${encodeURIComponent(inventory.data[0].serial)}&page=1&pageSize=2&sort=ts_desc`,
);
expectPage(informs, "Informs");

const datasetLoads = await getJson(
  "/api/operations/dataset-loads?page=1&pageSize=2&sort=started_at_desc",
);
expectPage(datasetLoads, "cargas do dataset");

const catalog = await getJson("/api");
expect(
  catalog.mcp?.endpoints?.length === 8 &&
    catalog.mcp.endpoints.some((endpoint) => endpoint.path === "/mcp/openapi"),
  "catálogo MCP não contém os oito domínios e o bridge OpenAPI",
);

console.log(
  `[smoke] OK — ${overview.kpis.activeCpes.toLocaleString("pt-BR")} CPEs, ${overview.incidents.length} agrupamentos e ${cases.length} jornadas N1`,
);
