import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";

export const pageInput = {
  page: z
    .number()
    .int()
    .min(1)
    .max(100_000)
    .default(1)
    .describe("Número da página, começando em 1."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Quantidade de registros por página, entre 1 e 100."),
  sort: z
    .string()
    .max(80)
    .default("default")
    .describe("Ordenação no formato campo_direção, por exemplo ts_desc."),
};

export const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function toJsonValue(value: unknown): Record<string, unknown> {
  const normalized = JSON.parse(JSON.stringify(value)) as unknown;
  if (
    typeof normalized === "object" &&
    normalized !== null &&
    !Array.isArray(normalized)
  ) {
    return normalized as Record<string, unknown>;
  }
  return { data: normalized };
}

export function mcpJson(value: unknown) {
  const normalized = toJsonValue(value);
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(normalized, null, 2),
      },
    ],
    structuredContent: normalized,
  };
}

export function registerAboutResource(
  server: McpServer,
  domain: string,
  description: string,
  tools: string[],
): void {
  const uri = `ondaluz://${domain}/about`;
  server.registerResource(
    `${domain}-about`,
    uri,
    {
      title: `Contrato do domínio ${domain}`,
      description,
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ domain, description, tools }, null, 2),
        },
      ],
    }),
  );
}
