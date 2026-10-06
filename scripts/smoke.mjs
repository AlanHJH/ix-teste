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

const health = await getJson("/health");
expect(health.status === "ok", "healthcheck não está pronto");
expect(
  health.dataset?.status === "complete",
  "a carga do dataset não foi concluída",
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

const catalog = await getJson("/api");
expect(
  catalog.mcp?.endpoints?.length === 6,
  "catálogo MCP não contém os seis domínios",
);

console.log(
  `[smoke] OK — ${overview.kpis.activeCpes.toLocaleString("pt-BR")} CPEs, ${overview.incidents.length} agrupamentos e ${cases.length} jornadas N1`,
);
