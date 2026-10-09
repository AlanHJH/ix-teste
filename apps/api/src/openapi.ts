import { applyDecorators, type INestApplication } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtension,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
  type SchemaObject,
} from "@nestjs/swagger";
import { OpenApiCatalogService } from "./openapi-catalog.service";

export const apiErrorSchema: SchemaObject = {
  type: "object",
  description:
    "Envelope de erro HTTP produzido pelo NestJS. O campo message pode ser texto, lista de mensagens de validação ou objeto contextual de uma dependência.",
  required: ["statusCode", "message", "error"],
  properties: {
    statusCode: {
      type: "integer",
      description: "Código de status HTTP.",
      example: 400,
    },
    message: {
      oneOf: [
        { type: "string", example: "Parâmetro sort inválido." },
        { type: "array", items: { type: "string" } },
        {
          type: "object",
          description:
            "Contexto adicional, usado por exemplo enquanto o dataset está carregando.",
          additionalProperties: true,
          example: { status: "loading", dataset: null },
        },
      ],
      description: "Mensagem ou lista de erros de validação.",
    },
    error: {
      type: "string",
      description: "Categoria HTTP do erro.",
      example: "Bad Request",
    },
  },
};

export function apiString(description: string, example?: string): SchemaObject {
  return {
    type: "string",
    description,
    ...(example === undefined ? {} : { example }),
  };
}

export function apiDateTime(
  description: string,
  example = "2026-08-31T01:27:50.000Z",
): SchemaObject {
  return {
    ...apiString(description, example),
    format: "date-time",
  };
}

export function apiDate(
  description: string,
  example = "2026-08-31",
): SchemaObject {
  return {
    ...apiString(description, example),
    format: "date",
  };
}

export function apiInteger(
  description: string,
  example?: number,
): SchemaObject {
  return {
    type: "integer",
    description,
    ...(example === undefined ? {} : { example }),
  };
}

export function apiNumber(description: string, example?: number): SchemaObject {
  return {
    type: "number",
    description,
    ...(example === undefined ? {} : { example }),
  };
}

export function apiNullableString(
  description: string,
  example?: string,
): SchemaObject {
  return {
    ...apiString(description, example),
    nullable: true,
  };
}

export function apiArray(
  items: SchemaObject,
  description: string,
): SchemaObject {
  return { type: "array", items, description };
}

export function apiPageSchema(
  item: SchemaObject,
  description: string,
  meta?: SchemaObject,
): SchemaObject {
  return {
    type: "object",
    description,
    required: ["data", "page", "pageSize", "totalItems", "totalPages"],
    properties: {
      data: apiArray(
        item,
        "Registros da página atual, já filtrados e ordenados.",
      ),
      page: apiInteger("Página atual, iniciando em 1.", 1),
      pageSize: apiInteger("Quantidade máxima de registros por página.", 25),
      totalItems: apiInteger(
        "Total de registros que atendem aos filtros, antes da paginação.",
        1500,
      ),
      totalPages: apiInteger(
        "Total de páginas. Pode ser zero quando não existem registros.",
        60,
      ),
      ...(meta ? { meta } : {}),
    },
  };
}

export function ApiPagination(options: {
  sorts: string[];
  defaultSort: string;
  defaultPageSize?: number;
  maximumPageSize?: number;
}) {
  const defaultPageSize = options.defaultPageSize ?? 25;
  const maximumPageSize = options.maximumPageSize ?? 100;
  return applyDecorators(
    ApiQuery({
      name: "page",
      required: false,
      description: "Número da página, iniciando em 1.",
      schema: { type: "integer", minimum: 1, default: 1, example: 2 },
    }),
    ApiQuery({
      name: "pageSize",
      required: false,
      description: `Quantidade por página; máximo ${maximumPageSize}.`,
      schema: {
        type: "integer",
        minimum: 1,
        maximum: maximumPageSize,
        default: defaultPageSize,
      },
    }),
    ApiQuery({
      name: "sort",
      required: false,
      description:
        "Ordenação aplicada antes da paginação. Somente os valores enumerados são aceitos.",
      schema: {
        type: "string",
        enum: options.sorts,
        default: options.defaultSort,
      },
    }),
    ApiExtension("x-pagination", {
      style: "page-pageSize-sort",
      maximumPageSize,
      contract: {
        page: {
          type: "integer",
          required: false,
          minimum: 1,
          default: 1,
        },
        pageSize: {
          type: "integer",
          required: false,
          minimum: 1,
          maximum: maximumPageSize,
          default: defaultPageSize,
        },
        sort: {
          type: "string",
          required: false,
          enum: options.sorts,
          default: options.defaultSort,
        },
      },
    }),
  );
}

export function ApiRead(options: {
  summary: string;
  description: string;
  responseDescription: string;
  schema: SchemaObject;
  dashboardResource?: boolean;
  created?: boolean;
}) {
  const success = options.created
    ? ApiCreatedResponse({
        description: options.responseDescription,
        schema: options.schema,
      })
    : ApiOkResponse({
        description: options.responseDescription,
        schema: options.schema,
      });
  return applyDecorators(
    ApiOperation({
      summary: options.summary,
      description: options.description,
    }),
    success,
    ApiInternalServerErrorResponse({
      description:
        "Erro inesperado ao processar a consulta. A resposta usa apiErrorSchema.",
      schema: apiErrorSchema,
      example: {
        statusCode: 500,
        message: "Erro interno inesperado.",
        error: "Internal Server Error",
      },
    }),
    ApiExtension("x-read-only", true),
    ApiExtension("x-dashboard-resource", options.dashboardResource ?? false),
  );
}

export function ApiWrite(options: {
  summary: string;
  description: string;
  responseDescription: string;
  schema: SchemaObject;
  created?: boolean;
}) {
  const success = options.created
    ? ApiCreatedResponse({
        description: options.responseDescription,
        schema: options.schema,
      })
    : ApiOkResponse({
        description: options.responseDescription,
        schema: options.schema,
      });
  return applyDecorators(
    ApiOperation({
      summary: options.summary,
      description: options.description,
    }),
    success,
    ApiInternalServerErrorResponse({
      description:
        "Erro inesperado ao processar a operação. A resposta usa apiErrorSchema.",
      schema: apiErrorSchema,
      example: {
        statusCode: 500,
        message: "Erro interno inesperado.",
        error: "Internal Server Error",
      },
    }),
    ApiExtension("x-read-only", false),
    ApiExtension("x-dashboard-resource", false),
  );
}

export function ApiInvalidRequest(
  description = "Parâmetro ou corpo inválido.",
) {
  return applyDecorators(
    ApiBadRequestResponse({
      description,
      schema: apiErrorSchema,
      examples: {
        invalidRequest: {
          summary: "Requisição inválida",
          value: {
            statusCode: 400,
            message: description,
            error: "Bad Request",
          },
        },
      },
    }),
    ApiExtension("x-error-contract", {
      status: 400,
      contentType: "application/json",
      envelope: "statusCode, message, error",
      message:
        "Pode ser texto ou lista de mensagens; o endpoint deve preservar a descrição específica acima.",
    }),
  );
}

export function configureOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Ondaluz Ops REST API")
    .setDescription(
      "Contrato REST da plataforma operacional Ondaluz. Cada operação documenta entradas, saídas, tipos, obrigatoriedade, nulabilidade, limites, enums, exemplos e erros conhecidos. As coleções usam o envelope data/page/pageSize/totalItems/totalPages; os metadados ficam em meta sem alterar o envelope principal. Erros usam statusCode, message e error.",
    )
    .setVersion("1.1.0")
    .setOpenAPIVersion("3.0.3")
    .addServer("/", "Mesma origem da interface web")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "access-token",
    )
    .addTag("Sistema", "Saúde, catálogo e descoberta da plataforma.")
    .addTag("Clientes", "Cadastro consolidado e histórico de CPEs por cliente.")
    .addTag("Atendimento N1", "Contexto e apoio ao primeiro nível de suporte.")
    .addTag(
      "Inventário",
      "CPEs, hardware, firmware, plano e localização topológica.",
    )
    .addTag("Telemetria", "Informs brutos e agregados diários de CPEs.")
    .addTag("Diagnósticos", "Medições remotas TR-143.")
    .addTag("Chamados", "Histórico de suporte e fila operacional do NOC.")
    .addTag("Rede", "Visão consolidada, topologia e agrupamentos detectados.")
    .addTag(
      "Incidentes operacionais",
      "Agrupamentos ativos criados ou aprovados por operadores.",
    )
    .addTag(
      "Operação da plataforma",
      "Carga do dataset e candidatos dos detectores.",
    )
    .addTag(
      "Investigações IA",
      "Investigações auditáveis com MCP somente leitura e revisão humana.",
    )
    .addTag(
      "Dashboard dinâmico",
      "Composição e preferências do painel operacional.",
    )
    .addExtension("x-mcp-catalog", "/mcp")
    .addExtension("x-mcp-openapi-bridge", "/mcp/openapi")
    .addExtension("x-dashboard-contract", {
      discovery: "/api/openapi.json",
      pagination: "page-pageSize-sort",
      dataIsolation:
        "O compositor escolhe bindings; dados operacionais não são enviados ao modelo.",
    })
    .addExtension("x-error-contract", {
      mediaType: "application/json",
      requiredFields: ["statusCode", "message", "error"],
      messageTypes: ["string", "string[]", "object"],
      documentation: "/docs/contratos-api.md#erros-http",
    })
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    deepScanRoutes: true,
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey.replace(/Controller$/, "").toLowerCase()}_${methodKey}`,
  });
  app.get(OpenApiCatalogService).setDocument(document);

  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "Ondaluz Ops · REST API",
    jsonDocumentUrl: "/api/openapi.json",
    yamlDocumentUrl: "/api/openapi.yaml",
    raw: ["json", "yaml"],
    swaggerOptions: {
      deepLinking: true,
      displayOperationId: true,
      docExpansion: "list",
      filter: true,
      operationsSorter: "alpha",
      tagsSorter: "alpha",
      tryItOutEnabled: true,
    },
  });

  return document;
}
