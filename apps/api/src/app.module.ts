import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { DatabaseService } from './database';
import { NetworkController } from './network/network.controller';
import { NetworkService } from './network/network.service';
import { CustomersController } from './customers/customers.controller';
import { CustomersService } from './customers/customers.service';

@Module({
  controllers: [HealthController, NetworkController, CustomersController],
  providers: [DatabaseService, NetworkService, CustomersService]
})
export class AppModule {}

