import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const MAX_STRING_LENGTH = 1_200;
const MAX_ARRAY_ITEMS = 30;
const MAX_OBJECT_KEYS = 40;
const MAX_PAYLOAD_LENGTH = 6_000;
const SENSITIVE_KEY =
  /authorization|cookie|password|secret|token|api[-_]?key|credential|private[-_]?key/i;

export type McpLogLevel = "info" | "warn" | "error";

export type McpRequestLogContext = {
  requestId: string;
  correlationId: string;
  sessionId: string | null;
  /** Request-scoped credential for trusted internal forwarding; never logged. */
  authorizationHeader: string | null;
  route: string;
  httpMethod: string;
  rpcMethod: string | null;
  rpcId: string | number | null;
  tool: string | null;
  resourceUri: string | null;
  startedAt: bigint;
  logger: McpStructuredLogger;
};

type LogSink = (line: string) => void;

export const mcpRequestContext = new AsyncLocalStorage<McpRequestLogContext>();

function truncate(value: string, limit = MAX_STRING_LENGTH): string {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function safeValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (typeof value === "string") return truncate(value);
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "undefined") return null;
  if (depth >= 5) return "[MAX_DEPTH]";

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => safeValue(item, key, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[+${value.length - MAX_ARRAY_ITEMS} itens]`);
    }
    return items;
  }

  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [entryKey, entryValue] of entries.slice(0, MAX_OBJECT_KEYS)) {
      result[entryKey] = safeValue(entryValue, entryKey, depth + 1);
    }
    if (entries.length > MAX_OBJECT_KEYS) {
      result._truncated_keys = entries.length - MAX_OBJECT_KEYS;
    }
    return result;
  }

  return truncate(String(value));
}

export function summarizeForMcpLog(value: unknown): unknown {
  const safe = safeValue(value);
  const serialized = JSON.stringify(safe);
  if (serialized.length <= MAX_PAYLOAD_LENGTH) return safe;
  return {
    truncated: true,
    preview: serialized.slice(0, MAX_PAYLOAD_LENGTH),
    original_length: serialized.length,
  };
}

function errorForLog(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncate(error.message),
      stack: error.stack ? truncate(error.stack, 4_000) : undefined,
    };
  }
  return { name: "UnknownError", message: truncate(String(error)) };
}

export class McpStructuredLogger {
  constructor(
    private readonly sink: LogSink = (line) =>
      process.stdout.write(`${line}\n`),
    private readonly service = "ondaluz-api",
  ) {}

  emit(
    level: McpLogLevel,
    event: string,
    fields: Record<string, unknown> = {},
  ): void {
    const record = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      event,
      ...(safeValue(fields) as Record<string, unknown>),
    } as Record<string, unknown>;
    this.sink(JSON.stringify(record));
  }

  info(event: string, fields?: Record<string, unknown>): void {
    this.emit("info", event, fields);
  }

  warn(event: string, fields?: Record<string, unknown>): void {
    this.emit("warn", event, fields);
  }

  error(event: string, fields?: Record<string, unknown>): void {
    this.emit("error", event, fields);
  }

  errorDetails(error: unknown) {
    return errorForLog(error);
  }
}

export function newMcpRequestId(): string {
  return randomUUID();
}

export function currentMcpRequestContext(): McpRequestLogContext | undefined {
  return mcpRequestContext.getStore();
}

export function elapsedMilliseconds(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}
