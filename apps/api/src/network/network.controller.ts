import { Controller, Get, Param } from '@nestjs/common';
import { NetworkService } from './network.service';

@Controller('network')
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Get('overview')
  overview() {
    return this.network.getOverview();
  }

  @Get('incidents')
  incidents() {
    return this.network.getIncidents();
  }

  @Get('incidents/:id')
  async incident(@Param('id') id: string) {
    return (await this.network.getIncidents()).find((incident) => incident.id === id) ?? null;
  }
}

