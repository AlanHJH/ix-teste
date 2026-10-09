import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Kafka, type Consumer, type Producer } from "kafkajs";
import { IngestInformDto } from "../contracts/input.dto";
import {
  BulkInformIngestionResult,
  InformIngestionResult,
  stableIngestionKey,
  TelemetryIngestionService,
} from "./telemetry-ingestion.service";

export type TelemetryQueueResult =
  | (InformIngestionResult & { transport: "direct-fallback" })
  | {
      status: "queued";
      ingestionKey: string;
      providerId: string;
      serial: string;
      eventTime: string;
      receivedAt: string;
      transport: "kafka";
      topic: string;
    };

export type TelemetryQueueBatchResult =
  | (BulkInformIngestionResult & {
      queued: 0;
      transport: "direct-fallback";
    })
  | {
      total: number;
      accepted: 0;
      duplicate: 0;
      quarantined: 0;
      queued: number;
      results: Array<{
        status: "queued";
        ingestionKey: string;
        providerId: string;
        serial: string;
        eventTime: string;
        receivedAt: string;
      }>;
      transport: "kafka";
      topic: string;
    };

export type TelemetryKafkaStatus = {
  enabled: boolean;
  ready: boolean;
  topic: string;
  consumerGroup: string;
  brokers: string[];
  consumerRunning: boolean;
  lastError: string | null;
};

@Injectable()
export class TelemetryKafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryKafkaService.name);
  private readonly enabled =
    (process.env.KAFKA_ENABLED ?? "true").toLowerCase() !== "false";
  private readonly brokers = (process.env.KAFKA_BROKERS ?? "redpanda:9092")
    .split(",")
    .map((broker) => broker.trim())
    .filter(Boolean);
  private readonly topic =
    process.env.KAFKA_TELEMETRY_TOPIC ?? "ondaluz.informs.v1";
  private readonly consumerGroup =
    process.env.KAFKA_GROUP_ID ?? "ondaluz-telemetry-normalizer";
  private producer?: Producer;
  private consumer?: Consumer;
  private ready = false;
  private consumerRunning = false;
  private lastError: string | null = null;

  constructor(private readonly ingestion: TelemetryIngestionService) {}

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log("Kafka desabilitado; ingestão usará o caminho direto.");
      return;
    }

    try {
      const kafka = new Kafka({
        clientId: process.env.KAFKA_CLIENT_ID ?? "ondaluz-api",
        brokers: this.brokers,
        connectionTimeout: 5_000,
        requestTimeout: 10_000,
        retry: { retries: 2, initialRetryTime: 300 },
      });
      const admin = kafka.admin();
      await admin.connect();
      const topics = await admin.listTopics();
      if (!topics.includes(this.topic)) {
        await admin.createTopics({
          waitForLeaders: true,
          topics: [
            {
              topic: this.topic,
              numPartitions: Number(process.env.KAFKA_PARTITIONS ?? 3),
              replicationFactor: 1,
            },
          ],
        });
      }
      await admin.disconnect();

      this.producer = kafka.producer({ allowAutoTopicCreation: false });
      this.consumer = kafka.consumer({ groupId: this.consumerGroup });
      await this.producer.connect();
      await this.consumer.connect();
      await this.consumer.subscribe({
        topic: this.topic,
        fromBeginning: false,
      });
      this.ready = true;
      this.lastError = null;
      this.consumerRunning = true;
      void this.consumer
        .run({
          autoCommit: true,
          eachMessage: async ({ message }) => {
            if (!message.value) return;
            try {
              const input = JSON.parse(
                message.value.toString(),
              ) as IngestInformDto;
              await this.ingestion.ingest(input);
            } catch (error) {
              this.lastError =
                error instanceof Error ? error.message : String(error);
              this.logger.error(
                `Falha ao normalizar mensagem Kafka: ${this.lastError}`,
              );
            }
          },
        })
        .catch((error: unknown) => {
          this.consumerRunning = false;
          this.ready = false;
          this.lastError =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Consumidor Kafka parou: ${this.lastError}`);
        });
      this.logger.log(
        `Kafka ativo: tópico ${this.topic}, grupo ${this.consumerGroup}, brokers ${this.brokers.join(",")}`,
      );
    } catch (error) {
      this.ready = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Kafka indisponível; fallback direto ativado: ${this.lastError}`,
      );
      await this.disconnectClients();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnectClients();
  }

  status(): TelemetryKafkaStatus {
    return {
      enabled: this.enabled,
      ready: this.ready,
      topic: this.topic,
      consumerGroup: this.consumerGroup,
      brokers: this.brokers,
      consumerRunning: this.consumerRunning,
      lastError: this.lastError,
    };
  }

  async enqueue(input: IngestInformDto): Promise<TelemetryQueueResult> {
    if (!this.ready || !this.producer) {
      return {
        ...(await this.ingestion.ingest(input)),
        transport: "direct-fallback",
      };
    }

    const now = new Date().toISOString();
    const key = stableIngestionKey(input);
    await this.producer.send({
      topic: this.topic,
      messages: [
        {
          key: `${input.providerId.trim()}:${input.serial.trim()}`,
          value: JSON.stringify(input),
          headers: {
            "schema-version": input.schemaVersion,
            "event-time": new Date(input.eventTime).toISOString(),
            "ingestion-key": key,
          },
        },
      ],
    });
    return {
      status: "queued",
      ingestionKey: key,
      providerId: input.providerId.trim(),
      serial: input.serial.trim(),
      eventTime: new Date(input.eventTime).toISOString(),
      receivedAt: now,
      transport: "kafka",
      topic: this.topic,
    };
  }

  async enqueueMany(
    inputs: IngestInformDto[],
  ): Promise<TelemetryQueueBatchResult> {
    if (!this.ready || !this.producer) {
      return {
        ...(await this.ingestion.ingestBatch(inputs)),
        queued: 0,
        transport: "direct-fallback",
      };
    }

    const results = inputs.map((input) => {
      const key = stableIngestionKey(input);
      return {
        status: "queued" as const,
        ingestionKey: key,
        providerId: input.providerId.trim(),
        serial: input.serial.trim(),
        eventTime: new Date(input.eventTime).toISOString(),
        receivedAt: new Date().toISOString(),
      };
    });
    await this.producer.send({
      topic: this.topic,
      messages: inputs.map((input, index) => ({
        key: `${input.providerId.trim()}:${input.serial.trim()}`,
        value: JSON.stringify(input),
        headers: {
          "schema-version": input.schemaVersion,
          "event-time": new Date(input.eventTime).toISOString(),
          "ingestion-key": results[index].ingestionKey,
        },
      })),
    });
    return {
      total: inputs.length,
      accepted: 0,
      duplicate: 0,
      quarantined: 0,
      queued: inputs.length,
      results,
      transport: "kafka",
      topic: this.topic,
    };
  }

  private async disconnectClients(): Promise<void> {
    this.consumerRunning = false;
    this.ready = false;
    await this.consumer?.disconnect().catch(() => undefined);
    await this.producer?.disconnect().catch(() => undefined);
    this.consumer = undefined;
    this.producer = undefined;
  }
}
