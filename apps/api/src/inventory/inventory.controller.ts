import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from "@nestjs/common";
import {
  ApiNotFoundResponse,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { DatabaseService } from "../database";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiInteger,
  apiDate,
  apiNullableString,
  apiPageSchema,
  apiString,
  apiErrorSchema,
} from "../openapi";
import { InventoryQueries } from "../mcp/contexts/inventory/application/inventory-queries";
import { PostgresInventoryRepository } from "../mcp/contexts/inventory/infrastructure/postgres-inventory-repository";

const inventorySorts = [
  "customer_id_asc",
  "customer_id_desc",
  "serial_asc",
  "serial_desc",
  "equipment_asc",
  "equipment_desc",
  "firmware_plan_asc",
  "firmware_plan_desc",
  "installed_at_desc",
  "plan_mbps_desc",
  "plan_mbps_asc",
  "topology_asc",
  "topology_desc",
  "status_asc",
  "status_desc",
] as const;

const inventoryItemSchema = {
  type: "object" as const,
  description:
    "CPE do inventário com hardware, firmware, plano, situação e caminho OLT → PON → CTO.",
  properties: {
    serial: apiString("Serial único da CPE.", "KSTLD199FB78"),
    customer_id: apiString("Código do cliente associado.", "C169781"),
    vendor: apiString("Fabricante.", "Kestrel"),
    model: apiString("Modelo.", "KX-3000"),
    hw_revision: apiString("Revisão de hardware.", "1.2"),
    software_version: apiString("Firmware registrado.", "2.4.1"),
    plan_mbps: apiInteger("Plano atual em Mbps.", 300),
    previous_plan_mbps: {
      ...apiInteger("Plano anterior em Mbps.", 100),
      nullable: true,
    },
    customer_status: apiString("Situação cadastral do cliente.", "active"),
    olt: apiString("OLT que atende a CPE.", "OLT-2"),
    pon_port: apiString("Porta PON.", "1/7"),
    cto: apiString("Caixa terminal óptica.", "CTO-2-17-03"),
    city: apiString("Cidade.", "Serra Alta"),
    neighborhood: apiString("Bairro.", "Jardim Aurora"),
    installed_at: apiDate("Data de instalação.", "2022-03-10"),
    status: {
      type: "string" as const,
      enum: ["active", "removed"],
      description: "Estado da CPE no inventário.",
    },
    removed_at: apiNullableString("Data de retirada."),
    logical_drop_id: apiNullableString(
      "Drop lógico derivado do serial; não representa cabo físico inventariado.",
      "L-DROP-KSTLD199FB78",
    ),
  },
  required: [
    "serial",
    "customer_id",
    "vendor",
    "model",
    "hw_revision",
    "software_version",
    "plan_mbps",
    "previous_plan_mbps",
    "customer_status",
    "olt",
    "pon_port",
    "cto",
    "city",
    "neighborhood",
    "installed_at",
    "status",
    "removed_at",
    "logical_drop_id",
  ],
};

@ApiTags("Inventário")
@Controller("inventory")
export class InventoryController {
  private readonly inventory: InventoryQueries;

  constructor(database: DatabaseService) {
    this.inventory = new InventoryQueries(
      new PostgresInventoryRepository(database),
    );
  }

  @ApiRead({
    summary: "Consultar inventário de CPEs",
    description:
      "Consulta paginada do inventário físico/lógico. Pode ser filtrada por busca textual, estado, fabricante e pelo caminho OLT → PON → CTO.",
    responseDescription: "Página do inventário.",
    schema: apiPageSchema(inventoryItemSchema, "Página de CPEs do inventário."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: [...inventorySorts],
    defaultSort: "customer_id_asc",
  })
  @ApiQuery({
    name: "q",
    required: false,
    description:
      "Busca por serial, cliente, fabricante, modelo, firmware, CTO ou localidade.",
    schema: { type: "string", default: "", example: "Kestrel" },
  })
  @ApiQuery({
    name: "status",
    required: false,
    description: "Estado da CPE.",
    schema: {
      type: "string",
      enum: ["active", "removed", "all"],
      default: "all",
    },
  })
  @ApiQuery({
    name: "vendor",
    required: false,
    description: "Fabricante exato.",
  })
  @ApiQuery({ name: "olt", required: false, description: "OLT exata." })
  @ApiQuery({
    name: "pon",
    required: false,
    description: "PON exata dentro da OLT.",
  })
  @ApiQuery({
    name: "cto",
    required: false,
    description: "CTO exata dentro da PON.",
  })
  @ApiInvalidRequest("Filtro, paginação ou ordenação inválida.")
  @Get()
  list(
    @Query("q") query = "",
    @Query("status") status = "all",
    @Query("vendor") vendor = "",
    @Query("olt") olt = "",
    @Query("pon") pon = "",
    @Query("cto") cto = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "customer_id_asc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "customer_id_asc",
      allowedSorts: inventorySorts,
    });
    return this.inventory.search({
      query,
      status: status === "active" || status === "removed" ? status : "all",
      vendor: vendor || undefined,
      olt: olt || undefined,
      pon: pon || undefined,
      cto: cto || undefined,
      ...pagination,
    });
  }

  @ApiRead({
    summary: "Listar CPEs de um ramo da topologia",
    description:
      "Recorta o inventário por OLT, PON e CTO. Útil para expandir nós do mapa sem carregar o parque inteiro.",
    responseDescription: "CPEs do ramo selecionado.",
    schema: apiPageSchema(
      inventoryItemSchema,
      "Página de CPEs do ramo topológico.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({ sorts: [...inventorySorts], defaultSort: "customer_id_asc" })
  @ApiQuery({
    name: "olt",
    required: false,
    description: "OLT exata.",
    example: "OLT-2",
  })
  @ApiQuery({
    name: "pon",
    required: false,
    description: "PON exata.",
    example: "1/7",
  })
  @ApiQuery({
    name: "cto",
    required: false,
    description: "CTO exata.",
    example: "CTO-2-17-03",
  })
  @ApiInvalidRequest("Escopo topológico ou paginação inválida.")
  @Get("topology")
  topology(
    @Query("olt") olt = "",
    @Query("pon") pon = "",
    @Query("cto") cto = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "customer_id_asc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "customer_id_asc",
      allowedSorts: inventorySorts,
    });
    return this.inventory.topology({
      olt: olt || undefined,
      pon: pon || undefined,
      cto: cto || undefined,
      ...pagination,
    });
  }

  @ApiRead({
    summary: "Obter uma CPE pelo serial",
    description:
      "Retorna todos os atributos cadastrais, técnicos e topológicos conhecidos da CPE.",
    responseDescription: "CPE encontrada.",
    schema: inventoryItemSchema,
    dashboardResource: true,
  })
  @ApiParam({
    name: "serial",
    description: "Serial exato da CPE.",
    example: "KSTLD199FB78",
  })
  @ApiNotFoundResponse({
    description: "Equipamento não encontrado.",
    schema: apiErrorSchema,
  })
  @Get(":serial")
  async get(@Param("serial") serial: string) {
    try {
      return await this.inventory.get(serial);
    } catch {
      throw new NotFoundException("Equipamento não encontrado.");
    }
  }
}
