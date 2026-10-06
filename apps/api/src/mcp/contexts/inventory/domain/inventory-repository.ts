import { Page, PageRequest } from "../../../shared/domain/page.js";

export type DeviceSearch = PageRequest & {
  query: string;
  status: "active" | "removed" | "all";
  vendor?: string;
  olt?: string;
  pon?: string;
  cto?: string;
};

export type Device = Record<string, unknown> & {
  serial: string;
  customer_id: string;
};

export type TopologyQuery = PageRequest & {
  olt?: string;
  pon?: string;
  cto?: string;
};

export interface InventoryRepository {
  search(input: DeviceSearch): Promise<Page<Device>>;
  findBySerial(serial: string): Promise<Device | null>;
  topology(input: TopologyQuery): Promise<Page<Device>>;
}
