import { createReadStream, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createGunzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Client } from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { datasetResetSql } from "./dataset-reset";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://ondaluz:ondaluz@localhost:5432/ondaluz";
const datasetPath =
  process.env.DATASET_PATH ?? join(process.cwd(), "ondaluz-pack", "data");
const sqlPath = join(__dirname, "sql");

type ImportDefinition = {
  file: string;
  table: string;
  columns: string[];
  gzip?: boolean;
};

const imports: ImportDefinition[] = [
  {
    file: "inventory.csv",
    table: "inventory",
    columns: [
      "serial",
      "customer_id",
      "vendor",
      "model",
      "hw_revision",
      "software_version",
      "plan_mbps",
      "previous_plan_mbps",
      "plan_since",
      "customer_since",
      "customer_status",
      "cancelled_at",
      "olt",
      "pon_port",
      "cto",
      "city",
      "neighborhood",
      "installed_at",
      "status",
      "removed_at",
    ],
  },
  {
    file: "tickets.csv",
    table: "tickets",
    columns: [
      "ticket_id",
      "opened_at",
      "customer_id",
      "channel",
      "category",
      "description",
      "resolution",
      "closed_at",
    ],
  },
  {
    file: "diagnostics.csv",
    table: "diagnostics",
    columns: [
      "ts",
      "serial",
      "requested_by",
      "diagnostic",
      "state",
      "download_mbps",
      "upload_mbps",
      "test_server",
    ],
  },
  {
    file: "informs.csv.gz",
    table: "informs",
    gzip: true,
    columns: [
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
      "wan_bytes_rx",
      "wan_bytes_tx",
      "lan1_bit_rate",
      "wifi_clients_24g",
      "wifi_clients_5g",
      "wifi_rssi_avg",
    ],
  },
];

function ensureDataset(): void {
  const missing = imports
    .map(({ file }) => join(datasetPath, file))
    .filter((path) => !existsSync(path));
  if (missing.length) {
    throw new Error(
      `Dataset incompleto. Arquivos ausentes: ${missing.join(", ")}`,
    );
  }
}

async function copyCsv(
  client: Client,
  definition: ImportDefinition,
): Promise<void> {
  const filePath = join(datasetPath, definition.file);
  const query = `COPY ${definition.table} (${definition.columns.join(",")}) FROM STDIN WITH (FORMAT csv, HEADER true)`;
  const target = client.query(copyFrom(query));
  const source = createReadStream(filePath);
  console.log(`[loader] Importando ${definition.file}...`);
  if (definition.gzip) {
    await pipeline(source, createGunzip(), target);
  } else {
    await pipeline(source, target);
  }
  console.log(`[loader] ${definition.file} importado.`);
}

async function refreshGeneratedLogicalDrops(client: Client) {
  await client.query(
    readFileSync(join(sqlPath, "generated-logical-drops.sql"), "utf8"),
  );
  const result = await client.query<{ logical_drops: string }>(
    "SELECT count(*)::text AS logical_drops FROM generated_logical_drops",
  );
  return result.rows[0]?.logical_drops ?? "0";
}

async function main(): Promise<void> {
  ensureDataset();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(readFileSync(join(sqlPath, "schema.sql"), "utf8"));
    const current = await client.query<{ status: string }>(
      "SELECT status FROM dataset_loads WHERE dataset_key = 'ondaluz-2026-08'",
    );
    if (current.rows[0]?.status === "complete") {
      const logicalDrops = await refreshGeneratedLogicalDrops(client);
      await client.query(
        "UPDATE dataset_loads SET details = details || jsonb_build_object('logical_drops', $1::text) WHERE dataset_key='ondaluz-2026-08'",
        [logicalDrops],
      );
      console.log("[loader] Dataset ja carregado; mantendo volume existente.");
      return;
    }

    await client.query(
      "INSERT INTO dataset_loads(dataset_key, status) VALUES ('ondaluz-2026-08', 'loading') ON CONFLICT (dataset_key) DO UPDATE SET status='loading', started_at=now(), finished_at=NULL",
    );
    // operational_incidents may reference tickets created by N1. PostgreSQL
    // requires both tables in the same TRUNCATE, even on a brand-new database
    // where the referencing table is still empty.
    await client.query(datasetResetSql);
    for (const definition of imports) await copyCsv(client, definition);

    console.log("[loader] Calculando metricas diarias e indices...");
    await client.query(readFileSync(join(sqlPath, "derived.sql"), "utf8"));
    const logicalDrops = await refreshGeneratedLogicalDrops(client);
    const counts = await client.query(`SELECT
      (SELECT count(*) FROM inventory) AS inventory,
      (SELECT count(*) FROM tickets) AS tickets,
      (SELECT count(*) FROM diagnostics) AS diagnostics,
      (SELECT count(*) FROM informs) AS informs,
      ${logicalDrops}::text AS logical_drops`);
    await client.query(
      "UPDATE dataset_loads SET status='complete', finished_at=now(), details=$1 WHERE dataset_key='ondaluz-2026-08'",
      [counts.rows[0]],
    );
    console.log("[loader] Carga concluida:", counts.rows[0]);
  } catch (error) {
    await client
      .query(
        "UPDATE dataset_loads SET status='failed', details=jsonb_build_object('error', $1::text) WHERE dataset_key='ondaluz-2026-08'",
        [error instanceof Error ? error.message : String(error)],
      )
      .catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

void main().catch((error) => {
  console.error("[loader] Falha:", error);
  process.exit(1);
});
