import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PageQueryDto } from "./input.dto";

abstract class QueryBase extends PageQueryDto {
  @ApiPropertyOptional({ description: "Busca textual." })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q = "";
}

export class CustomersListQueryDto extends QueryBase {
  @ApiPropertyOptional({
    enum: ["active", "removed", "all"],
    default: "active",
  })
  @IsOptional()
  @IsString()
  status = "active";

  @ApiPropertyOptional({
    description: "Filtros repetíveis no formato campo:valor.",
  })
  @IsOptional()
  @IsString({ each: true })
  filter?: string | string[];

  constructor() {
    super();
    this.sort = "relevance";
  }
}

export class CustomersFilterOptionsQueryDto extends QueryBase {
  @ApiPropertyOptional({
    enum: ["active", "removed", "all"],
    default: "active",
  })
  @IsOptional()
  @IsString()
  status = "active";

  constructor() {
    super();
    this.pageSize = "12";
    this.sort = "relevance";
  }
}

export class CustomersSearchQueryDto extends QueryBase {
  @ApiPropertyOptional({ enum: ["active", "cancelled", "all"], default: "all" })
  @IsOptional()
  @IsString()
  status = "all";

  constructor() {
    super();
    this.pageSize = "8";
    this.sort = "customer_id_asc";
  }
}

export class InventoryListQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q = "";
  @ApiPropertyOptional({ enum: ["active", "removed", "all"], default: "all" })
  @IsOptional()
  @IsString()
  status = "all";
  @ApiPropertyOptional() @IsOptional() @IsString() vendor = "";
  @ApiPropertyOptional() @IsOptional() @IsString() olt = "";
  @ApiPropertyOptional() @IsOptional() @IsString() pon = "";
  @ApiPropertyOptional() @IsOptional() @IsString() cto = "";

  constructor() {
    super();
    this.sort = "customer_id_asc";
  }
}

export class InventoryTopologyQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() olt = "";
  @ApiPropertyOptional() @IsOptional() @IsString() pon = "";
  @ApiPropertyOptional() @IsOptional() @IsString() cto = "";

  constructor() {
    super();
    this.sort = "customer_id_asc";
  }
}

export class TelemetryInformsQueryDto extends PageQueryDto {
  @ApiPropertyOptional({ required: true })
  @IsString()
  serial = "";
  @ApiPropertyOptional() @IsOptional() @IsString() from = "";
  @ApiPropertyOptional() @IsOptional() @IsString() to = "";
  @ApiPropertyOptional() @IsOptional() @IsString() eventCode = "";
  @ApiPropertyOptional() @IsOptional() @IsString() softwareVersion = "";

  constructor() {
    super();
    this.sort = "ts_desc";
  }
}

export class TelemetryDailyMetricsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() serial = "";
  @ApiPropertyOptional() @IsOptional() @IsString() customerId = "";
  @ApiPropertyOptional() @IsOptional() @IsString() olt = "";
  @ApiPropertyOptional() @IsOptional() @IsString() pon = "";
  @ApiPropertyOptional() @IsOptional() @IsString() softwareVersion = "";
  @ApiPropertyOptional() @IsOptional() @IsString() fromDay = "";
  @ApiPropertyOptional() @IsOptional() @IsString() toDay = "";

  constructor() {
    super();
    this.sort = "day_desc";
  }
}

export class DiagnosticsListQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q = "";
  @ApiPropertyOptional() @IsOptional() @IsString() state = "all";
  @ApiPropertyOptional() @IsOptional() @IsString() requestedBy = "all";
  @ApiPropertyOptional() @IsOptional() @IsString() serial = "";
  @ApiPropertyOptional() @IsOptional() @IsString() customerId = "";
  @ApiPropertyOptional() @IsOptional() @IsString() diagnostic = "";
  @ApiPropertyOptional() @IsOptional() @IsString() from = "";
  @ApiPropertyOptional() @IsOptional() @IsString() to = "";
  @ApiPropertyOptional({ description: "Filtros facetados repetíveis." })
  @IsOptional()
  @IsString({ each: true })
  filter?: string | string[];

  constructor() {
    super();
    this.sort = "ts_desc";
  }
}

export class DiagnosticsFilterOptionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q = "";
  @ApiPropertyOptional() @IsOptional() @IsString() kind = "";

  constructor() {
    super();
    this.pageSize = "20";
    this.sort = "relevance";
  }
}

export class TicketsQueueQueryDto extends PageQueryDto {
  constructor() {
    super();
    this.pageSize = "100";
    this.sort = "opened_at_asc";
  }
}

export class TicketsListQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q = "";
  @ApiPropertyOptional() @IsOptional() @IsString() category = "all";
  @ApiPropertyOptional() @IsOptional() @IsString() resolution = "all";
  @ApiPropertyOptional() @IsOptional() @IsString() channel = "all";
  @ApiPropertyOptional() @IsOptional() @IsString() customerId = "";
  @ApiPropertyOptional() @IsOptional() @IsString() from = "";
  @ApiPropertyOptional() @IsOptional() @IsString() to = "";
  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  filter?: string | string[];

  constructor() {
    super();
    this.sort = "opened_at_desc";
  }
}

export class TicketsFilterOptionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q = "";
  @ApiPropertyOptional() @IsOptional() @IsString() kind = "";

  constructor() {
    super();
    this.pageSize = "20";
    this.sort = "relevance";
  }
}

export class IncidentsListQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() scopeType = "";

  constructor() {
    super();
    this.sort = "severity_desc";
  }
}

export class IncidentsOptionsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() type = "olt";
  @ApiPropertyOptional() @IsOptional() @IsString() q = "";
  @ApiPropertyOptional() @IsOptional() @IsString() olt = "";
  @ApiPropertyOptional() @IsOptional() @IsString() pon = "";

  constructor() {
    super();
    this.pageSize = "40";
    this.sort = "value_asc";
  }
}

export class NetworkTopologyPathQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) q = "";

  constructor() {
    super();
    this.pageSize = "8";
    this.sort = "relevance";
  }
}

export class NetworkDevicesQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() olt = "";
  @ApiPropertyOptional() @IsOptional() @IsString() pon = "";
  @ApiPropertyOptional() @IsOptional() @IsString() cto = "";

  constructor() {
    super();
    this.pageSize = "100";
    this.sort = "customer_id_asc";
  }
}

export class NetworkTopologyQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() olt?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() pon?: string;
}

export class NetworkIncidentsQueryDto extends PageQueryDto {
  constructor() {
    super();
    this.sort = "score_desc";
  }
}

export class OperationsDatasetLoadsQueryDto extends PageQueryDto {
  constructor() {
    super();
    this.sort = "started_at_desc";
  }
}

export class OperationsGroupingCandidatesQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() scopeType = "";

  constructor() {
    super();
    this.sort = "priority_desc";
  }
}

export class OperationsActiveGroupingsQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() scopeType = "";

  constructor() {
    super();
    this.sort = "severity_desc";
  }
}

export class InvestigationsListQueryDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() status = "";

  constructor() {
    super();
    this.pageSize = "100";
    this.sort = "created_at_desc";
  }
}
