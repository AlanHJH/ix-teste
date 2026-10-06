import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { InventoryQueries } from "../application/inventory-queries.js";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

const topologyFilters = {
  olt: z.string().max(40).optional(),
  pon: z.string().max(40).optional(),
  cto: z.string().max(80).optional(),
};

export function createInventoryServer(queries: InventoryQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-inventory",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "inventory",
    "Inventário de CPEs e a relação lógica OLT, porta PON, CTO, drop estimado e cliente.",
    ["inventory_search_devices", "inventory_get_device", "inventory_topology"],
  );
  server.registerResource(
    "device",
    new ResourceTemplate("ondaluz://inventory/devices/{serial}", {
      list: undefined,
    }),
    {
      title: "CPE do inventário",
      description: "Cadastro técnico completo de uma CPE pelo serial.",
      mimeType: "application/json",
    },
    async (uri, { serial }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await queries.get(String(serial)), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "inventory_search_devices",
    {
      title: "Pesquisar equipamentos",
      description:
        "Consulta o inventário por cliente, serial, fabricante, modelo, localização ou topologia.",
      inputSchema: z.object({
        query: z.string().max(120).default(""),
        status: z.enum(["active", "removed", "all"]).default("all"),
        vendor: z.string().max(80).optional(),
        ...topologyFilters,
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.search(input)),
  );

  server.registerTool(
    "inventory_get_device",
    {
      title: "Consultar equipamento",
      description: "Retorna todos os campos do inventário para um serial.",
      inputSchema: z.object({ serial: z.string().min(1).max(120) }),
      annotations: readOnlyAnnotations,
    },
    async ({ serial }) => mcpJson(await queries.get(serial)),
  );

  server.registerTool(
    "inventory_topology",
    {
      title: "Navegar na topologia",
      description:
        "Lista CPEs ativas de uma OLT, porta PON ou CTO, incluindo o drop lógico estimado.",
      inputSchema: z.object({ ...topologyFilters, ...pageInput }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.topology(input)),
  );

  return server;
}
