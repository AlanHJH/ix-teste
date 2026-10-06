import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compactToolOutput,
  normalizeAgentToolArguments,
} from "./mcp-tool-registry";

describe("limites das ferramentas do agente", () => {
  it("reduz paginações grandes antes de consultar o MCP", () => {
    assert.deepEqual(
      normalizeAgentToolArguments({ pageSize: 100, page: 2, olt: "OLT-2" }),
      { pageSize: 50, page: 2, olt: "OLT-2" },
    );
  });

  it("mantém respostas pequenas intactas", () => {
    const payload = { totalItems: 1, data: [{ serial: "ABC" }] };
    assert.equal(compactToolOutput(payload, 500), JSON.stringify(payload));
  });

  it("trunca páginas grandes em JSON válido", () => {
    const payload = {
      totalItems: 50,
      data: Array.from({ length: 50 }, (_, index) => ({
        serial: `SERIAL-${index}`,
        detail: "x".repeat(80),
      })),
    };
    const output = compactToolOutput(payload, 500);
    const parsed = JSON.parse(output) as {
      truncatedForAgent: boolean;
      originalItemCount: number;
      data: unknown[];
    };
    assert.ok(output.length <= 500);
    assert.equal(parsed.truncatedForAgent, true);
    assert.equal(parsed.originalItemCount, 50);
    assert.ok(parsed.data.length < 50);
  });
});
