import { Page, PageRequest } from "../../../shared/domain/page.js";

export type CustomerSearch = PageRequest & {
  query: string;
  status: "active" | "cancelled" | "all";
};

export type CustomerSummary = {
  customer_id: string;
  customer_status: string;
  customer_since: string;
  cancelled_at: string | null;
  active_serial: string | null;
  city: string;
  neighborhood: string;
  plan_mbps: number;
};

export type CustomerDetails = {
  customer: {
    customer_id: string;
    customer_status: string;
    customer_since: string;
    cancelled_at: string | null;
  };
  equipment_history: Record<string, unknown>[];
};

export interface CustomerRepository {
  search(input: CustomerSearch): Promise<Page<CustomerSummary>>;
  findById(customerId: string): Promise<CustomerDetails | null>;
}
