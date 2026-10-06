import { Controller, Get, Param, Query } from "@nestjs/common";
import { CustomersService } from "./customers.service";

@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(
    @Query("q") query = "",
    @Query("page") page = "1",
    @Query("limit") limit = "25",
    @Query("status") status = "active",
  ) {
    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const parsedLimit = Math.min(
      50,
      Math.max(10, Number.parseInt(limit, 10) || 25),
    );
    const selectedStatus =
      status === "all" || status === "removed" ? status : "active";
    return this.customers.list(query, parsedPage, parsedLimit, selectedStatus);
  }

  @Get("search")
  search(@Query("q") query = "") {
    return this.customers.search(query);
  }

  @Get(":customerId/support")
  support(@Param("customerId") customerId: string) {
    return this.customers.getSupportProfile(customerId);
  }
}
