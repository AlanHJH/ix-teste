import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecutionContext } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { firstValueFrom, of } from "rxjs";
import { ticketSchema } from "../tickets/tickets.controller";
import { OpenApiResponseValidationInterceptor } from "./openapi-response-validation.interceptor";

const ticket = {
  ticket_id: "TN1-NULO123",
  opened_at: "2026-10-09 10:00:00+00",
  customer_id: "C583735",
  channel: "Telefone",
  category: "Sem conexão",
  description: "Cliente relata ausência de conexão durante o atendimento.",
  resolution: "Escalado para NOC",
  closed_at: null,
  handling_minutes: null,
  source: "n1",
  opened_by: "Marina Costa",
  related_problem_id: null,
  noc_status: "pending",
  source_payload: {},
  ai_triage_status: "unprocessed",
  ai_triage_run_id: null,
  ai_triage_category: null,
  ai_triage_confidence: null,
  ai_triage_action: null,
  ai_triage_reason: null,
  ai_triage_review_required: true,
  ai_triage_at: null,
  olt: null,
  pon: null,
  cto: null,
};

const document = {
  openapi: "3.0.3",
  info: { title: "Ticket contract test", version: "1.0.0" },
  paths: {
    "/api/tickets": {
      post: {
        responses: {
          "201": {
            description: "Chamado criado.",
            content: { "application/json": { schema: ticketSchema } },
          },
        },
      },
    },
    "/api/tickets/{ticketId}/noc-status": {
      patch: {
        responses: {
          "200": {
            description: "Chamado atualizado.",
            content: { "application/json": { schema: ticketSchema } },
          },
        },
      },
    },
    "/api/tickets/{ticketId}": {
      get: {
        responses: {
          "200": {
            description: "Chamado encontrado.",
            content: { "application/json": { schema: ticketSchema } },
          },
        },
      },
    },
  },
} as OpenAPIObject;

function context(method: string, url: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl: url }),
    }),
  } as ExecutionContext;
}

describe("contrato de resposta de tickets", () => {
  it("aceita topologia nula nas respostas de criação e transição NOC", async () => {
    const interceptor = new OpenApiResponseValidationInterceptor(document);

    for (const [method, url] of [
      ["POST", "/api/tickets"],
      ["PATCH", "/api/tickets/TN1-NULO123/noc-status"],
    ]) {
      const result = await firstValueFrom(
        interceptor.intercept(context(method, url), {
          handle: () => of(ticket),
        }),
      );
      assert.equal(result, ticket);
    }
  });

  it("continua rejeitando uma resposta que perde campo obrigatório", async () => {
    const interceptor = new OpenApiResponseValidationInterceptor(document);
    const invalid = { ...ticket, ticket_id: undefined };
    const originalConsoleError = console.error;
    console.error = () => undefined;

    try {
      await assert.rejects(
        () =>
          firstValueFrom(
            interceptor.intercept(context("POST", "/api/tickets"), {
              handle: () => of(invalid),
            }),
          ),
        (error: unknown) =>
          error instanceof Error &&
          error.message ===
            "A resposta produzida pela API não atende ao contrato publicado.",
      );
    } finally {
      console.error = originalConsoleError;
    }
  });

  it("aceita categorias históricas fora da taxonomia de entrada N1", async () => {
    const interceptor = new OpenApiResponseValidationInterceptor(document);
    const historicalTicket = {
      ...ticket,
      category: "Cadastro",
      source: "dataset",
      noc_status: "not_applicable",
    };

    const result = await firstValueFrom(
      interceptor.intercept(context("GET", "/api/tickets/T000123"), {
        handle: () => of(historicalTicket),
      }),
    );

    assert.equal(result, historicalTicket);
  });
});
