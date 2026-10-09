import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstValueFrom, of } from "rxjs";
import { ScreenUpdateInterceptor } from "./screen-update.interceptor";
import type { ScreenUpdate } from "./screen-updates.service";

function context(method: string, path: string, statusCode: number) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, originalUrl: path }),
      getResponse: () => ({ statusCode }),
    }),
  } as never;
}

describe("ScreenUpdateInterceptor", () => {
  it("publica somente depois de uma mutação REST bem-sucedida", async () => {
    const events: ScreenUpdate[] = [];
    const service = { publish: (event: ScreenUpdate) => events.push(event) };
    const interceptor = new ScreenUpdateInterceptor(service);

    await firstValueFrom(
      interceptor.intercept(
        context("PATCH", "/api/tickets/T000123/noc-status", 200),
        { handle: () => of({ ticket_id: "T000123" }) },
      ),
    );
    await firstValueFrom(
      interceptor.intercept(context("POST", "/api/incidents", 201), {
        handle: () => of({ incident_id: "INC-001" }),
      }),
    );

    assert.deepEqual(events, [
      {
        domain: "tickets",
        entityType: "ticket",
        entityId: "T000123",
        action: "updated",
        method: "PATCH",
        path: "/api/tickets/T000123/noc-status",
      },
      {
        domain: "incidents",
        entityType: "noc-group",
        entityId: "INC-001",
        action: "created",
        method: "POST",
        path: "/api/incidents",
      },
    ]);
  });

  it("não publica para leitura, compose ou resposta HTTP com erro", async () => {
    const events: ScreenUpdate[] = [];
    const service = { publish: (event: ScreenUpdate) => events.push(event) };
    const interceptor = new ScreenUpdateInterceptor(service);

    await firstValueFrom(
      interceptor.intercept(context("GET", "/api/tickets", 200), {
        handle: () => of({}),
      }),
    );
    await firstValueFrom(
      interceptor.intercept(context("POST", "/api/dashboard/compose", 201), {
        handle: () => of({}),
      }),
    );
    await firstValueFrom(
      interceptor.intercept(context("POST", "/api/tickets", 500), {
        handle: () => of({}),
      }),
    );

    assert.deepEqual(events, []);
  });
});
