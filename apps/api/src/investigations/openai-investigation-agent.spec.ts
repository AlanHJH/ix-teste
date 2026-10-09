import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RateLimitError } from "openai";
import {
  configuredReasoningEffort,
  openAiTimeoutMilliseconds,
  maximumContextCharacters,
  retryAfterMilliseconds,
  toolCallBudget,
  toolCallFingerprint,
} from "./openai-investigation-agent";

describe("espera de rate limit da OpenAI", () => {
  it("prioriza o cabeçalho Retry-After", () => {
    const error = new RateLimitError(
      429,
      {},
      "rate limited",
      new Headers({ "retry-after": "3.5" }),
    );
    assert.equal(retryAfterMilliseconds(error, 0), 3_500);
  });

  it("entende o tempo informado na mensagem quando não há cabeçalho", () => {
    const error = new RateLimitError(
      429,
      { message: "Please try again in 11.393s." },
      undefined,
      new Headers(),
    );
    assert.equal(retryAfterMilliseconds(error, 0), 11_393);
  });

  it("usa backoff limitado quando a API não informa a espera", () => {
    const error = new RateLimitError(429, {}, "temporary limit", new Headers());
    assert.equal(retryAfterMilliseconds(error, 0), 1_000);
    assert.equal(retryAfterMilliseconds(error, 3), 8_000);
  });
});

describe("orçamento adaptativo da investigação", () => {
  it("oferece mais consultas para uma solicitação manual", () => {
    assert.equal(toolCallBudget("metric", {}), 6);
    assert.equal(toolCallBudget("schedule", {}), 8);
    assert.equal(toolCallBudget("manual", {}), 10);
  });

  it("limita configurações externas a uma faixa segura", () => {
    assert.equal(
      toolCallBudget("manual", { AGENT_MANUAL_MAX_TOOL_CALLS: "99" }),
      12,
    );
    assert.equal(
      maximumContextCharacters({ AGENT_MAX_CONTEXT_CHARS: "999" }),
      10_000,
    );
  });

  it("usa o modo de raciocínio mais econômico por padrão", () => {
    assert.equal(configuredReasoningEffort({}), "none");
    assert.equal(
      configuredReasoningEffort({ AGENT_REASONING_EFFORT: "low" }),
      "low",
    );
  });

  it("limita o tempo máximo de uma chamada externa", () => {
    assert.equal(openAiTimeoutMilliseconds({}), 90_000);
    assert.equal(
      openAiTimeoutMilliseconds({ AGENT_OPENAI_TIMEOUT_MS: "1000" }),
      5_000,
    );
    assert.equal(
      openAiTimeoutMilliseconds({ AGENT_OPENAI_TIMEOUT_MS: "999999" }),
      180_000,
    );
  });

  it("reconhece a mesma consulta mesmo com argumentos reordenados", () => {
    assert.equal(
      toolCallFingerprint("customers_search", { query: "Ana", limit: 10 }),
      toolCallFingerprint("customers_search", { limit: 10, query: "Ana" }),
    );
  });
});
