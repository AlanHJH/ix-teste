import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseService } from "../database";
import { PostgresTicketsRepository } from "./infrastructure/postgres-tickets.repository";
import { TicketsService } from "./tickets.service";

describe("TicketsService.create", () => {
  it("abre um chamado N1 vinculado ao problema do NOC", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[]) {
        queries.push({ text, params });
        if (text.includes("detected_group_states")) {
          return { rows: [] };
        }
        if (text.includes("FROM inventory")) {
          return { rows: [{ customer_id: "C545968" }] };
        }
        return {
          rows: [
            {
              ticket_id: "TN1-TESTE123",
              resolution: "Escalado para NOC",
              related_problem_id: "pon-olt2-ja",
            },
          ],
        };
      },
    } as unknown as DatabaseService;

    const result = await new TicketsService(
      new PostgresTicketsRepository(database),
    ).create({
      customerId: "c545968",
      openedBy: "N1-42",
      category: "Sem conexão",
      description: "Cliente relata quedas recorrentes durante a ligação.",
      outcome: "escalar_noc",
      relatedProblemId: "pon-olt2-ja",
      sourcePayload: {
        cpn: { protocolo: "CPN-42", prioridade: "alta" },
        observacoes: ["cliente confirmou queda em todos os dispositivos"],
      },
    });

    assert.equal(result.ticket_id, "TN1-TESTE123");
    assert.equal(result.related_problem_id, "pon-olt2-ja");
    assert.equal(queries.length, 3);
    assert.equal(queries[2].params[1], "C545968");
    assert.equal(queries[2].params[7], "pon-olt2-ja");
    assert.deepEqual(queries[2].params[8], {
      cpn: { protocolo: "CPN-42", prioridade: "alta" },
      observacoes: ["cliente confirmou queda em todos os dispositivos"],
    });
  });

  it("rejeita vínculo desconhecido antes de gravar", async () => {
    const database = {
      async query() {
        throw new Error("não deveria consultar o banco");
      },
    } as unknown as DatabaseService;

    await assert.rejects(
      () =>
        new TicketsService(new PostgresTicketsRepository(database)).create({
          customerId: "C545968",
          openedBy: "N1-42",
          category: "Sem conexão",
          description: "Cliente relata quedas recorrentes durante a ligação.",
          outcome: "escalar_noc",
          relatedProblemId: "incidente-inexistente",
        }),
      /Problema relacionado inválido/,
    );
  });

  it("rejeita vínculo com agrupamento detectado já encerrado", async () => {
    const database = {
      async query(text: string) {
        if (text.includes("detected_group_states")) {
          return { rows: [{ grouping_id: "pon-olt2-ja" }] };
        }
        throw new Error("não deveria continuar depois da validação");
      },
    } as unknown as DatabaseService;

    await assert.rejects(
      () =>
        new TicketsService(new PostgresTicketsRepository(database)).create({
          customerId: "C545968",
          openedBy: "N1-42",
          category: "Sem conexão",
          description: "Cliente relata quedas recorrentes durante a ligação.",
          outcome: "escalar_noc",
          relatedProblemId: "pon-olt2-ja",
        }),
      /Agrupamento relacionado não está ativo/,
    );
  });

  it("aceita vínculo com um incidente operacional ativo", async () => {
    const queries: string[] = [];
    const database = {
      async query(text: string) {
        queries.push(text);
        if (text.includes("FROM operational_incidents")) {
          return { rows: [{ incident_id: "INC-AABBCCDD" }] };
        }
        if (text.includes("FROM inventory")) {
          return { rows: [{ customer_id: "C545968" }] };
        }
        return {
          rows: [
            {
              ticket_id: "TN1-INCIDENTE",
              resolution: "Escalado para NOC",
              related_problem_id: "INC-AABBCCDD",
            },
          ],
        };
      },
    } as unknown as DatabaseService;

    const result = await new TicketsService(
      new PostgresTicketsRepository(database),
    ).create({
      customerId: "C545968",
      openedBy: "N1-42",
      category: "Sem conexão",
      description: "Cliente relata quedas recorrentes durante a ligação.",
      outcome: "escalar_noc",
      relatedProblemId: "INC-AABBCCDD",
    });

    assert.equal(result.related_problem_id, "INC-AABBCCDD");
    assert.equal(queries.length, 3);
  });
});

describe("TicketsService.updateNocStatus", () => {
  it("move um chamado recebido para em andamento", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[]) {
        queries.push({ text, params });
        return {
          rows: [
            {
              ticket_id: "TN1-KANBAN1",
              noc_status: "in_progress",
            },
          ],
        };
      },
    } as unknown as DatabaseService;

    const result = await new TicketsService(
      new PostgresTicketsRepository(database),
    ).updateNocStatus("tn1-kanban1", "in_progress");

    assert.equal(result.noc_status, "in_progress");
    assert.match(queries[0].text, /noc_status='pending'/);
    assert.deepEqual(queries[0].params, ["TN1-KANBAN1", "in_progress"]);
  });

  it("encerra um chamado em andamento e preserva o registro", async () => {
    const queries: Array<{ text: string; params: unknown[] }> = [];
    const database = {
      async query(text: string, params: unknown[]) {
        queries.push({ text, params });
        return {
          rows: [
            {
              ticket_id: "TN1-KANBAN2",
              noc_status: "closed",
              closed_at: "2026-10-05T22:00:00.000Z",
            },
          ],
        };
      },
    } as unknown as DatabaseService;

    const result = await new TicketsService(
      new PostgresTicketsRepository(database),
    ).updateNocStatus("tn1-kanban2", "closed");

    assert.equal(result.noc_status, "closed");
    assert.match(queries[0].text, /closed_at=CASE/);
    assert.match(queries[0].text, /noc_status='in_progress'/);
    assert.deepEqual(queries[0].params, ["TN1-KANBAN2", "closed"]);
  });
});
