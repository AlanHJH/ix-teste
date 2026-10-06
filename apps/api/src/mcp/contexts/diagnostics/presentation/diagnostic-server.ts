import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { DiagnosticQueries } from "../application/diagnostic-queries.js";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

export function createDiagnosticServer(queries: DiagnosticQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-diagnostics",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "diagnostics",
    "Resultados de diagnósticos solicitados às CPEs, incluindo testes de velocidade.",
    ["diagnostics_list"],
  );
  server.registerTool(
    "diagnostics_list",
    {
      title: "Listar diagnósticos",
      description:
        "Consulta diagnósticos por serial, cliente, tipo, estado ou intervalo de tempo.",
      inputSchema: z.object({
        serial: z.string().max(120).optional(),
        customerId: z.string().max(80).optional(),
        state: z.string().max(80).optional(),
        diagnostic: z.string().max(120).optional(),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.list(input)),
  );

  return server;
}
