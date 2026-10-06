import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { api } from "./api";
import type { DashboardComposition } from "./types";

describe("api client", () => {
  it("carrega e salva a configuração individual do dashboard", async () => {
    const composition = {
      version: "1.0",
      widgets: [],
    } as unknown as DashboardComposition;
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
      return {
        ok: true,
        json: async () => ({ composition, updatedAt: "2026-10-06T12:00:00Z" }),
      } as Response;
    }) as typeof fetch;
    try {
      await api.dashboardPreference("admin-marina");
      await api.saveDashboardPreference("admin-marina", composition);
      assert.deepEqual(calls, [
        {
          path: "/api/dashboard/preferences/admin-marina",
          method: undefined,
          body: null,
        },
        {
          path: "/api/dashboard/preferences/admin-marina",
          method: "PUT",
          body: JSON.stringify({ composition }),
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("envia somente o objetivo para compor o dashboard", async () => {
    const payload = { version: "1.0", widgets: [] };
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
        await api.composeDashboard("Priorize incidentes críticos"),
        payload,
      );
      assert.deepEqual(calls, [
        {
          path: "/api/dashboard/compose",
          method: "POST",
          body: JSON.stringify({ objective: "Priorize incidentes críticos" }),
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("envia o plano atual e o bloco alvo durante uma edição", async () => {
    const payload = { version: "1.0", widgets: [] };
    const currentPlan = payload as unknown as DashboardComposition;
    let sentBody = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      _path: string | URL | Request,
      init?: RequestInit,
    ) => {
      sentBody = String(init?.body ?? "");
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      await api.composeDashboard(
        "Dê mais destaque a este bloco",
        currentPlan,
        "active-cpes",
      );
      assert.deepEqual(JSON.parse(sentBody), {
        objective: "Dê mais destaque a este bloco",
        currentPlan,
        targetWidgetId: "active-cpes",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

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

  it("combina configuração efetiva, catálogo MCP e recursos do dashboard", async () => {
    const runtime = {
      openaiConfigured: true,
      model: "gpt-6-luna",
      mcpPolicy: { endpointCount: 7, toolCount: 26, domains: [] },
    };
    const catalog = {
      rest: {
        operations: [
          { readOnly: true, dashboardResource: true },
          { readOnly: true, dashboardResource: false },
          { readOnly: false, dashboardResource: false },
        ],
      },
      mcp: { endpoints: [] },
    };
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      calls.push(String(path));
      return {
        ok: true,
        json: async () =>
          String(path) === "/api/investigations/config" ? runtime : catalog,
      } as Response;
    }) as typeof fetch;
    try {
      const snapshot = await api.aiConfiguration();
      assert.deepEqual(calls.sort(), ["/api", "/api/investigations/config"]);
      assert.equal(snapshot.runtime.model, "gpt-6-luna");
      assert.equal(snapshot.dashboardResourceCount, 1);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("envia múltiplos filtros estruturados para as listas do dashboard", async () => {
    const payload = {
      data: [],
      page: 1,
      pageSize: 100,
      totalItems: 0,
      totalPages: 0,
    };
    let requestedPath = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      requestedPath = String(path);
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(
        await api.dashboardInventory([
          {
            kind: "city",
            value: "Serra Alta",
            label: "Serra Alta",
            detail: "Cidade",
          },
          {
            kind: "neighborhood",
            value: "Centro",
            label: "Centro",
            detail: "Bairro",
          },
        ]),
        payload,
      );
      const url = new URL(requestedPath, "http://localhost");
      assert.equal(url.pathname, "/api/customers");
      assert.deepEqual(url.searchParams.getAll("filter"), [
        "city:Serra Alta",
        "neighborhood:Centro",
      ]);
      assert.equal(url.searchParams.get("pageSize"), "100");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("combina múltiplos filtros facetados na consulta de tickets", async () => {
    const payload = {
      data: [],
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    };
    let requestedPath = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      requestedPath = String(path);
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      await api.tickets("", 2, [
        {
          kind: "category",
          value: "Lentidão",
          label: "Lentidão",
          detail: "Categoria",
        },
        {
          kind: "category",
          value: "Sem conexão",
          label: "Sem conexão",
          detail: "Categoria",
        },
        {
          kind: "channel",
          value: "WhatsApp",
          label: "WhatsApp",
          detail: "Canal",
        },
      ]);
      const url = new URL(requestedPath, "http://localhost");
      assert.equal(url.pathname, "/api/tickets");
      assert.equal(url.searchParams.get("page"), "2");
      assert.deepEqual(url.searchParams.getAll("filter"), [
        "category:Lentidão",
        "category:Sem conexão",
        "channel:WhatsApp",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("consulta sugestões do autocomplete de tickets", async () => {
    const payload = {
      data: [
        {
          kind: "customer",
          value: "C545968",
          label: "C545968",
          detail: "Cliente",
          count: 3,
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    };
    let requestedPath = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      requestedPath = String(path);
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(await api.ticketFilterOptions("C545"), payload.data);
      const url = new URL(requestedPath, "http://localhost");
      assert.equal(url.pathname, "/api/tickets/filter-options");
      assert.equal(url.searchParams.get("q"), "C545");
      assert.equal(url.searchParams.get("pageSize"), "20");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("combina múltiplos filtros facetados na consulta de diagnósticos", async () => {
    const payload = {
      data: [],
      page: 1,
      pageSize: 25,
      totalItems: 0,
      totalPages: 0,
    };
    let requestedPath = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      requestedPath = String(path);
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      await api.diagnostics("", 3, [
        {
          kind: "state",
          value: "Completed",
          label: "Concluído",
          detail: "Estado do teste",
        },
        {
          kind: "requestedBy",
          value: "NOC",
          label: "NOC",
          detail: "Solicitado por",
        },
      ]);
      const url = new URL(requestedPath, "http://localhost");
      assert.equal(url.pathname, "/api/diagnostics");
      assert.equal(url.searchParams.get("page"), "3");
      assert.deepEqual(url.searchParams.getAll("filter"), [
        "state:Completed",
        "requestedBy:NOC",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("consulta sugestões do autocomplete de diagnósticos", async () => {
    const payload = {
      data: [
        {
          kind: "serial",
          value: "KSTLD199FB78",
          label: "KSTLD199FB78",
          detail: "Kestrel KX-3000",
          count: 8,
        },
      ],
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1,
    };
    let requestedPath = "";
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (path: string | URL | Request) => {
      requestedPath = String(path);
      return { ok: true, json: async () => payload } as Response;
    }) as typeof fetch;
    try {
      assert.deepEqual(
        await api.diagnosticFilterOptions("KSTLD"),
        payload.data,
      );
      const url = new URL(requestedPath, "http://localhost");
      assert.equal(url.pathname, "/api/diagnostics/filter-options");
      assert.equal(url.searchParams.get("q"), "KSTLD");
      assert.equal(url.searchParams.get("pageSize"), "20");
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

  it("solicita a busca especializada por agrupamentos", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (
      path: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push({ path: String(path), method: init?.method });
      return { ok: true, json: async () => ({ queued: 2 }) } as Response;
    }) as typeof fetch;
    try {
      await api.triggerGroupingInvestigations();
      assert.deepEqual(calls, [
        { path: "/api/investigations/trigger/groupings", method: "POST" },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("envia o relato do cliente para o copiloto N1", async () => {
    const payload = {
      assistantMessage: "Confirme se o sintoma ocorre em outros dispositivos.",
      nextSteps: ["Confirmar alcance do sintoma."],
      options: [],
      documentation: "Cliente relata lentidão persistente.",
      disposition: "escalate_noc",
      model: "fallback",
    };
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
        await api.n1Chat("C545968", "Continua em todos os aparelhos", []),
        payload,
      );
      assert.deepEqual(calls, [
        {
          path: "/api/customers/C545968/n1-chat",
          method: "POST",
          body: JSON.stringify({
            message: "Continua em todos os aparelhos",
            history: [],
          }),
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
