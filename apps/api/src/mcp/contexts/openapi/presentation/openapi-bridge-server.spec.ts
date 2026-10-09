import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OpenAPIObject } from "@nestjs/swagger";
import {
  buildOpenApiBridgeRequest,
  executeOpenApiBridgeOperation,
  openApiBridgeOperations,
} from "./openapi-bridge-server.js";

const document = {
  openapi: "3.0.3",
  info: { title: "Bridge test", version: "1.0.0" },
  paths: {
    "/api/customers/{customerId}": {
      get: {
        operationId: "customers_get",
        summary: "Consultar cliente",
        description: "Retorna um cliente pelo identificador.",
        tags: ["Clientes"],
        parameters: [
          {
            name: "customerId",
            in: "path",
            required: true,
            description: "Código do cliente.",
            schema: { type: "string" },
          },
          {
            name: "fields",
            in: "query",
            required: false,
            schema: { type: "array", items: { type: "string" } },
          },
        ],
        responses: { 200: { description: "Cliente." } },
        "x-read-only": true,
        "x-dashboard-resource": true,
      },
    },
    "/api/tickets/{ticketId}/status": {
      patch: {
        operationId: "tickets_update_status",
        summary: "Atualizar chamado",
        description: "Atualiza o estado operacional do chamado.",
        parameters: [
          {
            name: "ticketId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["open", "closed"],
                  },
                  note: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Chamado atualizado." } },
        "x-read-only": false,
      },
    },
  },
} as OpenAPIObject;

describe("bridge OpenAPI para MCP", () => {
  it("gera uma ferramenta por operationId com o contrato de entrada", () => {
    const operations = openApiBridgeOperations(document);
    assert.deepEqual(
      operations.map(({ name }) => name),
      ["customers_get", "tickets_update_status"],
    );
    assert.deepEqual(operations[0].inputJsonSchema.required, ["customerId"]);
    assert.deepEqual(operations[1].inputJsonSchema.required, [
      "ticketId",
      "status",
    ]);
    assert.equal(operations[0].readOnly, true);
    assert.equal(operations[0].dashboardResource, true);
    assert.equal(operations[1].readOnly, false);
    assert.equal(operations[1].dashboardResource, false);
  });

  it("traduz parâmetros de path e query para a chamada REST", () => {
    const [operation] = openApiBridgeOperations(document);
    const request = buildOpenApiBridgeRequest(
      "http://127.0.0.1:3000",
      operation,
      {
        customerId: "C 123",
        fields: ["city", "plan"],
      },
    );
    assert.equal(
      request.url.toString(),
      "http://127.0.0.1:3000/api/customers/C%20123?fields=city&fields=plan",
    );
    assert.equal(request.init.method, "GET");
    assert.equal(request.init.body, undefined);
  });

  it("encaminha somente o Bearer da requisição MCP para o REST interno", async () => {
    const [operation] = openApiBridgeOperations(document);
    let forwardedAuthorization: string | null = null;
    const result = await executeOpenApiBridgeOperation(
      operation,
      { customerId: "C545968" },
      {
        baseUrl: "http://127.0.0.1:3000",
        getAuthorizationHeader: () => "  bearer jwt-teste  ",
        fetchImplementation: async (_input, init) => {
          forwardedAuthorization = new Headers(init.headers).get(
            "authorization",
          );
          return new Response(JSON.stringify({ customer_id: "C545968" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    assert.equal(forwardedAuthorization, "Bearer jwt-teste");
    assert.equal(result.isError, undefined);
  });

  it("não encaminha credenciais que não sejam Bearer", async () => {
    const [operation] = openApiBridgeOperations(document);
    let forwardedAuthorization: string | null = "unexpected";
    await executeOpenApiBridgeOperation(
      operation,
      { customerId: "C545968" },
      {
        baseUrl: "http://127.0.0.1:3000",
        getAuthorizationHeader: () => "Basic segredo-nao-encaminhar",
        fetchImplementation: async (_input, init) => {
          forwardedAuthorization = new Headers(init.headers).get(
            "authorization",
          );
          return new Response(JSON.stringify({ customer_id: "C545968" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    );

    assert.equal(forwardedAuthorization, null);
  });

  it("separa o corpo JSON dos parâmetros da rota", () => {
    const [, operation] = openApiBridgeOperations(document);
    const request = buildOpenApiBridgeRequest(
      "http://127.0.0.1:3000",
      operation,
      {
        ticketId: "T001",
        status: "closed",
        note: null,
      },
    );
    assert.equal(
      request.url.toString(),
      "http://127.0.0.1:3000/api/tickets/T001/status",
    );
    assert.equal(request.init.method, "PATCH");
    assert.deepEqual(JSON.parse(String(request.init.body)), {
      status: "closed",
      note: null,
    });
  });
});
