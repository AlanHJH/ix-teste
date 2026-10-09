import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiBody, ApiQuery, ApiTags } from "@nestjs/swagger";
import { parsePageQuery } from "../pagination";
import {
  ApiInvalidRequest,
  ApiPagination,
  ApiRead,
  ApiWrite,
  apiDate,
  apiDateTime,
  apiBoolean,
  apiInteger,
  apiNumber,
  apiPageSchema,
  apiString,
} from "../openapi";
import { BulkIngestInformsDto, IngestInformDto } from "../contracts/input.dto";
import { TelemetryQueries } from "../mcp/contexts/telemetry/application/telemetry-queries";
import {
  TelemetryDailyMetricsQueryDto,
  TelemetryInformsQueryDto,
} from "../contracts/query.dto";
import { TelemetryKafkaService } from "./telemetry-kafka.service";

const informSchema = {
  type: "object" as const,
  description:
    "Evento bruto informado pela CPE ao ACS. Potências ópticas usam a unidade bruta do equipamento.",
  properties: {
    ts: apiDateTime("Data e hora UTC do Inform.", "2026-08-31T01:27:50.000Z"),
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
  required: [
    "ts",
    "serial",
    "event_codes",
    "software_version",
    "uptime_s",
    "mem_total_kb",
    "mem_free_kb",
    "optical_rx_power",
    "optical_tx_power",
    "pon_fec_uncorrectable",
    "lan1_bit_rate",
    "wifi_clients_24g",
    "wifi_clients_5g",
    "wifi_rssi_avg",
  ],
};

const dailyMetricSchema = {
  type: "object" as const,
  description:
    "Agregado diário por CPE e firmware, preservando transições de versão no mesmo dia.",
  properties: {
    day: apiDate("Dia no formato YYYY-MM-DD.", "2026-08-30"),
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
  required: [
    "day",
    "serial",
    "customer_id",
    "vendor",
    "model",
    "software_version",
    "plan_mbps",
    "olt",
    "pon_port",
    "cto",
    "inform_count",
    "mem_min_pct",
    "mem_avg_pct",
    "lan_min_mbps",
    "lan_max_mbps",
    "reboot_count",
    "fec_errors",
    "optical_rx_min_dbm",
    "optical_rx_avg_dbm",
  ],
};

const informIngestionSchema = {
  type: "object" as const,
  description:
    "Resultado auditável da entrada, normalização e idempotência do Inform.",
  required: [
    "status",
    "ingestionKey",
    "providerId",
    "serial",
    "eventTime",
    "receivedAt",
  ],
  properties: {
    status: {
      type: "string",
      enum: ["accepted", "duplicate", "quarantined", "queued"],
    },
    ingestionKey: apiString("Chave idempotente do evento."),
    providerId: apiString("Provedor que originou o Inform."),
    serial: apiString("Serial do equipamento."),
    eventTime: apiDateTime("Momento produzido pela CPE."),
    receivedAt: apiDateTime("Momento recebido pela plataforma."),
    reason: { ...apiString("Motivo da quarentena."), nullable: true },
    transport: {
      type: "string",
      enum: ["kafka", "direct-fallback"],
    },
    topic: { ...apiString("Tópico Kafka."), nullable: true },
  },
};

const bulkInformIngestionSchema = {
  type: "object" as const,
  description: "Resultado agregado de um lote controlado de Informs.",
  required: ["total", "accepted", "duplicate", "quarantined", "results"],
  properties: {
    total: apiInteger("Quantidade enviada."),
    accepted: apiInteger("Eventos persistidos."),
    duplicate: apiInteger("Eventos já persistidos."),
    quarantined: apiInteger("Eventos enviados para quarentena."),
    results: { type: "array", items: informIngestionSchema },
    queued: apiInteger("Eventos publicados no Kafka."),
    transport: {
      type: "string",
      enum: ["kafka", "direct-fallback"],
    },
    topic: { ...apiString("Tópico Kafka."), nullable: true },
  },
};

const kafkaStatusSchema = {
  type: "object" as const,
  required: [
    "enabled",
    "ready",
    "topic",
    "consumerGroup",
    "brokers",
    "consumerRunning",
    "lastError",
  ],
  properties: {
    enabled: apiBoolean("Se o transporte Kafka está habilitado."),
    ready: apiBoolean("Se producer e consumer estão conectados."),
    topic: apiString("Tópico de telemetria."),
    consumerGroup: apiString("Grupo consumidor da normalização."),
    brokers: { type: "array", items: apiString("Broker Kafka.") },
    consumerRunning: apiBoolean("Se o consumidor está processando eventos."),
    lastError: { ...apiString("Último erro de transporte."), nullable: true },
  },
};

@ApiTags("Telemetria")
@Controller("telemetry")
export class TelemetryController {
  constructor(
    private readonly telemetry: TelemetryQueries,
    private readonly kafka: TelemetryKafkaService,
  ) {}

  @ApiWrite({
    summary: "Receber e normalizar um Inform",
    description:
      "Recebe um evento canônico da CPE/ACS, preserva o payload bruto, rejeita schema incompatível ou serial desconhecido em quarentena e não duplica a mesma chave idempotente.",
    responseDescription: "Resultado da ingestão do evento.",
    schema: informIngestionSchema,
  })
  @ApiBody({
    description: "Evento normalizado pelo adaptador do provedor.",
    type: IngestInformDto,
  })
  @ApiInvalidRequest(
    "Evento ausente, inválido ou incompatível com o schema 1.0.",
  )
  @Post("informs")
  ingest(@Body() input: IngestInformDto) {
    return this.kafka.enqueue(input);
  }

  @ApiWrite({
    summary: "Receber lote controlado de Informs",
    description:
      "Processa até 500 Informs em paralelo limitado, preservando idempotência e quarentena por evento. O cliente deve dividir cargas maiores em lotes.",
    responseDescription: "Resumo e resultados da ingestão do lote.",
    schema: bulkInformIngestionSchema,
  })
  @ApiBody({ type: BulkIngestInformsDto })
  @ApiInvalidRequest("Lote ausente, vazio ou maior que 500 eventos.")
  @Post("informs/bulk")
  ingestBulk(@Body() input: BulkIngestInformsDto) {
    return this.kafka.enqueueMany(input.informs);
  }

  @ApiRead({
    summary: "Consultar transporte Kafka da telemetria",
    description:
      "Exibe o estado do broker, tópico e consumidor que normaliza Informs em PostgreSQL.",
    responseDescription: "Estado do pipeline Kafka.",
    schema: kafkaStatusSchema,
  })
  @Get("kafka")
  kafkaStatus() {
    return this.kafka.status();
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
  informs(@Query() params: TelemetryInformsQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultSort: "ts_desc",
        allowedSorts: ["ts_desc", "ts_asc", "serial_asc"],
      },
    );
    return this.telemetry.listInforms({
      serial: params.serial,
      from: params.from || undefined,
      to: params.to || undefined,
      eventCode: params.eventCode || undefined,
      softwareVersion: params.softwareVersion || undefined,
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
  dailyMetrics(@Query() params: TelemetryDailyMetricsQueryDto) {
    const pagination = parsePageQuery(
      params.page,
      params.pageSize,
      params.sort,
      {
        defaultSort: "day_desc",
        allowedSorts: [
          "day_desc",
          "day_asc",
          "reboot_count_desc",
          "mem_min_pct_asc",
        ],
      },
    );
    return this.telemetry.listDailyMetrics({
      serial: params.serial || undefined,
      customerId: params.customerId || undefined,
      olt: params.olt || undefined,
      pon: params.pon || undefined,
      softwareVersion: params.softwareVersion || undefined,
      fromDay: params.fromDay || undefined,
      toDay: params.toDay || undefined,
      ...pagination,
    });
  }
}
