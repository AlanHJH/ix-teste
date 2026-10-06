import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mcpJson } from "./mcp.js";

describe("mcpJson", () => {
  it("normaliza datas para conteúdo estruturado JSON", () => {
    const result = mcpJson({ at: new Date("2026-10-05T12:00:00Z") });
    assert.deepEqual(result.structuredContent, {
      at: "2026-10-05T12:00:00.000Z",
    });
  });

  it("envolve listas em um objeto de conteúdo estruturado", () => {
    assert.deepEqual(mcpJson(["a", "b"]).structuredContent, {
      data: ["a", "b"],
    });
  });
});
