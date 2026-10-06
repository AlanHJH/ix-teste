import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { CustomerQueries } from "../application/customer-queries.js";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

export function createCustomerServer(queries: CustomerQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-customers",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "customers",
    "Cadastro do assinante e histórico dos equipamentos vinculados ao cliente.",
    ["customers_search", "customers_get"],
  );
  server.registerResource(
    "customer",
    new ResourceTemplate("ondaluz://customers/{customerId}", {
      list: undefined,
    }),
    {
      title: "Cliente Ondaluz",
      description: "Cadastro e histórico de equipamentos de um cliente.",
      mimeType: "application/json",
    },
    async (uri, { customerId }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await queries.get(String(customerId)), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "customers_search",
    {
      title: "Pesquisar clientes",
      description:
        "Pesquisa clientes por código, serial, cidade ou bairro e permite filtrar a situação cadastral.",
      inputSchema: z.object({
        query: z.string().max(120).default(""),
        status: z.enum(["active", "cancelled", "all"]).default("all"),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.search(input)),
  );

  server.registerTool(
    "customers_get",
    {
      title: "Consultar cliente",
      description:
        "Retorna o cadastro e todo o histórico de equipamentos de um cliente.",
      inputSchema: z.object({ customerId: z.string().min(1).max(80) }),
      annotations: readOnlyAnnotations,
    },
    async ({ customerId }) => mcpJson(await queries.get(customerId)),
  );

  return server;
}
