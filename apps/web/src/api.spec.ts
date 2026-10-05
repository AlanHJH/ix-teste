import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api } from "./api";

describe("api client", () => {
  it("consulta o endpoint consolidado do NOC", async () => {
    const payload = {
      asOf: "2026-08-30",
      kpis: {},
      incidents: [],
      weeklyTickets: [],
    };
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      calls.push(String(path));
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(await api.overview(), payload);
      assert.deepEqual(calls, ["/api/network/overview"]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
