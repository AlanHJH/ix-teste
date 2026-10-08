import { Module } from "@nestjs/common";
import { DatabaseService } from "../database";
import { OpenApiCatalogService } from "../openapi-catalog.service";

/**
 * Adaptadores compartilhados da aplicação.
 *
 * Este módulo é a única porta NestJS para recursos transversais como banco e
 * catálogo OpenAPI. Contextos de negócio importam este módulo, mas não devem
 * importar uns aos outros para acessar infraestrutura diretamente.
 */
@Module({
  providers: [DatabaseService, OpenApiCatalogService],
  exports: [DatabaseService, OpenApiCatalogService],
})
export class InfrastructureModule {}
