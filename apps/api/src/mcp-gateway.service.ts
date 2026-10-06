import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { IncomingMessage, ServerResponse } from "node:http";
import { DatabaseService } from "./database";
import { createMcpGateway, McpGateway } from "./mcp/gateway";

@Injectable()
export class McpGatewayService implements OnModuleDestroy {
  private readonly gateway: McpGateway;

  constructor(database: DatabaseService) {
    const allowedHosts = (
      process.env.MCP_ALLOWED_HOSTS ?? "localhost,127.0.0.1,::1,api"
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    this.gateway = createMcpGateway(database, { allowedHosts });
  }

  handle(request: IncomingMessage, response: ServerResponse) {
    return this.gateway.handle(request, response);
  }

  async onModuleDestroy(): Promise<void> {
    await this.gateway.close();
  }
}
