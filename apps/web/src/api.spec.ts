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

  it("consulta opções dependentes para criar um agrupamento", async () => {
    const payload = {
      type: "pon",
      items: [{ value: "1/7", label: "PON 1/7 · OLT-2" }],
    };
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      calls.push(String(path));
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(
        await api.incidentOptions({
          type: "pon",
          query: "1/",
          olt: "OLT-2",
        }),
        payload,
      );
      assert.match(calls[0], /^\/api\/incidents\/options\?/);
      assert.match(calls[0], /type=pon/);
      assert.match(calls[0], /olt=OLT-2/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("encerra um agrupamento pelo identificador usando PATCH", async () => {
    const payload = { incident_id: "INC-TESTE123", status: "resolved" };
    const calls: Array<{ path: string; method?: string }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      path: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ path: String(path), method: init?.method });
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(
        await api.closeOperationalIncident("INC-TESTE123"),
        payload,
      );
      assert.deepEqual(calls, [
        {
          path: "/api/incidents/INC-TESTE123/status",
          method: "PATCH",
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("encerra um agrupamento detectado usando o mesmo estado resolvido", async () => {
    const payload = { grouping_id: "pon-olt2-ja", status: "resolved" };
    const calls: Array<{
      path: string;
      method?: string;
      body?: string | null;
    }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      path: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({
        path: String(path),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : null,
      });
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(await api.closeDetectedGrouping("pon-olt2-ja"), payload);
      assert.deepEqual(calls, [
        {
          path: "/api/network/incidents/pon-olt2-ja/status",
          method: "PATCH",
          body: JSON.stringify({ status: "resolved" }),
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("encerra um chamado N1 em andamento usando PATCH", async () => {
    const payload = { ticket_id: "TN1-TESTE123", noc_status: "closed" };
    const calls: Array<{
      path: string;
      method?: string;
      body?: string | null;
    }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      path: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({
        path: String(path),
        method: init?.method,
        body: typeof init?.body === "string" ? init.body : null,
      });
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(
        await api.updateNocTicketStatus("TN1-TESTE123", "closed"),
        payload,
      );
      assert.deepEqual(calls, [
        {
          path: "/api/tickets/TN1-TESTE123/noc-status",
          method: "PATCH",
          body: '{"status":"closed"}',
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
