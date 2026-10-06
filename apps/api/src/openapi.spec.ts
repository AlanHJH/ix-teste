import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpenAPIObject } from "@nestjs/swagger";
import { OpenApiCatalogService } from "./openapi-catalog.service";

function catalogService() {
  const service = new OpenApiCatalogService();
  service.setDocument({
    openapi: "3.0.3",
    info: { title: "teste", version: "1.0.0" },
    paths: {
      "/api/inventory": {
        get: {
          operationId: "inventory_list",
          summary: "Consultar inventário de CPEs",
          description:
            "Consulta paginada do inventário com filtros técnicos e topológicos para o dashboard dinâmico.",
          "x-dashboard-resource": true,
          "x-read-only": true,
          parameters: [
            { name: "sort", in: "query", schema: { type: "string" } },
          ],
          responses: {
            200: {
              description: "Página do inventário.",
              content: {
                "application/json": { schema: { type: "object" } },
              },
            },
          },
        },
      },
      "/api/investigations/{investigationId}/review": {
        patch: {
          operationId: "investigations_review",
          summary: "Revisar investigação",
          description: "Decisão humana que altera o estado da investigação.",
          // Mesmo uma marcação equivocada como recurso visual não pode expor
          // uma mutação ao compositor.
          "x-dashboard-resource": true,
          "x-read-only": false,
          responses: { 200: { description: "Revisão concluída." } },
        },
      },
      "/api/tickets": {
        post: {
          operationId: "tickets_create",
          summary: "Criar chamado",
          description: "Cria um chamado de suporte.",
          "x-dashboard-resource": false,
          "x-read-only": false,
          responses: { 201: { description: "Chamado criado." } },
        },
      },
    },
  } as OpenAPIObject);
  return service;
}

describe("catálogo OpenAPI do dashboard", () => {
  it("deriva o catálogo REST do mesmo documento gerado pelos controllers", () => {
    const operations = catalogService().restOperations();
    assert.equal(operations.length, 3);
    assert.deepEqual(
      operations.map(({ method, path }) => `${method} ${path}`),
      [
        "GET /api/inventory",
        "PATCH /api/investigations/{investigationId}/review",
        "POST /api/tickets",
      ],
    );
  });

  it("expõe apenas recursos marcados para descoberta", () => {
    const catalog = catalogService().dashboardResources();
    assert.equal(catalog.length, 1);
    assert.equal(catalog[0].method, "GET");
    assert.equal(catalog[0].readOnly, true);
    assert.ok((catalog[0].description?.length ?? 0) > 40);
    assert.equal(catalog[0].path, "/api/inventory");
    assert.ok(
      catalog[0].parameters.some(
        (parameter) => !("$ref" in parameter) && parameter.name === "sort",
      ),
    );
  });

  it("não oferece mutações ao compositor", () => {
    const catalog = catalogService().dashboardResources();
    assert.equal(
      catalog.some((resource) => resource.path.includes("/review")),
      false,
    );
    assert.equal(
      catalog.some((resource) => resource.operationId === "tickets_create"),
      false,
    );
  });
});
