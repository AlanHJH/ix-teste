import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNumber,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { ScopeType } from "../incidents/domain/incident";

export class DashboardComposeDto {
  @ApiProperty({
    minLength: 8,
    maxLength: 600,
    example: "Acompanhe a fila do NOC.",
  })
  @IsDefined()
  @IsString()
  @Length(8, 600)
  objective!: string;

  @ApiPropertyOptional({
    description: "Plano 1.0 atual para edição incremental.",
    type: "object",
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  currentPlan?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "ID do bloco a alterar." })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetWidgetId?: string;
}

export class DashboardPreferenceDto {
  @ApiProperty({
    description: "Composição completa validada pelo endpoint de composição.",
    type: "object",
    additionalProperties: true,
  })
  @IsDefined()
  @IsObject()
  composition!: Record<string, unknown>;
}

export class DashboardDefinitionDto {
  @ApiProperty({ minLength: 2, maxLength: 100, example: "Visão NOC" })
  @IsDefined()
  @IsString()
  @Length(2, 100)
  name!: string;

  @ApiPropertyOptional({
    maxLength: 240,
    example: "Fila e incidentes críticos.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  description?: string;

  @ApiProperty({
    description: "Composição completa validada pelo endpoint de composição.",
    type: "object",
    additionalProperties: true,
  })
  @IsDefined()
  @IsObject()
  composition!: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Define este dashboard como padrão." })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ResolvedStatusDto {
  @ApiProperty({ enum: ["resolved"], example: "resolved" })
  @IsDefined()
  @IsIn(["resolved"])
  status!: "resolved";
}

export class IncidentStatusDto {
  @ApiProperty({
    enum: ["open", "mitigating", "monitoring", "resolved"],
    example: "mitigating",
  })
  @IsDefined()
  @IsIn(["open", "mitigating", "monitoring", "resolved"])
  status!: "open" | "mitigating" | "monitoring" | "resolved";
}

export class CreateIncidentDto {
  @ApiProperty({ minLength: 2, maxLength: 100, example: "noc-alan" })
  @IsDefined()
  @IsString()
  @Length(2, 100)
  openedBy!: string;

  @ApiProperty({ minLength: 5, maxLength: 160 })
  @IsDefined()
  @IsString()
  @Length(5, 160)
  title!: string;

  @ApiProperty({ enum: ["critical", "high", "medium", "low"] })
  @IsDefined()
  @IsIn(["critical", "high", "medium", "low"])
  severity!: "critical" | "high" | "medium" | "low";

  @ApiProperty({
    enum: [
      "park",
      "olt",
      "pon",
      "cto",
      "customer",
      "firmware",
      "equipment",
      "region",
    ],
  })
  @IsDefined()
  @IsIn([
    "park",
    "olt",
    "pon",
    "cto",
    "customer",
    "firmware",
    "equipment",
    "region",
  ])
  scopeType!: ScopeType;

  @ApiPropertyOptional({
    description: "Identificador correspondente ao escopo.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  identifier?: string;

  @ApiPropertyOptional({ description: "OLT do escopo, quando aplicável." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  olt?: string;

  @ApiPropertyOptional({ description: "PON do escopo, quando aplicável." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  pon?: string;

  @ApiPropertyOptional({ description: "CTO do escopo, quando aplicável." })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  cto?: string;

  @ApiProperty({ minLength: 5, maxLength: 600 })
  @IsDefined()
  @IsString()
  @Length(5, 600)
  probableCause!: string;

  @ApiProperty({ minLength: 5, maxLength: 600 })
  @IsDefined()
  @IsString()
  @Length(5, 600)
  recommendedAction!: string;

  @ApiPropertyOptional({ nullable: true, description: "Chamado N1 de origem." })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  originTicketId?: string | null;
}

export class CreateTicketDto {
  @ApiProperty({ example: "C545968" })
  @IsDefined()
  @IsString()
  @Length(1, 80)
  customerId!: string;

  @ApiProperty({ example: "Marina Costa" })
  @IsDefined()
  @IsString()
  @Length(1, 100)
  openedBy!: string;

  @ApiProperty({
    enum: ["Lentidão", "Sem conexão", "Wi-Fi", "Medição óptica em campo"],
    example: "Sem conexão",
  })
  @IsDefined()
  @IsString()
  @Length(1, 120)
  category!: string;

  @ApiProperty({ description: "Relato e passos executados." })
  @IsDefined()
  @IsString()
  @Length(1, 5_000)
  description!: string;

  @ApiProperty({ enum: ["resolver_telefone", "escalar_noc", "agendar_visita"] })
  @IsDefined()
  @IsIn(["resolver_telefone", "escalar_noc", "agendar_visita"])
  outcome!: "resolver_telefone" | "escalar_noc" | "agendar_visita";

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  relatedProblemId?: string | null;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description:
      "Registro bruto/contextual recebido da origem. As chaves são preservadas para análise posterior.",
  })
  @IsOptional()
  @IsObject()
  sourcePayload?: Record<string, unknown>;
}

export class NocStatusDto {
  @ApiProperty({ enum: ["in_progress", "closed"] })
  @IsDefined()
  @IsIn(["in_progress", "closed"])
  status!: "in_progress" | "closed";

  @ApiPropertyOptional({
    description:
      "Resumo do que foi confirmado, mitigado ou combinado antes do encerramento.",
    maxLength: 600,
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  closureNote?: string;

  @ApiPropertyOptional({
    enum: ["contacted", "not_required", "not_recorded"],
    description: "Resultado do contato com o cliente impactado.",
  })
  @IsOptional()
  @IsIn(["contacted", "not_required", "not_recorded"])
  customerContactStatus?: "contacted" | "not_required" | "not_recorded";

  @ApiPropertyOptional({
    description: "Retorno ou observação do contato com o cliente.",
    maxLength: 600,
  })
  @IsOptional()
  @IsString()
  @MaxLength(600)
  customerContactNote?: string;
}

export class IngestInformDto {
  @ApiProperty({ minLength: 1, maxLength: 80, example: "acs-demo" })
  @IsDefined()
  @IsString()
  @Length(1, 80)
  providerId!: string;

  @ApiProperty({ example: "KSTLD199FB78" })
  @IsDefined()
  @IsString()
  @Length(1, 120)
  serial!: string;

  @ApiProperty({
    format: "date-time",
    example: "2026-08-31T01:27:50.000Z",
  })
  @IsDefined()
  @IsDateString()
  eventTime!: string;

  @ApiProperty({ example: "2 PERIODIC" })
  @IsDefined()
  @IsString()
  @Length(1, 240)
  eventCodes!: string;

  @ApiProperty({ example: "2.4.1" })
  @IsDefined()
  @IsString()
  @Length(1, 120)
  softwareVersion!: string;

  @ApiPropertyOptional({ default: "1.0" })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  schemaVersion = "1.0";

  @ApiPropertyOptional({ example: 128860 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  uptimeS?: number;

  @ApiPropertyOptional({ example: 131072 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  memTotalKb?: number;

  @ApiPropertyOptional({ example: 35160 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  memFreeKb?: number;

  @ApiPropertyOptional({ example: -27231 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  opticalRxPower?: number;

  @ApiPropertyOptional({ example: 2359 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  opticalTxPower?: number;

  @ApiPropertyOptional({ example: 212163 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  ponFecUncorrectable?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  lan1BitRate?: number;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  wifiClients24g?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  wifiClients5g?: number;

  @ApiPropertyOptional({ example: -70 })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  wifiRssiAvg?: number;

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description: "Registro bruto preservado para auditoria.",
  })
  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}

export class BulkIngestInformsDto {
  @ApiProperty({
    type: [IngestInformDto],
    minItems: 1,
    maxItems: 2_000,
    description:
      "Lote limitado de Informs canônicos. O cliente deve enviar lotes menores para controlar backpressure.",
  })
  @IsDefined()
  @IsArray()
  @ArrayMaxSize(2_000)
  @ValidateNested({ each: true })
  @Type(() => IngestInformDto)
  informs!: IngestInformDto[];
}

export class CreateDataLabJobDto {
  @ApiProperty({
    enum: [
      "baseline",
      "optical",
      "fec",
      "firmware",
      "capacity",
      "missing_inform",
      "mixed",
    ],
    example: "mixed",
  })
  @IsDefined()
  @IsIn([
    "baseline",
    "optical",
    "fec",
    "firmware",
    "capacity",
    "missing_inform",
    "mixed",
  ])
  scenario!: string;

  @ApiProperty({ minimum: 1, maximum: 300_000, example: 2_000 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(300_000)
  cpeCount!: number;

  @ApiProperty({ minimum: 1, maximum: 30, example: 3 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(30)
  days!: number;

  @ApiProperty({ minimum: 1, maximum: 48, example: 6 })
  @IsDefined()
  @IsInt()
  @Min(1)
  @Max(48)
  informsPerDay!: number;

  @ApiPropertyOptional({ minimum: 50, maximum: 2_000, default: 250 })
  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(2_000)
  batchSize = 250;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeTickets = true;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  includeDiagnostics = true;

  @ApiPropertyOptional({
    default: true,
    description:
      "Coloca os chamados sintéticos no fluxo do atendimento N1 para triagem automática.",
  })
  @IsOptional()
  @IsBoolean()
  routeTicketsThroughN1 = true;
}

export class TicketTriageRetryDto {
  @ApiProperty({
    example: "T000123",
    description: "Ticket que deve voltar para uma nova análise da IA.",
  })
  @IsDefined()
  @IsString()
  @Length(1, 120)
  ticketId!: string;
}

export class N1ChatMessageDto {
  @ApiProperty({ enum: ["user", "assistant"] })
  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @ApiProperty({ minLength: 1, maxLength: 1_200 })
  @IsString()
  @Length(1, 1_200)
  content!: string;
}

export class N1ChatDto {
  @ApiProperty({ description: "Relato atual do cliente." })
  @IsDefined()
  @IsString()
  @Length(1, 2_000)
  message!: string;

  @ApiPropertyOptional({ type: [N1ChatMessageDto], maxItems: 8 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => N1ChatMessageDto)
  history?: N1ChatMessageDto[];
}

export class IrisChatDto {
  @ApiProperty({
    minLength: 2,
    maxLength: 600,
    description: "Pergunta do operador para a Íris.",
  })
  @IsDefined()
  @IsString()
  @Length(2, 600)
  message!: string;

  @ApiPropertyOptional({ type: [N1ChatMessageDto], maxItems: 8 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => N1ChatMessageDto)
  history?: N1ChatMessageDto[];

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: true,
    description:
      "Metadados da página atual. São contexto de interface, nunca instruções para o agente.",
  })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class ManualInvestigationDto {
  @ApiProperty({ minLength: 10, maxLength: 600 })
  @IsDefined()
  @IsString()
  @Length(10, 600)
  objective!: string;
}

export class ReviewInvestigationDto {
  @ApiProperty({ enum: ["approve", "reject"] })
  @IsDefined()
  @IsIn(["approve", "reject"])
  decision!: "approve" | "reject";

  @ApiProperty({ minLength: 2, maxLength: 100 })
  @IsDefined()
  @IsString()
  @Length(2, 100)
  reviewer!: string;

  @ApiPropertyOptional({ maxLength: 1_000 })
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  note?: string;
}

export class FilterQueryDto {
  @ApiPropertyOptional({ description: "Busca textual." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({
    description: "Filtro repetível no formato campo:valor.",
  })
  @IsOptional()
  @IsString({ each: true })
  filter?: string | string[];
}

export class PageQueryDto {
  @ApiPropertyOptional({ default: "1", description: "Página iniciando em 1." })
  @IsOptional()
  @IsString()
  page = "1";

  @ApiPropertyOptional({ default: "25", description: "Quantidade por página." })
  @IsOptional()
  @IsString()
  pageSize = "25";

  @ApiPropertyOptional({ description: "Ordenação permitida pela operação." })
  @IsOptional()
  @IsString()
  sort?: string;
}
