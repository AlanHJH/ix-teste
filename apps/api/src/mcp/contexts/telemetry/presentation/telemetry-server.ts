import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { TelemetryQueries } from "../application/telemetry-queries.js";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Data no formato YYYY-MM-DD.");

export function createTelemetryServer(queries: TelemetryQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-telemetry",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "telemetry",
    "Informs TR-069 brutos e métricas diárias normalizadas por CPE e firmware.",
    ["telemetry_list_informs", "telemetry_list_daily_metrics"],
  );

  server.registerTool(
    "telemetry_list_informs",
    {
      title: "Listar Informs de uma CPE",
      description:
        "Lê os eventos TR-069 brutos de um serial. O serial é obrigatório para manter a consulta segura sobre milhões de eventos.",
      inputSchema: z.object({
        serial: z.string().min(1).max(120),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        eventCode: z.string().max(120).optional(),
        softwareVersion: z.string().max(120).optional(),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.listInforms(input)),
  );

  server.registerTool(
    "telemetry_list_daily_metrics",
    {
      title: "Listar métricas diárias",
      description:
        "Consulta os agregados diários de memória, reinícios, LAN, FEC, potência óptica e Wi-Fi.",
      inputSchema: z.object({
        serial: z.string().max(120).optional(),
        customerId: z.string().max(80).optional(),
        olt: z.string().max(40).optional(),
        pon: z.string().max(40).optional(),
        softwareVersion: z.string().max(120).optional(),
        fromDay: day.optional(),
        toDay: day.optional(),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.listDailyMetrics(input)),
  );

  return server;
}
