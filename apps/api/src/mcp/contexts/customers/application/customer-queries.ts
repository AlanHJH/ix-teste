import {
  CustomerRepository,
  CustomerSearch,
} from "../domain/customer-repository.js";

export class CustomerQueries {
  constructor(private readonly repository: CustomerRepository) {}

  search(input: CustomerSearch) {
    return this.repository.search(input);
  }

  async get(customerId: string) {
    const customer = await this.repository.findById(customerId.trim());
    if (!customer) throw new Error("Cliente não encontrado.");
    return customer;
  }
}
