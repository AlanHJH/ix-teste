import { McpServer } from "@modelcontextprotocol/server";
import type {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  SchemaObject,
} from "@nestjs/swagger";
import { z } from "zod/v4";
import { mcpJson } from "../../../shared/presentation/mcp.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type JsonSchema = Record<string, unknown>;

type BridgeOperationObject = OperationObject & {
  "x-dashboard-resource"?: boolean;
  "x-read-only"?: boolean;
};

export type OpenApiBridgeOperation = {
  name: string;
  title: string;
  description: string;
  method: HttpMethod;
  path: string;
  readOnly: boolean;
  dashboardResource: boolean;
  parameters: Array<{
    name: string;
    location: "path" | "query";
  }>;
  bodyPropertyNames: string[];
  inputJsonSchema: JsonSchema;
};

export type OpenApiDocumentProvider = () => OpenAPIObject | null;

export type OpenApiBridgeOptions = {
  baseUrl: string;
  fetchImplementation?: typeof fetch;
};

const methods = new Set(["get", "post", "put", "patch", "delete"]);

function isReference(value: unknown): value is ReferenceObject {
  return Boolean(
    value &&
    typeof value === "object" &&
    "$ref" in value &&
    typeof (value as ReferenceObject).$ref === "string",
  );
}

function normalizeJsonSchema(
  value: SchemaObject | ReferenceObject | undefined,
  fallbackType?: "string" | "object",
): JsonSchema {
  if (!value || isReference(value)) {
    return fallbackType ? { type: fallbackType } : {};
  }
  const schema = { ...value } as JsonSchema;
  const properties = schema.properties;
  if (properties && typeof properties === "object") {
    schema.properties = Object.fromEntries(
      Object.entries(properties).map(([name, property]) => [
        name,
        normalizeJsonSchema(property as SchemaObject | ReferenceObject),
      ]),
    );
  }
  if (schema.items && typeof schema.items === "object") {
    schema.items = normalizeJsonSchema(
      schema.items as SchemaObject | ReferenceObject,
    );
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const variants = schema[keyword];
    if (Array.isArray(variants)) {
      schema[keyword] = variants.map((variant) =>
        normalizeJsonSchema(variant as SchemaObject | ReferenceObject),
      );
    }
  }
  if (schema.nullable === true) {
    const { nullable: _nullable, ...withoutNullable } = schema;
    return { anyOf: [withoutNullable, { type: "null" }] };
  }
  if (
    fallbackType &&
    !schema.type &&
    !schema.allOf &&
    !schema.anyOf &&
    !schema.oneOf
  ) {
    schema.type = fallbackType;
  }
  return schema;
}

function asParameter(
  value: ParameterObject | ReferenceObject,
): ParameterObject | null {
  return isReference(value) ? null : value;
}

function asRequestBody(
  value: RequestBodyObject | ReferenceObject | undefined,
): RequestBodyObject | null {
  return !value || isReference(value) ? null : value;
}

function fallbackOperationName(method: string, path: string): string {
  const suffix = path
    .replace(/^\/api\/?/, "")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `${method}_${suffix || "root"}`.toLocaleLowerCase("en-US");
}

function operationInput(
  operation: BridgeOperationObject,
): Pick<
  OpenApiBridgeOperation,
  "parameters" | "bodyPropertyNames" | "inputJsonSchema"
> {
  const properties: Record<string, JsonSchema> = {};
  const required = new Set<string>();
  const parameters: OpenApiBridgeOperation["parameters"] = [];

  for (const value of operation.parameters ?? []) {
    const parameter = asParameter(value);
    if (!parameter || (parameter.in !== "path" && parameter.in !== "query")) {
      continue;
    }
    const schema = normalizeJsonSchema(parameter.schema, "string");
    properties[parameter.name] = {
      ...schema,
      ...(parameter.description ? { description: parameter.description } : {}),
    };
    parameters.push({
      name: parameter.name,
      location: parameter.in,
    });
    if (parameter.required) required.add(parameter.name);
  }

  const requestBody = asRequestBody(operation.requestBody);
  const bodySchemaValue = requestBody?.content?.["application/json"]?.schema;
  const bodySchema = normalizeJsonSchema(bodySchemaValue, "object");
  const bodyProperties =
    bodySchema.type === "object" &&
    bodySchema.properties &&
    typeof bodySchema.properties === "object"
      ? (bodySchema.properties as Record<string, JsonSchema>)
      : {};
  const bodyPropertyNames = Object.keys(bodyProperties);

  if (requestBody && bodyPropertyNames.length > 0) {
    for (const [name, schema] of Object.entries(bodyProperties)) {
      if (properties[name]) {
        throw new Error(
          `O campo ${name} aparece nos parâmetros e no corpo de ${operation.operationId}.`,
        );
      }
      properties[name] = schema;
    }
    if (requestBody.required) {
      for (const name of (bodySchema.required as string[] | undefined) ?? []) {
        required.add(name);
      }
    }
  } else if (requestBody) {
    properties.body = bodySchema;
    bodyPropertyNames.push("body");
    if (requestBody.required) required.add("body");
  }

  return {
    parameters,
    bodyPropertyNames,
    inputJsonSchema: {
      type: "object",
      properties,
      additionalProperties: false,
      ...(required.size > 0 ? { required: [...required] } : {}),
    },
  };
}

export function openApiBridgeOperations(
  document: OpenAPIObject,
): OpenApiBridgeOperation[] {
  const operations = Object.entries(document.paths).flatMap(
    ([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => methods.has(method))
        .map(([method, value]) => {
          const operation = value as BridgeOperationObject;
          const input = operationInput(operation);
          const name =
            operation.operationId ?? fallbackOperationName(method, path);
          const title = operation.summary ?? `${method.toUpperCase()} ${path}`;
          const tags = operation.tags?.length
            ? `Domínio: ${operation.tags.join(", ")}.`
            : "";
          return {
            name,
            title,
            description: [
              operation.description ?? title,
              `${method.toUpperCase()} ${path}.`,
              tags,
              "Contrato e validação derivados automaticamente do OpenAPI.",
            ]
              .filter(Boolean)
              .join(" "),
            method: method.toUpperCase() as HttpMethod,
            path,
            readOnly: operation["x-read-only"] === true,
            dashboardResource:
              operation["x-dashboard-resource"] === true &&
              operation["x-read-only"] === true,
            ...input,
          };
        }),
  );

  const names = new Set<string>();
  for (const operation of operations) {
    if (names.has(operation.name)) {
      throw new Error(`operationId duplicado no OpenAPI: ${operation.name}`);
    }
    names.add(operation.name);
  }
  return operations;
}

function appendQuery(url: URL, name: string, value: unknown): void {
  if (value === undefined || value === null || value === "") return;
  if (Array.isArray(value)) {
    for (const item of value) appendQuery(url, name, item);
    return;
  }
  url.searchParams.append(name, String(value));
}

export function buildOpenApiBridgeRequest(
  baseUrl: string,
  operation: OpenApiBridgeOperation,
  input: Record<string, unknown>,
): { url: URL; init: RequestInit } {
  let path = operation.path;
  for (const parameter of operation.parameters) {
    if (parameter.location === "path") {
      path = path.replace(
        `{${parameter.name}}`,
        encodeURIComponent(String(input[parameter.name])),
      );
    }
  }
  const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  for (const parameter of operation.parameters) {
    if (parameter.location === "query") {
      appendQuery(url, parameter.name, input[parameter.name]);
    }
  }
  const body = Object.fromEntries(
    operation.bodyPropertyNames
      .filter((name) => name !== "body" && input[name] !== undefined)
      .map((name) => [name, input[name]]),
  );
  const rawBody = operation.bodyPropertyNames.includes("body")
    ? input.body
    : body;
  const hasBody = operation.bodyPropertyNames.length > 0;
  return {
    url,
    init: {
      method: operation.method,
      headers: {
        accept: "application/json",
        ...(hasBody ? { "content-type": "application/json" } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(rawBody) } : {}),
      signal: AbortSignal.timeout(30_000),
    },
  };
}

async function executeOperation(
  operation: OpenApiBridgeOperation,
  input: Record<string, unknown>,
  options: OpenApiBridgeOptions,
) {
  const request = buildOpenApiBridgeRequest(options.baseUrl, operation, input);
  const response = await (options.fetchImplementation ?? fetch)(
    request.url,
    request.init,
  );
  const text = await response.text();
  let value: unknown = null;
  if (text) {
    try {
      value = JSON.parse(text) as unknown;
    } catch {
      value = text;
    }
  }
  if (!response.ok) {
    const error = {
      status: response.status,
      method: operation.method,
      path: operation.path,
      error: value,
    };
    return { ...mcpJson(error), isError: true as const };
  }
  return mcpJson(value ?? { status: response.status });
}

export function createOpenApiBridgeServer(
  documentProvider: OpenApiDocumentProvider,
  options: OpenApiBridgeOptions,
): McpServer {
  const document = documentProvider();
  if (!document) {
    throw new Error("O documento OpenAPI ainda não foi inicializado.");
  }
  const operations = openApiBridgeOperations(document);
  const server = new McpServer({
    name: "ondaluz-openapi-bridge",
    version: document.info.version,
  });

  server.registerResource(
    "openapi-document",
    "ondaluz://openapi/document",
    {
      title: "Contrato OpenAPI da Ondaluz",
      description:
        "Documento canônico usado para gerar automaticamente as ferramentas MCP.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "ondaluz://openapi/document",
          mimeType: "application/json",
          text: JSON.stringify(documentProvider(), null, 2),
        },
      ],
    }),
  );
  server.registerResource(
    "dashboard-rest-routes",
    "ondaluz://openapi/dashboard-routes",
    {
      title: "Rotas REST disponíveis para o dashboard",
      description:
        "Catálogo compacto das operações somente leitura que a IA pode usar para compor dashboards; contém contratos, não dados operacionais.",
      mimeType: "application/json",
    },
    async () => ({
      contents: [
        {
          uri: "ondaluz://openapi/dashboard-routes",
          mimeType: "application/json",
          text: JSON.stringify(
            operations
              .filter((operation) => operation.dashboardResource)
              .map(
                ({
                  name,
                  title,
                  description,
                  method,
                  path,
                  inputJsonSchema,
                }) => ({
                  name,
                  title,
                  description,
                  method,
                  path,
                  inputSchema: inputJsonSchema,
                }),
              ),
            null,
            2,
          ),
        },
      ],
    }),
  );

  for (const operation of operations) {
    const inputSchema = z.fromJSONSchema(
      operation.inputJsonSchema as never,
    ) as z.ZodType<Record<string, unknown>>;
    server.registerTool(
      operation.name,
      {
        title: operation.title,
        description: operation.description,
        inputSchema,
        annotations: {
          readOnlyHint: operation.readOnly,
          destructiveHint: !operation.readOnly,
          idempotentHint:
            operation.readOnly ||
            ["PUT", "PATCH", "DELETE"].includes(operation.method),
          openWorldHint: false,
        },
        _meta: {
          "ondaluz/source": "openapi",
          "ondaluz/http-method": operation.method,
          "ondaluz/http-path": operation.path,
          "ondaluz/dashboard-resource": operation.dashboardResource,
        },
      },
      async (input) => executeOperation(operation, input, options),
    );
  }

  return server;
}
