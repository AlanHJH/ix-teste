import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import {
  ScreenUpdatesService,
  type ScreenUpdateDomain,
} from "./screen-updates.service";

type HttpRequest = {
  method?: string;
  originalUrl?: string;
  url?: string;
};

type HttpResponse = {
  statusCode?: number;
};

type MutationResult = {
  incident_id?: unknown;
  ticket_id?: unknown;
};

function domainFromPath(path: string): ScreenUpdateDomain | null {
  if (path.includes("/dashboard/compose")) return null;
  const mappings: Array<[string, ScreenUpdateDomain]> = [
    ["/dashboard/preferences", "dashboard"],
    ["/dashboard/dashboards", "dashboard"],
    ["/tickets", "tickets"],
    ["/incidents", "incidents"],
    ["/investigations", "investigations"],
    ["/network/", "network"],
    ["/customers", "customers"],
    ["/inventory", "inventory"],
    ["/diagnostics", "diagnostics"],
    ["/telemetry", "telemetry"],
    ["/operations", "operations"],
  ];
  return mappings.find(([prefix]) => path.includes(prefix))?.[1] ?? null;
}

function entityFor(
  domain: ScreenUpdateDomain,
  result: unknown,
): { entityType: "noc-group" | "ticket"; entityId: string } | null {
  if (!result || typeof result !== "object") return null;
  const mutation = result as MutationResult;
  if (domain === "incidents" && typeof mutation.incident_id === "string") {
    return { entityType: "noc-group", entityId: mutation.incident_id };
  }
  if (domain === "tickets" && typeof mutation.ticket_id === "string") {
    return { entityType: "ticket", entityId: mutation.ticket_id };
  }
  return null;
}

@Injectable()
export class ScreenUpdateInterceptor implements NestInterceptor {
  constructor(private readonly updates: ScreenUpdatesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<HttpRequest>();
    const method = request.method;
    const path = (request.originalUrl ?? request.url ?? "").split("?", 1)[0];
    const domain = domainFromPath(path);
    if (
      !domain ||
      (method !== "POST" &&
        method !== "PUT" &&
        method !== "PATCH" &&
        method !== "DELETE")
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap((result: unknown) => {
        const response = context.switchToHttp().getResponse<HttpResponse>();
        if (
          (response.statusCode ?? 500) < 200 ||
          (response.statusCode ?? 500) >= 300
        ) {
          return;
        }
        const entity = entityFor(domain, result);
        this.updates.publish({
          domain,
          method: method as "POST" | "PUT" | "PATCH" | "DELETE",
          path,
          ...(entity ?? {}),
          action:
            method === "POST"
              ? "created"
              : method === "DELETE"
                ? "deleted"
                : "updated",
        });
      }),
    );
  }
}
