import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { AuthService } from "../auth/auth.service";
import type { AuthenticatedUser } from "../auth/auth.types";
import { ScreenUpdatesService } from "./screen-updates.service";

type AuthenticatedSocket = Socket & {
  data: Socket["data"] & { user?: AuthenticatedUser };
};

function allowedOrigins(): string[] {
  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    ...(process.env.WEB_ORIGINS?.split(",") ?? []),
  ]
    .map((origin) => origin.trim())
    .filter(Boolean);
}

@WebSocketGateway({
  cors: {
    origin: allowedOrigins(),
  },
})
export class ScreenUpdatesGateway
  implements
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit,
    OnModuleDestroy
{
  @WebSocketServer()
  private server!: Server;

  private subscription?: { unsubscribe: () => void };

  constructor(
    private readonly auth: AuthService,
    private readonly updates: ScreenUpdatesService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.updates.subscribe((update) => {
      this.server?.emit("screen:data-updated", update);
    });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  handleConnection(client: AuthenticatedSocket): void {
    const token = this.tokenFrom(client);
    const user = token ? this.auth.verifyToken(token) : null;
    if (!user) {
      client.disconnect(true);
      return;
    }
    client.data.user = user;
  }

  handleDisconnect(_client: AuthenticatedSocket): void {
    // O gateway é somente um canal de atualização; não há estado de sessão para limpar.
  }

  private tokenFrom(client: Socket): string | null {
    const auth = client.handshake.auth as { accessToken?: unknown } | undefined;
    if (typeof auth?.accessToken === "string" && auth.accessToken) {
      return auth.accessToken;
    }
    const authorization = client.handshake.headers.authorization ?? "";
    const [scheme, token] = authorization.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token) return token;
    return null;
  }
}
