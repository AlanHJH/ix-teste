import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MCP_ENDPOINTS } from "./catalog.js";

describe("catálogo MCP", () => {
  it("mantém um endpoint exclusivo por contexto de domínio", () => {
    assert.equal(new Set(MCP_ENDPOINTS.map(({ path }) => path)).size, 8);
    assert.equal(new Set(MCP_ENDPOINTS.map(({ domain }) => domain)).size, 8);
    assert.ok(MCP_ENDPOINTS.every(({ path }) => path.startsWith("/mcp/")));
  });
});
