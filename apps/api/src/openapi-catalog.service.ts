import { Injectable } from "@nestjs/common";
import type { OpenAPIObject, OperationObject } from "@nestjs/swagger";

type CatalogOperation = OperationObject & {
  "x-dashboard-resource"?: boolean;
  "x-read-only"?: boolean;
};

@Injectable()
export class OpenApiCatalogService {
  private document: OpenAPIObject | null = null;

  setDocument(document: OpenAPIObject): void {
    this.document = document;
  }

  getDocument(): OpenAPIObject | null {
    return this.document;
  }

  restOperations() {
    if (!this.document) return [];
    const methods = new Set(["get", "post", "put", "patch", "delete"]);
    return Object.entries(this.document.paths).flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => methods.has(method))
        .map(([method, operationValue]) => {
          const operation = operationValue as CatalogOperation;
          return {
            method: method.toUpperCase(),
            path,
            operationId: operation.operationId,
            summary: operation.summary,
            readOnly: operation["x-read-only"] === true,
            dashboardResource: operation["x-dashboard-resource"] === true,
          };
        }),
    );
  }

  dashboardResources() {
    if (!this.document) return [];
    return Object.entries(this.document.paths).flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(
          ([method, operation]) =>
            ["get", "post", "put", "patch", "delete"].includes(method) &&
            (operation as CatalogOperation)["x-dashboard-resource"] === true &&
            (operation as CatalogOperation)["x-read-only"] === true,
        )
        .map(([method, operationValue]) => {
          const operation = operationValue as CatalogOperation;
          const response = operation.responses?.["200"];
          const responseSchema =
            response && "$ref" in response === false
              ? response.content?.["application/json"]?.schema
              : undefined;
          return {
            method: method.toUpperCase(),
            path,
            operationId: operation.operationId,
            summary: operation.summary,
            description: operation.description,
            parameters: operation.parameters ?? [],
            responseSchema,
            readOnly: operation["x-read-only"] === true,
          };
        }),
    );
  }
}
