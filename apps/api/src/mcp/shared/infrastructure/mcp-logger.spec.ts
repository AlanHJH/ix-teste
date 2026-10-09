import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mcpJson } from "../presentation/mcp.js";
import {
  McpRequestLogContext,
  McpStructuredLogger,
  mcpRequestContext,
} from "./mcp-logger.js";

function context(logger: McpStructuredLogger): McpRequestLogContext {
  return {
    requestId: "req-123",
    correlationId: "corr-456",
    sessionId: "session-789",
    authorizationHeader: null,
    route: "/mcp/application",
    httpMethod: "POST",
    rpcMethod: "tools/call",
    rpcId: 7,
    tool: "customers_get",
    resourceUri: null,
    startedAt: process.hrtime.bigint(),
    logger,
  };
}

describe("McpStructuredLogger", () => {
  it("emite uma linha JSON e oculta credenciais", () => {
    const lines: string[] = [];
    const logger = new McpStructuredLogger((line) => lines.push(line));

    logger.info("mcp.request.completed", {
      request_id: "req-123",
      input: {
        customerId: "C545968",
        authorization: "Bearer segredo",
        nested: { apiKey: "chave" },
      },
    });

    const record = JSON.parse(lines[0]) as {
      event: string;
      input: {
        customerId: string;
        authorization: string;
        nested: { apiKey: string };
      };
    };
    assert.equal(record.event, "mcp.request.completed");
    assert.equal(record.input.customerId, "C545968");
    assert.equal(record.input.authorization, "[REDACTED]");
    assert.equal(record.input.nested.apiKey, "[REDACTED]");
  });

  it("registra o resultado da ferramenta com a mesma correlação da requisição", () => {
    const lines: string[] = [];
    const logger = new McpStructuredLogger((line) => lines.push(line));

    mcpRequestContext.run(context(logger), () => {
      mcpJson({ customer_id: "C545968", status: "active" });
    });

    const record = JSON.parse(lines[0]) as {
      event: string;
      request_id: string;
      correlation_id: string;
      tool: string;
      result: { customer_id: string; status: string };
    };
    assert.equal(record.event, "mcp.tool.result");
    assert.equal(record.request_id, "req-123");
    assert.equal(record.correlation_id, "corr-456");
    assert.equal(record.tool, "customers_get");
    assert.deepEqual(record.result, {
      customer_id: "C545968",
      status: "active",
    });
  });
});
