import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length, Matches } from "class-validator";

abstract class IdentifierParamDto {
  @ApiProperty({ description: "Identificador do recurso." })
  @IsString()
  @Length(1, 160)
  value!: string;
}

export class CustomerIdParamDto {
  @ApiProperty({ example: "C169781" })
  @IsString()
  @Length(1, 80)
  customerId!: string;
}

export class TicketIdParamDto {
  @ApiProperty({ example: "T000123" })
  @IsString()
  @Length(1, 120)
  ticketId!: string;
}

export class IncidentIdParamDto {
  @ApiProperty({ example: "INC-82F1D19A" })
  @IsString()
  @Length(1, 120)
  incidentId!: string;
}

export class InvestigationIdParamDto {
  @ApiProperty({ example: "INV-5D2F24A1" })
  @IsString()
  @Length(1, 120)
  investigationId!: string;
}

export class UserIdParamDto {
  @ApiProperty({ example: "noc-alan" })
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9-]{1,63}$/)
  userId!: string;
}

export class DashboardIdParamDto extends UserIdParamDto {
  @ApiProperty({ example: "dash-8d31f1b7-2a4a-4c9e-8dc9-0a0a67ec7d7d" })
  @IsString()
  @Length(2, 128)
  dashboardId!: string;
}

export class SerialParamDto {
  @ApiProperty({ example: "KSTLD199FB78" })
  @IsString()
  @Length(1, 120)
  serial!: string;
}

export class GroupingIdParamDto {
  @ApiProperty({ example: "pon-olt2-ja" })
  @IsString()
  @Length(1, 160)
  id!: string;
}
