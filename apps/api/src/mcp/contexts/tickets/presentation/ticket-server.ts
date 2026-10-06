import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import { TicketQueries } from "../application/ticket-queries.js";
import {
  mcpJson,
  pageInput,
  readOnlyAnnotations,
  registerAboutResource,
} from "../../../shared/presentation/mcp.js";

export function createTicketServer(queries: TicketQueries): McpServer {
  const server = new McpServer({
    name: "ondaluz-tickets",
    version: "1.0.0",
  });

  registerAboutResource(
    server,
    "tickets",
    "Chamados de atendimento com categoria, descrição, resolução e contexto de rede do cliente.",
    ["tickets_list", "tickets_get"],
  );
  server.registerResource(
    "ticket",
    new ResourceTemplate("ondaluz://tickets/{ticketId}", { list: undefined }),
    {
      title: "Chamado Ondaluz",
      description: "Dados completos de um chamado por identificador.",
      mimeType: "application/json",
    },
    async (uri, { ticketId }) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await queries.get(String(ticketId)), null, 2),
        },
      ],
    }),
  );

  server.registerTool(
    "tickets_list",
    {
      title: "Listar chamados",
      description:
        "Pesquisa chamados por texto, cliente, categoria, resolução, canal ou período.",
      inputSchema: z.object({
        query: z.string().max(200).default(""),
        customerId: z.string().max(80).optional(),
        category: z.string().max(120).optional(),
        resolution: z.string().max(160).optional(),
        channel: z.string().max(80).optional(),
        from: z.string().datetime({ offset: true }).optional(),
        to: z.string().datetime({ offset: true }).optional(),
        ...pageInput,
      }),
      annotations: readOnlyAnnotations,
    },
    async (input) => mcpJson(await queries.list(input)),
  );

  server.registerTool(
    "tickets_get",
    {
      title: "Consultar chamado",
      description: "Retorna um chamado pelo identificador.",
      inputSchema: z.object({ ticketId: z.string().min(1).max(120) }),
      annotations: readOnlyAnnotations,
    },
    async ({ ticketId }) => mcpJson(await queries.get(ticketId)),
  );

  return server;
}
