import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  CreateIncidentInput,
  IncidentOptionType,
  IncidentsService,
} from "./incidents.service";

@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get()
  list() {
    return this.incidents.list();
  }

  @Get("options")
  options(
    @Query("type") type = "olt",
    @Query("q") query = "",
    @Query("olt") olt = "",
    @Query("pon") pon = "",
    @Query("limit") limit = "40",
  ) {
    return this.incidents.options({
      type: type as IncidentOptionType,
      query,
      olt,
      pon,
      limit: Math.min(50, Math.max(5, Number.parseInt(limit, 10) || 40)),
    });
  }

  @Post()
  create(@Body() body: Partial<CreateIncidentInput>) {
    return this.incidents.create({
      openedBy: body.openedBy ?? "",
      title: body.title ?? "",
      severity: body.severity ?? "medium",
      scopeType: body.scopeType ?? "pon",
      identifier: body.identifier ?? "",
      olt: body.olt ?? "",
      pon: body.pon ?? "",
      cto: body.cto ?? "",
      probableCause: body.probableCause ?? "",
      recommendedAction: body.recommendedAction ?? "",
      originTicketId: body.originTicketId ?? null,
    });
  }

  @Patch(":incidentId/status")
  close(
    @Param("incidentId") incidentId: string,
    @Body() body: { status?: "resolved" },
  ) {
    return this.incidents.close(incidentId, body.status ?? "resolved");
  }
}
