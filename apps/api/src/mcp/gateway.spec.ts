import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { AddressInfo } from "node:net";
import { createMcpGateway } from "./gateway.js";
import { Queryable } from "./shared/infrastructure/database.js";
import { McpStructuredLogger } from "./shared/infrastructure/mcp-logger.js";

describe("McpGateway", () => {
  const logs: string[] = [];
  const database: Queryable = {
    async query() {
      throw new Error("O catálogo não deve consultar o banco.");
    },
  };
  const gateway = createMcpGateway(database, {
    allowedHosts: ["127.0.0.1"],
    logger: new McpStructuredLogger((line) => logs.push(line)),
  });
  const server = createServer(async (request, response) => {
    try {
      if (await gateway.handle(request, response)) return;
      response.writeHead(204).end();
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  let baseUrl = "";

  before(async () => {
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    await gateway.close();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });

  it("publica o catálogo MCP na mesma origem da API", async () => {
    const response = await fetch(`${baseUrl}/mcp`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      restBasePath: string;
      mcpBasePath: string;
      endpoints: unknown[];
    };
    assert.equal(body.restBasePath, "/api");
    assert.equal(body.mcpBasePath, "/mcp");
    assert.equal(body.endpoints.length, 8);
    const completed = logs
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find((record) => record.event === "mcp.request.completed");
    assert.equal(completed?.route, "/mcp");
    assert.equal(typeof completed?.request_id, "string");
    assert.equal(typeof completed?.duration_ms, "number");
  });

  it("repassa um corpo JSON válido ao transporte MCP", async () => {
    const response = await fetch(`${baseUrl}/mcp/operations`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "gateway-test", version: "1.0.0" },
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /protocolVersion/);
  });

  it("deixa rotas não MCP seguirem para o NestJS", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 204);
  });
});
