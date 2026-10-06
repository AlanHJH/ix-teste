import { useCallback } from "react";
import { api } from "./api";
import { FacetFilterSelect } from "./FacetFilterSelect";
import type { InventoryFilter } from "./types";

type InventoryFilterSelectProps = {
  filters: InventoryFilter[];
  onChange: (filters: InventoryFilter[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  status?: "active" | "removed" | "all";
  placeholder: string;
  ariaLabel: string;
  optionsId: string;
  compact?: boolean;
  showFreeSearch?: boolean;
  onFreeSearch?: (query: string) => void;
  showClear?: boolean;
};

export function InventoryFilterSelect({
  status = "active",
  ...props
}: InventoryFilterSelectProps) {
  const loadOptions = useCallback(
    (query: string) => api.inventoryFilterOptions(query, status),
    [status],
  );

  return <FacetFilterSelect {...props} loadOptions={loadOptions} />;
}
