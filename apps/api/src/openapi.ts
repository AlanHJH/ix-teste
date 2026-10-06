import { applyDecorators, type INestApplication } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtension,
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
  description: "Erro HTTP padronizado pelo NestJS.",
  required: ["statusCode", "message"],
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
    ApiExtension("x-read-only", false),
    ApiExtension("x-dashboard-resource", false),
  );
}

export function ApiInvalidRequest(
  description = "Parâmetro ou corpo inválido.",
) {
  return ApiBadRequestResponse({ description, schema: apiErrorSchema });
}

export function configureOpenApi(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Ondaluz Ops REST API")
    .setDescription(
      "Contrato REST da plataforma operacional Ondaluz. As coleções usam o envelope data/page/pageSize/totalItems/totalPages. Os metadados ficam junto de cada rota no controller correspondente.",
    )
    .setVersion("1.1.0")
    .setOpenAPIVersion("3.0.3")
    .addServer("/", "Mesma origem da interface web")
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
