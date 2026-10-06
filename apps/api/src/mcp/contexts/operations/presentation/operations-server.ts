import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { OperationsQueries } from "../application/operations-queries.js";
import {
  mcpJson,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

export function createOperationsServer(queries: OperationsQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-operations",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "operations",
    "Estado operacional das cargas de dados usadas pelo protótipo.",
    ["operations_list_dataset_loads"],
  );
  server.registerTool(
    "operations_list_dataset_loads",
    {
      title: "Listar cargas de dados",
      description:
        "Retorna o histórico e os metadados das cargas idempotentes do dataset.",
      inputSchema: z.object({}),
      annotations: readOnlyAnnotations,
    },
    async () => mcpJson({ items: await queries.datasetLoads() }),
  );

  return server;
}
