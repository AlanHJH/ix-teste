import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  MaxLength,
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

  @ApiProperty({ example: "Sem conexão" })
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
}

export class NocStatusDto {
  @ApiProperty({ enum: ["in_progress", "closed"] })
  @IsDefined()
  @IsIn(["in_progress", "closed"])
  status!: "in_progress" | "closed";
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
