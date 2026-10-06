import {
  DeviceSearch,
  InventoryRepository,
  TopologyQuery,
} from "../domain/inventory-repository.js";

export class InventoryQueries {
  constructor(private readonly repository: InventoryRepository) {}

  search(input: DeviceSearch) {
    return this.repository.search(input);
  }

  topology(input: TopologyQuery) {
    return this.repository.topology(input);
  }

  async get(serial: string) {
    const device = await this.repository.findBySerial(serial.trim());
    if (!device) throw new Error("Equipamento não encontrado.");
    return device;
  }
}
