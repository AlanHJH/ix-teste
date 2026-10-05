import { Controller, Get, Param, Query } from "@nestjs/common";
import { CustomersService } from "./customers.service";

@Controller("customers")
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get("search")
  search(@Query("q") query = "") {
    return this.customers.search(query);
  }

  @Get(":customerId/support")
  support(@Param("customerId") customerId: string) {
    return this.customers.getSupportProfile(customerId);
  }
}
