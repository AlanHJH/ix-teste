import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBody, ApiParam, ApiTags } from "@nestjs/swagger";
import { CreateDataLabJobDto } from "../contracts/input.dto";
import {
  ApiInvalidRequest,
  ApiRead,
  ApiWrite,
  apiBoolean,
  apiDateTime,
  apiInteger,
  apiString,
} from "../openapi";
import { DataLabService } from "./data-lab.service";

const jobSchema = {
  type: "object" as const,
  required: [
    "jobId",
    "scenario",
    "status",
    "cpeCount",
    "days",
    "informsPerDay",
    "batchSize",
    "targetRows",
    "processedCpes",
    "generatedRows",
    "includeTickets",
    "includeDiagnostics",
    "routeTicketsThroughN1",
    "createdAt",
  ],
  properties: {
    jobId: apiString("ID do job."),
    scenario: apiString("Cenário sintético."),
    status: apiString("Estado do job."),
    cpeCount: apiInteger("CPEs sintéticas."),
    days: apiInteger("Dias simulados."),
    informsPerDay: apiInteger("Informs por CPE/dia."),
    batchSize: apiInteger("CPEs por lote."),
    targetRows: apiInteger("Quantidade estimada de eventos."),
    processedCpes: apiInteger("CPEs processadas."),
    generatedRows: apiInteger("Eventos inseridos."),
    includeTickets: apiBoolean("Inclui chamados sintéticos."),
    includeDiagnostics: apiBoolean("Inclui medições sintéticas."),
    routeTicketsThroughN1: apiBoolean(
      "Envia os chamados sintéticos para a triagem do N1.",
    ),
    error: { ...apiString("Erro do job."), nullable: true },
    createdAt: apiDateTime("Criação do job."),
    startedAt: { ...apiDateTime("Início do processamento."), nullable: true },
    completedAt: {
      ...apiDateTime("Conclusão do processamento."),
      nullable: true,
    },
  },
};

@ApiTags("Data Lab")
@Controller("data-lab")
export class DataLabController {
  constructor(private readonly dataLab: DataLabService) {}

  @ApiRead({
    summary: "Pré-visualizar um cenário sintético",
    description:
      "Calcula volume, limite local e estratégia antes de escrever dados no PostgreSQL.",
    responseDescription: "Plano de geração.",
    schema: { type: "object", additionalProperties: true },
  })
  @ApiBody({ type: CreateDataLabJobDto })
  @Post("preview")
  preview(@Body() input: CreateDataLabJobDto) {
    return this.dataLab.preview(input);
  }

  @ApiWrite({
    summary: "Criar job de dados sintéticos",
    description:
      "Gera inventário, Informs, chamados e diagnósticos em lotes controlados. O processamento ocorre em segundo plano e é acompanhado pelo ID retornado.",
    responseDescription: "Job enfileirado.",
    schema: jobSchema,
  })
  @ApiBody({ type: CreateDataLabJobDto })
  @ApiInvalidRequest("Parâmetros fora dos limites do laboratório local.")
  @Post("jobs")
  create(@Body() input: CreateDataLabJobDto) {
    return this.dataLab.create(input);
  }

  @ApiRead({
    summary: "Listar jobs do Data Lab",
    description: "Lista as execuções recentes e seu estado de processamento.",
    responseDescription: "Jobs recentes.",
    schema: {
      type: "object",
      required: ["data"],
      properties: { data: { type: "array", items: jobSchema } },
    },
  })
  @Get("jobs")
  list() {
    return this.dataLab.list();
  }

  @ApiRead({
    summary: "Consultar progresso de um job",
    description: "Consulta o progresso e os totais gerados por um job.",
    responseDescription: "Estado atual do job.",
    schema: jobSchema,
  })
  @ApiParam({ name: "jobId", description: "ID UUID do job." })
  @Get("jobs/:jobId")
  get(@Param("jobId") jobId: string) {
    return this.dataLab.get(jobId);
  }

  @ApiWrite({
    summary: "Remover dados sintéticos de um job",
    description:
      "Remove somente o inventário, Informs, chamados e diagnósticos marcados pelo job informado.",
    responseDescription: "Job removido.",
    schema: {
      type: "object",
      required: ["jobId", "status"],
      properties: {
        jobId: apiString("ID do job."),
        status: apiString("Estado."),
      },
    },
  })
  @ApiParam({ name: "jobId", description: "ID UUID do job." })
  @Delete("jobs/:jobId")
  remove(@Param("jobId") jobId: string) {
    return this.dataLab.remove(jobId);
  }
}
