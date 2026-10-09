import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export type ScreenUpdateDomain =
  | "dashboard"
  | "tickets"
  | "incidents"
  | "investigations"
  | "network"
  | "customers"
  | "inventory"
  | "diagnostics"
  | "telemetry"
  | "operations";

export type ScreenUpdate = {
  domain: ScreenUpdateDomain;
  entityType?: "noc-group" | "ticket";
  entityId?: string;
  action: "created" | "updated" | "deleted";
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  occurredAt: string;
  source: "rest";
};

@Injectable()
export class ScreenUpdatesService {
  private readonly updates = new Subject<ScreenUpdate>();

  publish(update: Omit<ScreenUpdate, "occurredAt" | "source">): void {
    this.updates.next({
      ...update,
      occurredAt: new Date().toISOString(),
      source: "rest",
    });
  }

  subscribe(listener: (update: ScreenUpdate) => void) {
    return this.updates.subscribe(listener);
  }
}
