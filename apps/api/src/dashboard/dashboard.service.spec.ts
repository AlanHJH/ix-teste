import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseService } from "../database";
import { OpenApiCatalogService } from "../openapi-catalog.service";
import { fallbackDashboardPlan } from "./dashboard-plan";
import { DashboardService } from "./dashboard.service";
import type { DashboardComposition } from "./dashboard.types";

function openApiCatalog() {
  const service = new OpenApiCatalogService();
  service.setDocument({
    openapi: "3.0.3",
    info: { title: "teste", version: "1.0.0" },
    paths: Object.fromEntries(
      Array.from({ length: 18 }, (_, index) => [
        `/api/resource-${index + 1}`,
        {
          get: {
            operationId: `resource_${index + 1}`,
            summary: `Recurso ${index + 1}`,
            description:
              "Recurso REST somente leitura disponível para compor o dashboard.",
            "x-dashboard-resource": true,
            "x-read-only": true,
            responses: { 200: { description: "Resposta de teste." } },
          },
        },
      ]),
    ),
  });
  return service;
}

function composition(): DashboardComposition {
  return {
    ...fallbackDashboardPlan("Mostre a saúde geral da operação."),
    objective: "Mostre a saúde geral da operação.",
    generatedAt: "2026-10-06T12:00:00.000Z",
    generatedBy: "fallback",
    model: null,
    discovery: {
      protocol: "MCP",
      mode: "openapi-bridge",
      resourceCount: 23,
      endpoint: "/mcp/openapi",
      document: "/api/openapi.json",
    },
    runtimeData: { protocol: "REST", endpoints: ["/api/network/overview"] },
  };
}

describe("preferências do dashboard", () => {
  it("carrega a composição persistida pelo usuário", async () => {
    const saved = composition();
    const database = {
      query: async () => ({
        rows: [{ composition: saved, updated_at: "2026-10-06T12:30:00.000Z" }],
      }),
    } as unknown as DatabaseService;
    const service = new DashboardService(database, openApiCatalog());
    const preference = await service.getPreference("admin-marina");
    assert.equal(preference.composition?.title, saved.title);
    assert.equal(preference.composition?.discovery.protocol, "MCP");
    assert.equal(preference.composition?.discovery.endpoint, "/mcp/openapi");
    assert.ok((preference.composition?.discovery.resourceCount ?? 0) >= 15);
    assert.equal(preference.updatedAt, "2026-10-06T12:30:00.000Z");
  });

  it("migra a descoberta MCP legada para o bridge OpenAPI atual", async () => {
    const saved = {
      ...composition(),
      discovery: {
        protocol: "MCP",
        mode: "catalog-only",
        toolCount: 26,
      },
    };
    const database = {
      query: async () => ({
        rows: [{ composition: saved, updated_at: "2026-10-06T12:30:00.000Z" }],
      }),
    } as unknown as DatabaseService;
    const service = new DashboardService(database, openApiCatalog());
    const preference = await service.getPreference("admin-marina");
    assert.equal(preference.composition?.discovery.protocol, "MCP");
    assert.equal(preference.composition?.discovery.mode, "openapi-bridge");
    assert.equal(
      preference.composition?.discovery.document,
      "/api/openapi.json",
    );
    assert.ok((preference.composition?.discovery.resourceCount ?? 0) >= 15);
  });

  it("salva a composição com upsert isolado por usuário", async () => {
    const saved = composition();
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const database = {
      query: async (sql: string, params: unknown[]) => {
        calls.push({ sql, params });
        return { rows: [{ updated_at: "2026-10-06T12:35:00.000Z" }] };
      },
    } as unknown as DatabaseService;
    const service = new DashboardService(database, openApiCatalog());
    const preference = await service.savePreference("noc-renata", saved);
    assert.match(calls[0].sql, /ON CONFLICT \(user_id\) DO UPDATE/);
    assert.equal(calls[0].params[0], "noc-renata");
    assert.equal(preference.updatedAt, "2026-10-06T12:35:00.000Z");
  });

  it("rejeita identificador de usuário fora do contrato", async () => {
    const database = {
      query: async () => ({ rows: [] }),
    } as unknown as DatabaseService;
    const service = new DashboardService(database, openApiCatalog());
    await assert.rejects(
      service.getPreference("../../outro"),
      /Usuário inválido/,
    );
  });
});
