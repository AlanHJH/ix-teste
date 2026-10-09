import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { IncomingMessage, ServerResponse } from "node:http";
import { AppModule } from "./app.module";
import { McpGatewayService } from "./mcp-gateway.service";
import { configureOpenApi } from "./openapi";
import { OpenApiResponseValidationInterceptor } from "./contracts/openapi-response-validation.interceptor";
import { InvestigationSchedulerService } from "./investigations/investigation-scheduler.service";

type Next = (error?: unknown) => void;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      validationError: { target: false, value: false },
    }),
  );
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
  const openApiDocument = configureOpenApi(app);
  app.useGlobalInterceptors(
    new OpenApiResponseValidationInterceptor(openApiDocument),
  );
  await app.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
  app.get(InvestigationSchedulerService).start();
}

void bootstrap().catch((error: unknown) => {
  console.error("Falha ao iniciar a API", error);
  process.exitCode = 1;
});
