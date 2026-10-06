import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { TicketsService } from "./tickets.service";

@Controller("tickets")
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get("noc-queue")
  nocQueue() {
    return this.tickets.nocQueue();
  }

  @Get()
  list(
    @Query("q") query = "",
    @Query("page") page = "1",
    @Query("limit") limit = "25",
    @Query("category") category = "all",
    @Query("resolution") resolution = "all",
    @Query("channel") channel = "all",
  ) {
    return this.tickets.list({
      query,
      page: Math.max(1, Number.parseInt(page, 10) || 1),
      limit: Math.min(50, Math.max(10, Number.parseInt(limit, 10) || 25)),
      category,
      resolution,
      channel,
    });
  }

  @Post()
  create(
    @Body()
    body: {
      customerId?: string;
      openedBy?: string;
      category?: string;
      description?: string;
      outcome?: "resolver_telefone" | "escalar_noc" | "agendar_visita";
      relatedProblemId?: string | null;
    },
  ) {
    return this.tickets.create({
      customerId: body.customerId ?? "",
      openedBy: body.openedBy ?? "",
      category: body.category ?? "",
      description: body.description ?? "",
      outcome: body.outcome ?? "escalar_noc",
      relatedProblemId: body.relatedProblemId ?? null,
    });
  }

  @Patch(":ticketId/noc-status")
  updateNocStatus(
    @Param("ticketId") ticketId: string,
    @Body() body: { status?: "in_progress" | "closed" },
  ) {
    return this.tickets.updateNocStatus(ticketId, body.status ?? "in_progress");
  }
}
