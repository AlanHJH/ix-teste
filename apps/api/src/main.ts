import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { IncomingMessage, ServerResponse } from "node:http";
import { AppModule } from "./app.module";
import { McpGatewayService } from "./mcp-gateway.service";
import { configureOpenApi } from "./openapi";

type Next = (error?: unknown) => void;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.getHttpAdapter().getInstance().disable("x-powered-by");
  const mcp = app.get(McpGatewayService);
  app.use((request: IncomingMessage, response: ServerResponse, next: Next) => {
    void mcp
      .handle(request, response)
      .then((handled) => {
        if (!handled) next();
      })
      .catch(next);
  });
  app.setGlobalPrefix("api", { exclude: ["health"] });
  configureOpenApi(app);
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
}

void bootstrap().catch((error: unknown) => {
  console.error("Falha ao iniciar a API", error);
  process.exitCode = 1;
});
