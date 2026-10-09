import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseStructuredResponse } from "./ticket-triage-agent";

describe("parseStructuredResponse", () => {
  it("aceita JSON cercado por texto ou por uma segunda saída", () => {
    assert.deepEqual(parseStructuredResponse('resultado:\n{"ok":true}\n'), {
      ok: true,
    });
    assert.deepEqual(
      parseStructuredResponse('{"ok":true}\n{"duplicado":true}'),
      { ok: true },
    );
  });
});
