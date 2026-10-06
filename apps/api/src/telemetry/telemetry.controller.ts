import { Controller, Get, Query } from "@nestjs/common";
import { ApiQuery, ApiTags } from "@nestjs/swagger";
import { DatabaseService } from "../database";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  apiInteger,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";
import { TelemetryQueries } from "../mcp/contexts/telemetry/application/telemetry-queries";
import { PostgresTelemetryRepository } from "../mcp/contexts/telemetry/infrastructure/postgres-telemetry-repository";

const informSchema = {
  type: "object" as const,
  description:
    "Evento bruto informado pela CPE ao ACS. Potências ópticas usam a unidade bruta do equipamento.",
  properties: {
    ts: apiString("Data e hora UTC do Inform.", "2026-08-31T01:27:50.000Z"),
    serial: apiString("Serial da CPE.", "KSTLD199FB78"),
    event_codes: apiString("Códigos CWMP/TR-069.", "2 PERIODIC"),
    software_version: apiString("Firmware reportado.", "2.4.1"),
    uptime_s: apiInteger("Tempo ligado em segundos.", 128860),
    mem_total_kb: apiInteger("Memória total em KiB.", 131072),
    mem_free_kb: apiInteger("Memória livre em KiB.", 35160),
    optical_rx_power: apiNumber("Potência RX na unidade bruta.", -27231),
    optical_tx_power: apiNumber("Potência TX na unidade bruta.", 2359),
    pon_fec_uncorrectable: apiInteger(
      "Contador de erros FEC não corrigíveis.",
      212163,
    ),
    lan1_bit_rate: apiInteger("Velocidade negociada na LAN 1 em Mbps.", 1000),
    wifi_clients_24g: apiInteger("Clientes Wi-Fi em 2,4 GHz.", 3),
    wifi_clients_5g: apiInteger("Clientes Wi-Fi em 5 GHz.", 4),
    wifi_rssi_avg: apiNumber("RSSI médio quando disponível.", -70),
  },
};

const dailyMetricSchema = {
  type: "object" as const,
  description:
    "Agregado diário por CPE e firmware, preservando transições de versão no mesmo dia.",
  properties: {
    day: apiString("Dia no formato YYYY-MM-DD.", "2026-08-30"),
    serial: apiString("Serial da CPE.", "KSTLD199FB78"),
    customer_id: apiString("Código do cliente.", "C169781"),
    vendor: apiString("Fabricante.", "Kestrel"),
    model: apiString("Modelo.", "KX-3000"),
    software_version: apiString("Firmware observado no dia.", "2.4.1"),
    plan_mbps: apiInteger("Plano em Mbps.", 300),
    olt: apiString("OLT.", "OLT-2"),
    pon_port: apiString("Porta PON.", "1/7"),
    cto: apiString("CTO.", "CTO-2-17-03"),
    inform_count: apiInteger("Quantidade de Informs agregados.", 12),
    mem_min_pct: apiNumber("Menor percentual de memória livre.", 18.9),
    mem_avg_pct: apiNumber("Percentual médio de memória livre.", 23.2),
    lan_min_mbps: apiNumber("Menor negociação LAN em Mbps.", 100),
    lan_max_mbps: apiNumber("Maior negociação LAN em Mbps.", 1000),
    reboot_count: apiInteger("Reinicializações inferidas.", 2),
    fec_errors: apiInteger("Erros FEC na janela diária.", 212163),
    optical_rx_min_dbm: apiNumber("Menor potência RX em dBm.", -27.23),
    optical_rx_avg_dbm: apiNumber("Potência RX média em dBm.", -24.7),
  },
};

@ApiTags("Telemetria")
@Controller("telemetry")
export class TelemetryController {
  private readonly telemetry: TelemetryQueries;

  constructor(database: DatabaseService) {
    this.telemetry = new TelemetryQueries(
      new PostgresTelemetryRepository(database),
    );
  }

  @ApiRead({
    summary: "Listar eventos brutos de uma CPE",
    description:
      "Consulta paginada de Informs. O serial é obrigatório para evitar varreduras acidentais sobre milhões de eventos.",
    responseDescription: "Eventos da CPE.",
    schema: apiPageSchema(informSchema, "Página de eventos brutos de uma CPE."),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["ts_desc", "ts_asc", "serial_asc"],
    defaultSort: "ts_desc",
  })
  @ApiQuery({
    name: "serial",
    required: true,
    description: "Serial exato da CPE.",
    example: "KSTLD199FB78",
  })
  @ApiQuery({
    name: "from",
    required: false,
    description: "Início inclusivo em ISO 8601.",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "Fim inclusivo em ISO 8601.",
  })
  @ApiQuery({
    name: "eventCode",
    required: false,
    description: "Código do evento CWMP/TR-069.",
  })
  @ApiQuery({
    name: "softwareVersion",
    required: false,
    description: "Firmware exato.",
  })
  @ApiInvalidRequest("Serial ausente ou paginação inválida.")
  @Get("informs")
  informs(
    @Query("serial") serial = "",
    @Query("from") from = "",
    @Query("to") to = "",
    @Query("eventCode") eventCode = "",
    @Query("softwareVersion") softwareVersion = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "ts_desc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "ts_desc",
      allowedSorts: ["ts_desc", "ts_asc", "serial_asc"],
    });
    return this.telemetry.listInforms({
      serial,
      from: from || undefined,
      to: to || undefined,
      eventCode: eventCode || undefined,
      softwareVersion: softwareVersion || undefined,
      ...pagination,
    });
  }

  @ApiRead({
    summary: "Listar métricas diárias agregadas",
    description:
      "Série diária derivada dos Informs e enriquecida com inventário. Pode ser filtrada por CPE, cliente, rede, firmware e período.",
    responseDescription: "Métricas diárias.",
    schema: apiPageSchema(
      dailyMetricSchema,
      "Página de métricas diárias de CPEs.",
    ),
    dashboardResource: true,
  })
  @ApiPagination({
    sorts: ["day_desc", "day_asc", "reboot_count_desc", "mem_min_pct_asc"],
    defaultSort: "day_desc",
  })
  @ApiQuery({ name: "serial", required: false, description: "Serial exato." })
  @ApiQuery({
    name: "customerId",
    required: false,
    description: "Cliente exato.",
  })
  @ApiQuery({ name: "olt", required: false, description: "OLT exata." })
  @ApiQuery({ name: "pon", required: false, description: "PON exata." })
  @ApiQuery({
    name: "softwareVersion",
    required: false,
    description: "Firmware exato.",
  })
  @ApiQuery({
    name: "fromDay",
    required: false,
    description: "Primeiro dia inclusivo, YYYY-MM-DD.",
  })
  @ApiQuery({
    name: "toDay",
    required: false,
    description: "Último dia inclusivo, YYYY-MM-DD.",
  })
  @ApiInvalidRequest("Filtro ou paginação inválida.")
  @Get("daily-metrics")
  dailyMetrics(
    @Query("serial") serial = "",
    @Query("customerId") customerId = "",
    @Query("olt") olt = "",
    @Query("pon") pon = "",
    @Query("softwareVersion") softwareVersion = "",
    @Query("fromDay") fromDay = "",
    @Query("toDay") toDay = "",
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "25",
    @Query("sort") sort = "day_desc",
  ) {
    const pagination = parsePageQuery(page, pageSize, sort, {
      defaultSort: "day_desc",
      allowedSorts: [
        "day_desc",
        "day_asc",
        "reboot_count_desc",
        "mem_min_pct_asc",
      ],
    });
    return this.telemetry.listDailyMetrics({
      serial: serial || undefined,
      customerId: customerId || undefined,
      olt: olt || undefined,
      pon: pon || undefined,
      softwareVersion: softwareVersion || undefined,
      fromDay: fromDay || undefined,
      toDay: toDay || undefined,
      ...pagination,
    });
  }
}
