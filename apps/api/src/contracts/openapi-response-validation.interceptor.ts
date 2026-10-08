import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from "@nestjs/common";
import type {
  OpenAPIObject,
  OperationObject,
  SchemaObject,
} from "@nestjs/swagger";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { map, type Observable } from "rxjs";

type JsonSchema = Record<string, any>;

/**
 * Executa os schemas de resposta publicados no OpenAPI.
 *
 * Os endpoints continuam retornando os mesmos objetos; o interceptor apenas
 * impede que uma alteração acidental no service produza JSON incompatível com
 * o contrato que o frontend e o bridge MCP consomem.
 */
@Injectable()
export class OpenApiResponseValidationInterceptor implements NestInterceptor {
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly ajv = new Ajv({
    allErrors: true,
    allowUnionTypes: true,
    strict: false,
  });

  constructor(private readonly document: OpenAPIObject) {
    addFormats(this.ajv);
    this.ajv.addSchema(
      {
        $id: "ondaluz-openapi",
        components: document.components,
      },
      "ondaluz-openapi",
    );
    this.compileResponseSchemas();
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
    }>();
    const path = (request.originalUrl ?? request.url ?? "").split("?")[0];
    const key = this.operationKey(request.method, path);
    const validate = key ? this.validators.get(key) : undefined;
    if (!validate) return next.handle();

    return next.handle().pipe(
      map((value: unknown) => {
        const serializable = JSON.parse(JSON.stringify(value)) as unknown;
        if (validate(serializable)) return value;
        const details = (validate.errors ?? [])
          .slice(0, 3)
          .map((error) => `${error.instancePath || "$"} ${error.message}`)
          .join("; ");
        console.error(
          `[contract] resposta incompatível com OpenAPI em ${request.method} ${path}: ${details}`,
        );
        throw new InternalServerErrorException(
          "A resposta produzida pela API não atende ao contrato publicado.",
        );
      }),
    );
  }

  private compileResponseSchemas(): void {
    for (const [path, item] of Object.entries(this.document.paths ?? {})) {
      for (const method of ["get", "post", "put", "patch", "delete"] as const) {
        const operation = item?.[method] as OperationObject | undefined;
        const schema = this.successSchema(operation);
        if (!schema) continue;
        const key = `${method.toUpperCase()} ${path}`;
        this.validators.set(
          key,
          this.ajv.compile(this.normalizeSchema(schema)),
        );
      }
    }
  }

  private successSchema(
    operation: OperationObject | undefined,
  ): SchemaObject | undefined {
    if (!operation) return undefined;
    const response = (operation.responses?.["200"] ??
      operation.responses?.["201"]) as {
      content?: Record<string, { schema?: SchemaObject }>;
    };
    return response?.content?.["application/json"]?.schema as
      SchemaObject | undefined;
  }

  private operationKey(method: string, actualPath: string): string | undefined {
    const actual = this.pathSegments(actualPath);
    for (const [path, item] of Object.entries(this.document.paths ?? {})) {
      if (!this.matchesPath(actual, this.pathSegments(path))) continue;
      const operation = item?.[method.toLowerCase() as keyof typeof item];
      if (operation) return `${method.toUpperCase()} ${path}`;
    }
    return undefined;
  }

  private matchesPath(actual: string[], documented: string[]): boolean {
    return (
      actual.length === documented.length &&
      actual.every((segment, index) => {
        const expected = documented[index];
        return expected.startsWith("{") || expected === segment;
      })
    );
  }

  private pathSegments(path: string): string[] {
    return path.split("/").filter(Boolean);
  }

  private normalizeSchema(schema: SchemaObject): JsonSchema {
    if (Array.isArray(schema)) {
      return schema.map((item) =>
        this.normalizeSchema(item),
      ) as unknown as JsonSchema;
    }
    const source = schema as JsonSchema;
    if (typeof source.$ref === "string" && source.$ref.startsWith("#/")) {
      return { ...source, $ref: `ondaluz-openapi${source.$ref}` };
    }

    const normalized: JsonSchema = {};
    for (const [key, value] of Object.entries(source)) {
      if (key === "nullable") continue;
      if (key === "properties" && value && typeof value === "object") {
        normalized[key] = Object.fromEntries(
          Object.entries(value).map(([property, propertySchema]) => [
            property,
            this.normalizeSchema(propertySchema as SchemaObject),
          ]),
        );
      } else if (key === "items" && value && typeof value === "object") {
        normalized[key] = this.normalizeSchema(value as SchemaObject);
      } else if (key === "oneOf" || key === "anyOf" || key === "allOf") {
        normalized[key] = (value as SchemaObject[]).map((item) =>
          this.normalizeSchema(item),
        );
      } else {
        normalized[key] = value;
      }
    }
    if (source.nullable === true && source.type) {
      normalized.type = Array.isArray(source.type)
        ? [...source.type, "null"]
        : [source.type, "null"];
    }
    if (source.nullable === true && Array.isArray(source.enum)) {
      normalized.enum = source.enum.includes(null)
        ? source.enum
        : [...source.enum, null];
    }
    return normalized;
  }
}
