export const MCP_ENDPOINTS = [
  {
    path: "/mcp/customers",
    domain: "customers",
    description: "Clientes e histórico de equipamentos.",
  },
  {
    path: "/mcp/inventory",
    domain: "inventory",
    description: "CPEs, capacidade e topologia lógica.",
  },
  {
    path: "/mcp/telemetry",
    domain: "telemetry",
    description: "Informs TR-069 e métricas diárias.",
  },
  {
    path: "/mcp/diagnostics",
    domain: "diagnostics",
    description: "Diagnósticos e testes de velocidade.",
  },
  {
    path: "/mcp/tickets",
    domain: "tickets",
    description: "Chamados e resoluções de atendimento.",
  },
  {
    path: "/mcp/operations",
    domain: "operations",
    description: "Estado das cargas de dados.",
  },
] as const;
