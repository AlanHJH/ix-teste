import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import { paginate, parsePageQuery } from "./pagination";

describe("contrato de paginação REST e MCP", () => {
  it("publica o envelope padronizado sem campos legados", () => {
    assert.deepEqual(paginate(["b", "c"], 5, 2, 2), {
      data: ["b", "c"],
      page: 2,
      pageSize: 2,
      totalItems: 5,
      totalPages: 3,
    });
  });

  it("limita pageSize e valida a ordenação por allowlist", () => {
    assert.deepEqual(
      parsePageQuery("2", "500", "price_desc", {
        defaultSort: "name_asc",
        allowedSorts: ["name_asc", "price_desc"],
      }),
      { page: 2, pageSize: 100, sort: "price_desc" },
    );
    assert.throws(
      () =>
        parsePageQuery("1", "25", "drop_table", {
          defaultSort: "name_asc",
          allowedSorts: ["name_asc"],
        }),
      BadRequestException,
    );
  });
});
