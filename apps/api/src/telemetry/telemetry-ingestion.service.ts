import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { DatabaseService } from "../database";
import { IngestInformDto } from "../contracts/input.dto";
import { TelemetryAggregationService } from "./telemetry-aggregation.service";

export type InformIngestionResult = {
  status: "accepted" | "duplicate" | "quarantined";
  ingestionKey: string;
  providerId: string;
  serial: string;
  eventTime: string;
  receivedAt: string;
  reason?: string;
};

type PreparedInform = {
  providerId: string;
  serial: string;
  eventTime: Date;
  receivedAt: Date;
  ingestionKey: string;
  schemaVersion: string;
  eventCodes: string;
  softwareVersion: string;
  uptimeS: number | null;
  memTotalKb: number | null;
  memFreeKb: number | null;
  opticalRxPower: number | null;
  opticalTxPower: number | null;
  ponFecUncorrectable: number | null;
  lan1BitRate: number | null;
  wifiClients24g: number | null;
  wifiClients5g: number | null;
  wifiRssiAvg: number | null;
  rawPayload: Record<string, unknown>;
};

export type BulkInformIngestionResult = {
  total: number;
  accepted: number;
  duplicate: number;
  quarantined: number;
  results: InformIngestionResult[];
};

export function stableIngestionKey(input: IngestInformDto): string {
  const fingerprint = JSON.stringify({
    providerId: input.providerId.trim(),
    serial: input.serial.trim(),
    eventTime: new Date(input.eventTime).toISOString(),
    eventCodes: input.eventCodes.trim(),
    softwareVersion: input.softwareVersion.trim(),
    values: {
      uptimeS: input.uptimeS ?? null,
      memTotalKb: input.memTotalKb ?? null,
      memFreeKb: input.memFreeKb ?? null,
      opticalRxPower: input.opticalRxPower ?? null,
      opticalTxPower: input.opticalTxPower ?? null,
      ponFecUncorrectable: input.ponFecUncorrectable ?? null,
      lan1BitRate: input.lan1BitRate ?? null,
      wifiClients24g: input.wifiClients24g ?? null,
      wifiClients5g: input.wifiClients5g ?? null,
      wifiRssiAvg: input.wifiRssiAvg ?? null,
    },
  });
  return createHash("sha256").update(fingerprint).digest("hex");
}

@Injectable()
export class TelemetryIngestionService {
  constructor(
    private readonly database: DatabaseService,
    private readonly aggregation: TelemetryAggregationService,
  ) {}

  async ingestMany(
    inputs: IngestInformDto[],
  ): Promise<BulkInformIngestionResult> {
    return this.ingestBatch(inputs);
  }

  async ingest(input: IngestInformDto): Promise<InformIngestionResult> {
    const providerId = input.providerId.trim();
    const serial = input.serial.trim();
    const eventTime = new Date(input.eventTime);
    const receivedAt = new Date();
    const ingestionKey = stableIngestionKey(input);
    const rawPayload = input.rawPayload ?? { ...input };

    if (input.schemaVersion !== "1.0") {
      return this.quarantine({
        providerId,
        serial,
        eventTime,
        receivedAt,
        ingestionKey,
        schemaVersion: input.schemaVersion,
        reason: `schema_version_unsupported:${input.schemaVersion}`,
        rawPayload,
      });
    }

    const inventory = await this.database.query(
      "SELECT 1 FROM inventory WHERE serial=$1 LIMIT 1",
      [serial],
    );
    if (!inventory.rows[0]) {
      return this.quarantine({
        providerId,
        serial,
        eventTime,
        receivedAt,
        ingestionKey,
        schemaVersion: input.schemaVersion,
        reason: "serial_not_in_inventory",
        rawPayload,
      });
    }

    const result = await this.database.query<{ event_time: string }>(
      `INSERT INTO informs(
         ts, serial, event_codes, software_version, uptime_s, mem_total_kb,
         mem_free_kb, optical_rx_power, optical_tx_power,
         pon_fec_uncorrectable, wan_bytes_rx, wan_bytes_tx, lan1_bit_rate,
         wifi_clients_24g, wifi_clients_5g, wifi_rssi_avg, provider_id,
         event_time, received_at, schema_version, ingestion_key,
         normalization_status, raw_payload
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL,NULL,$11,$12,$13,$14,
         $15,$1,$16,$17,$18,'accepted',$19::jsonb)
       ON CONFLICT (provider_id, ingestion_key) DO NOTHING
       RETURNING event_time::text`,
      [
        eventTime,
        serial,
        input.eventCodes.trim(),
        input.softwareVersion.trim(),
        input.uptimeS ?? null,
        input.memTotalKb ?? null,
        input.memFreeKb ?? null,
        input.opticalRxPower ?? null,
        input.opticalTxPower ?? null,
        input.ponFecUncorrectable ?? null,
        input.lan1BitRate ?? null,
        input.wifiClients24g ?? null,
        input.wifiClients5g ?? null,
        input.wifiRssiAvg ?? null,
        providerId,
        receivedAt,
        input.schemaVersion,
        ingestionKey,
        JSON.stringify(rawPayload),
      ],
    );

    if (!result.rows[0]) {
      return {
        status: "duplicate",
        ingestionKey,
        providerId,
        serial,
        eventTime: eventTime.toISOString(),
        receivedAt: receivedAt.toISOString(),
      };
    }

    this.aggregation.markDirty();
    return {
      status: "accepted",
      ingestionKey,
      providerId,
      serial,
      eventTime: eventTime.toISOString(),
      receivedAt: receivedAt.toISOString(),
    };
  }

  async ingestBatch(
    inputs: IngestInformDto[],
  ): Promise<BulkInformIngestionResult> {
    const prepared = inputs.map((input) => this.prepare(input));
    const serials = [...new Set(prepared.map((item) => item.serial))];
    const inventory = await this.database.query<{ serial: string }>(
      "SELECT serial FROM inventory WHERE serial = ANY($1::text[])",
      [serials],
    );
    const knownSerials = new Set(inventory.rows.map((row) => row.serial));
    const acceptedCandidates: PreparedInform[] = [];
    const quarantined = prepared.filter((item) => {
      const reason =
        item.schemaVersion !== "1.0"
          ? `schema_version_unsupported:${item.schemaVersion}`
          : !knownSerials.has(item.serial)
            ? "serial_not_in_inventory"
            : null;
      if (!reason) {
        acceptedCandidates.push(item);
        return false;
      }
      return true;
    });

    if (quarantined.length) {
      await this.database.query(
        `INSERT INTO inform_quarantine(
           quarantine_id, provider_id, serial, event_time, received_at,
           schema_version, ingestion_key, reason, raw_payload
         )
         SELECT gen_random_uuid(), item.provider_id, item.serial, item.event_time,
                item.received_at, item.schema_version, item.ingestion_key,
                CASE
                  WHEN item.schema_version <> '1.0'
                    THEN 'schema_version_unsupported:' || item.schema_version
                  ELSE 'serial_not_in_inventory'
                END,
                item.raw_payload
         FROM jsonb_to_recordset($1::jsonb) AS item(
           provider_id text, serial text, event_time timestamptz,
           received_at timestamptz, schema_version text, ingestion_key text,
           raw_payload jsonb
         )`,
        [
          JSON.stringify(
            quarantined.map((item) => ({
              provider_id: item.providerId,
              serial: item.serial,
              event_time: item.eventTime.toISOString(),
              received_at: item.receivedAt.toISOString(),
              schema_version: item.schemaVersion,
              ingestion_key: item.ingestionKey,
              raw_payload: item.rawPayload,
            })),
          ),
        ],
      );
    }

    let accepted = 0;
    const ingestionKeys: string[] = [];
    if (acceptedCandidates.length) {
      const result = await this.database.query<{ ingestion_key: string }>(
        `INSERT INTO informs(
           ts, serial, event_codes, software_version, uptime_s, mem_total_kb,
           mem_free_kb, optical_rx_power, optical_tx_power,
           pon_fec_uncorrectable, wan_bytes_rx, wan_bytes_tx, lan1_bit_rate,
           wifi_clients_24g, wifi_clients_5g, wifi_rssi_avg, provider_id,
           event_time, received_at, schema_version, ingestion_key,
           normalization_status, raw_payload
         )
         SELECT item.event_time, item.serial, item.event_codes,
                item.software_version, item.uptime_s, item.mem_total_kb,
                item.mem_free_kb, item.optical_rx_power, item.optical_tx_power,
                item.pon_fec_uncorrectable, NULL, NULL, item.lan1_bit_rate,
                item.wifi_clients_24g, item.wifi_clients_5g, item.wifi_rssi_avg,
                item.provider_id, item.event_time, item.received_at,
                item.schema_version, item.ingestion_key, 'accepted', item.raw_payload
         FROM jsonb_to_recordset($1::jsonb) AS item(
           serial text, event_codes text, software_version text,
           uptime_s numeric, mem_total_kb numeric, mem_free_kb numeric,
           optical_rx_power double precision, optical_tx_power double precision,
           pon_fec_uncorrectable numeric, lan1_bit_rate integer,
           wifi_clients_24g integer, wifi_clients_5g integer,
           wifi_rssi_avg double precision, provider_id text,
           event_time timestamptz, received_at timestamptz,
           schema_version text, ingestion_key text, raw_payload jsonb
         )
         ON CONFLICT (provider_id, ingestion_key) DO NOTHING
         RETURNING ingestion_key`,
        [
          JSON.stringify(
            acceptedCandidates.map((item) => ({
              serial: item.serial,
              event_codes: item.eventCodes,
              software_version: item.softwareVersion,
              uptime_s: item.uptimeS,
              mem_total_kb: item.memTotalKb,
              mem_free_kb: item.memFreeKb,
              optical_rx_power: item.opticalRxPower,
              optical_tx_power: item.opticalTxPower,
              pon_fec_uncorrectable: item.ponFecUncorrectable,
              lan1_bit_rate: item.lan1BitRate,
              wifi_clients_24g: item.wifiClients24g,
              wifi_clients_5g: item.wifiClients5g,
              wifi_rssi_avg: item.wifiRssiAvg,
              provider_id: item.providerId,
              event_time: item.eventTime.toISOString(),
              received_at: item.receivedAt.toISOString(),
              schema_version: item.schemaVersion,
              ingestion_key: item.ingestionKey,
              raw_payload: item.rawPayload,
            })),
          ),
        ],
      );
      accepted = result.rowCount ?? result.rows.length;
      ingestionKeys.push(...result.rows.map((row) => row.ingestion_key));
      if (accepted > 0) this.aggregation.markDirty();
    }

    const acceptedKeySet = new Set(ingestionKeys);
    const quarantinedKeySet = new Set(
      quarantined.map((item) => item.ingestionKey),
    );
    const results = prepared.map((item) => ({
      status: quarantinedKeySet.has(item.ingestionKey)
        ? ("quarantined" as const)
        : acceptedKeySet.has(item.ingestionKey)
          ? ("accepted" as const)
          : ("duplicate" as const),
      ingestionKey: item.ingestionKey,
      providerId: item.providerId,
      serial: item.serial,
      eventTime: item.eventTime.toISOString(),
      receivedAt: item.receivedAt.toISOString(),
      ...(quarantinedKeySet.has(item.ingestionKey)
        ? {
            reason:
              item.schemaVersion !== "1.0"
                ? `schema_version_unsupported:${item.schemaVersion}`
                : "serial_not_in_inventory",
          }
        : {}),
    }));
    return {
      total: inputs.length,
      accepted,
      duplicate: acceptedCandidates.length - accepted,
      quarantined: quarantined.length,
      results,
    };
  }

  private prepare(input: IngestInformDto): PreparedInform {
    return {
      providerId: input.providerId.trim(),
      serial: input.serial.trim(),
      eventTime: new Date(input.eventTime),
      receivedAt: new Date(),
      ingestionKey: stableIngestionKey(input),
      schemaVersion: input.schemaVersion,
      eventCodes: input.eventCodes.trim(),
      softwareVersion: input.softwareVersion.trim(),
      uptimeS: input.uptimeS ?? null,
      memTotalKb: input.memTotalKb ?? null,
      memFreeKb: input.memFreeKb ?? null,
      opticalRxPower: input.opticalRxPower ?? null,
      opticalTxPower: input.opticalTxPower ?? null,
      ponFecUncorrectable: input.ponFecUncorrectable ?? null,
      lan1BitRate: input.lan1BitRate ?? null,
      wifiClients24g: input.wifiClients24g ?? null,
      wifiClients5g: input.wifiClients5g ?? null,
      wifiRssiAvg: input.wifiRssiAvg ?? null,
      rawPayload: input.rawPayload ?? { ...input },
    };
  }

  private async quarantine(input: {
    providerId: string;
    serial: string;
    eventTime: Date;
    receivedAt: Date;
    ingestionKey: string;
    schemaVersion: string;
    reason: string;
    rawPayload: Record<string, unknown>;
  }): Promise<InformIngestionResult> {
    await this.database.query(
      `INSERT INTO inform_quarantine(
         quarantine_id, provider_id, serial, event_time, received_at,
         schema_version, ingestion_key, reason, raw_payload
       ) VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
      [
        input.providerId,
        input.serial,
        input.eventTime,
        input.receivedAt,
        input.schemaVersion,
        input.ingestionKey,
        input.reason,
        JSON.stringify(input.rawPayload),
      ],
    );
    return {
      status: "quarantined",
      ingestionKey: input.ingestionKey,
      providerId: input.providerId,
      serial: input.serial,
      eventTime: input.eventTime.toISOString(),
      receivedAt: input.receivedAt.toISOString(),
      reason: input.reason,
    };
  }
}
