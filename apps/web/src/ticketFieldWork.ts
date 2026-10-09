export const opticalFieldWorkCategory = "Medição óptica em campo";

export const fieldWorkMeasurementOptions = [
  "Potência óptica na CTO e no splitter",
  "Conectores e emendas",
  "Continuidade e trecho da fibra",
  "OTDR quando necessário",
] as const;

export type FieldWorkLayer = "cliente" | "cto_splitter" | "poste_trecho";

export const fieldWorkLayerLabels: Record<FieldWorkLayer, string> = {
  cliente: "Cliente / CPE / drop",
  cto_splitter: "CTO / splitter",
  poste_trecho: "Poste / trecho compartilhado",
};

export type TicketFieldWork = {
  technician: string;
  layer: FieldWorkLayer;
  layerLabel: string;
  measurements: string[];
  networkPath: string;
};

export function readTicketFieldWork(
  payload: Record<string, unknown> | undefined,
): TicketFieldWork | null {
  const raw = payload?.field_work;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const layer =
    value.layer === "cliente" ||
    value.layer === "cto_splitter" ||
    value.layer === "poste_trecho"
      ? value.layer
      : "poste_trecho";

  return {
    technician:
      typeof value.technician === "string" ? value.technician : "Não informado",
    layer,
    layerLabel:
      typeof value.layerLabel === "string"
        ? value.layerLabel
        : fieldWorkLayerLabels[layer],
    measurements: Array.isArray(value.measurements)
      ? value.measurements.filter(
          (item): item is string => typeof item === "string",
        )
      : [],
    networkPath:
      typeof value.networkPath === "string"
        ? value.networkPath
        : "Não informado",
  };
}
