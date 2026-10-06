import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseService } from "../database";
import { IncidentsService } from "./incidents.service";

describe("IncidentsService.create", () => {
  it("cria incidente de PON e vincula o chamado N1 de origem", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[] = []) {
        queries.push({ text, params });
        if (text.includes("count(*)::int AS affected")) {
          return { rows: [{ affected: 37 }] };
        }
        if (text.includes("SELECT ticket_id FROM tickets")) {
          return { rows: [{ ticket_id: "TN1-ORIGEM" }] };
        }
        return {
          rows: [
            {
              incident_id: "INC-TESTE123",
              affected_cpes: 37,
              linked_ticket_id: "TN1-ORIGEM",
            },
          ],
        };
      },
    } as unknown as DatabaseService;

    const result = await new IncidentsService(database).create({
      openedBy: "NOC-07",
      title: "Perda compartilhada na PON 1/7",
      severity: "high",
      scopeType: "pon",
      identifier: "",
      olt: "olt-2",
      pon: "1/7",
      cto: "",
      probableCause: "Possível degradação no trecho comum.",
      recommendedAction: "Inspecionar a porta e o alimentador óptico.",
      originTicketId: "TN1-ORIGEM",
    });

    assert.equal(result.incident_id, "INC-TESTE123");
    assert.equal(queries.length, 3);
    assert.deepEqual(queries[0].params, ["OLT-2", "1/7"]);
    assert.equal(queries[2].params[4], 37);
    assert.equal(queries[2].params[9], "TN1-ORIGEM");
    assert.match(queries[2].text, /noc_status='linked'/);
    assert.match(queries[2].text, /closed_at=coalesce\(closed_at, now\(\)\)/);
  });

  it("não cria incidente para um escopo sem CPE ativa", async () => {
    const database = {
      async query() {
        return { rows: [{ affected: 0 }] };
      },
    } as unknown as DatabaseService;

    await assert.rejects(
      () =>
        new IncidentsService(database).create({
          openedBy: "NOC-07",
          title: "Incidente em OLT inexistente",
          severity: "medium",
          scopeType: "olt",
          identifier: "",
          olt: "OLT-99",
          pon: "",
          cto: "",
          probableCause: "Hipótese ainda em validação.",
          recommendedAction: "Validar o inventário antes da atuação.",
          originTicketId: null,
        }),
      /não contém nenhuma CPE ativa/,
    );
  });
});

describe("IncidentsService.options", () => {
  it("lista somente PONs pertencentes à OLT selecionada", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[]) {
        queries.push({ text, params });
        if (/count\(\*\)/.test(text)) return { rows: [{ total: 1 }] };
        return {
          rows: [{ value: "1/7", label: "PON 1/7 · OLT-2" }],
        };
      },
    } as unknown as DatabaseService;

    const result = await new IncidentsService(database).options({
      type: "pon",
      query: "1/",
      olt: "olt-2",
      pon: "",
      page: 1,
      pageSize: 40,
      sort: "value_asc",
    });

    assert.deepEqual(result.data, [{ value: "1/7", label: "PON 1/7 · OLT-2" }]);
    const itemsQuery = queries.find(({ text }) => /ORDER BY value/.test(text));
    assert.match(itemsQuery?.text ?? "", /olt=\$1/);
    assert.deepEqual(itemsQuery?.params, ["OLT-2", "1/", 40, 0]);
  });

  it("não varre clientes antes de receber dois caracteres", async () => {
    const database = {
      async query() {
        throw new Error("não deveria consultar o banco");
      },
    } as unknown as DatabaseService;

    const result = await new IncidentsService(database).options({
      type: "customer",
      query: "C",
      olt: "",
      pon: "",
      page: 1,
      pageSize: 40,
      sort: "value_asc",
    });

    assert.deepEqual(result.data, []);
  });
});

describe("IncidentsService.close", () => {
  it("marca o agrupamento ativo como resolvido sem apagar o histórico", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[] = []) {
        queries.push({ text, params });
        return {
          rows: [{ incident_id: "INC-TESTE123", status: "resolved" }],
        };
      },
    } as unknown as DatabaseService;

    const result = await new IncidentsService(database).close(
      "inc-teste123",
      "resolved",
    );

    assert.deepEqual(result, {
      incident_id: "INC-TESTE123",
      status: "resolved",
    });
    assert.deepEqual(queries[0].params, ["INC-TESTE123"]);
    assert.match(queries[0].text, /SET status='resolved'/);
    assert.match(
      queries[0].text,
      /status IN \('open', 'mitigating', 'monitoring'\)/,
    );
  });

  it("rejeita um agrupamento inexistente ou já encerrado", async () => {
    const database = {
      async query() {
        return { rows: [] };
      },
    } as unknown as DatabaseService;

    await assert.rejects(
      () => new IncidentsService(database).close("INC-INEXISTENTE", "resolved"),
      /não encontrado ou já encerrado/,
    );
  });
});

describe("IncidentsService.resolveProposedScope", () => {
  it("recalcula no inventário o alcance proposto pelo agente", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[] = []) {
        queries.push({ text, params });
        return { rows: [{ affected: 62 }] };
      },
    } as unknown as DatabaseService;

    const result = await new IncidentsService(database).resolveProposedScope({
      type: "pon",
      identifier: "texto livre do modelo",
      olt: "olt-2",
      pon: "1/7",
      cto: null,
    });

    assert.equal(result.affected, 62);
    assert.deepEqual(result.scope, {
      type: "pon",
      identifier: "OLT-2 · PON 1/7",
      olt: "OLT-2",
      pon: "1/7",
      cto: null,
    });
    assert.deepEqual(queries[0].params, ["OLT-2", "1/7"]);
  });
});
