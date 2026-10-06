import { Controller, Get, Query } from "@nestjs/common";
import { DiagnosticsService } from "./diagnostics.service";

@Controller("diagnostics")
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get()
  list(
    @Query("q") query = "",
    @Query("page") page = "1",
    @Query("limit") limit = "25",
    @Query("state") state = "all",
    @Query("requestedBy") requestedBy = "all",
  ) {
    return this.diagnostics.list({
      query,
      page: Math.max(1, Number.parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(10, Number.parseInt(limit, 10) || 25)),
      state,
      requestedBy,
    });
  }
}
