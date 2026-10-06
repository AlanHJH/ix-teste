import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
} from "@nestjs/common";
import { NetworkService } from "./network.service";

@Controller("network")
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get("overview")
  overview() {
    return this.network.getOverview();
  }

  @Get("topology/path")
  topologyPath(@Query("q") query = "") {
    return this.network.findTopologyPath(query);
  }

  @Get("topology/devices")
  topologyDevices(
    @Query("olt") olt = "",
    @Query("pon") pon = "",
    @Query("cto") cto = "",
  ) {
    return this.network.getTopologyDevices(olt, pon, cto);
  }

  @Get("topology")
  topology(@Query("olt") olt?: string, @Query("pon") pon?: string) {
    return this.network.getTopology(olt, pon);
  }

  @Get("incidents")
  incidents() {
    return this.network.getIncidents();
  }

  @Get("incidents/:id")
  async incident(@Param("id") id: string) {
    const incident = (await this.network.getIncidents()).find(
      (item) => item.id === id,
    );
    if (!incident) throw new NotFoundException("Incidente não encontrado");
    return incident;
  }

  @Patch("incidents/:id/status")
  closeIncident(
    @Param("id") id: string,
    @Body() body: { status?: "resolved" },
  ) {
    return this.network.closeDetectedGrouping(id, body.status ?? "resolved");
  }
}
