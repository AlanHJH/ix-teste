import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { OperationsQueries } from "../application/operations-queries.js";
import { groupingScopeTypes } from "../../../../grouping-candidates.js";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";
import { createPage } from "../../../shared/domain/page.js";

export function createOperationsServer(queries: OperationsQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-operations",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "operations",
    "Estado operacional das cargas e candidatos de agrupamento do protótipo.",
    [
      "operations_list_dataset_loads",
      "operations_list_grouping_candidates",
      "operations_list_active_groupings",
    ],
  );
  server.registerTool(
    "operations_list_dataset_loads",
    {
      title: "Listar cargas de dados",
      description:
        "Retorna o histórico e os metadados das cargas idempotentes do dataset.",
      inputSchema: z.object({ ...pageInput }),
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      const all = await queries.datasetLoads();
      const offset = (input.page - 1) * input.pageSize;
      return mcpJson(
        createPage(
          all.slice(offset, offset + input.pageSize),
          all.length,
          input,
        ),
      );
    },
  );
  server.registerTool(
    "operations_list_grouping_candidates",
    {
      title: "Listar candidatos de agrupamento",
      description:
        "Retorna concentrações anormais pré-calculadas por parque, OLT, PON, CTO, cliente, firmware, equipamento ou região. Use como ponto de partida e confirme com os demais domínios MCP antes de propor um agrupamento.",
      inputSchema: z.object({
        scopeType: z.enum(groupingScopeTypes).optional(),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      const all = await queries.groupingCandidates({
        scopeType: input.scopeType,
        limit: 30,
      });
      const offset = (input.page - 1) * input.pageSize;
      return mcpJson(
        createPage(
          all.slice(offset, offset + input.pageSize),
          all.length,
          input,
        ),
      );
    },
  );

  server.registerTool(
    "operations_list_active_groupings",
    {
      title: "Listar agrupamentos ativos do NOC",
      description:
        "Retorna agrupamentos operacionais confirmados pelo NOC e ainda ativos, com escopo, causa provável, orientação e impacto. Use para contextualizar o atendimento N1; a consulta é somente leitura.",
      inputSchema: z.object({
        scopeType: z.enum(groupingScopeTypes).optional(),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => {
      const all = await queries.activeGroupings({
        scopeType: input.scopeType,
        limit: 30,
      });
      const offset = (input.page - 1) * input.pageSize;
      return mcpJson(
        createPage(
          all.slice(offset, offset + input.pageSize),
          all.length,
          input,
        ),
      );
    },
  );

  return server;
}
