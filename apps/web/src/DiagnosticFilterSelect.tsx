import { useCallback } from "react";
import { api } from "./api";
import { FacetFilterSelect } from "./FacetFilterSelect";
import type { DiagnosticFilter } from "./types";

export function DiagnosticFilterSelect({
  filters,
  onChange,
  query,
  onQueryChange,
  onFreeSearch,
}: {
  filters: DiagnosticFilter[];
  onChange: (filters: DiagnosticFilter[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onFreeSearch: (query: string) => void;
}) {
  const loadOptions = useCallback(
    (currentQuery: string) => api.diagnosticFilterOptions(currentQuery),
    [],
  );

  return (
    <FacetFilterSelect
      filters={filters}
      onChange={onChange}
      query={query}
      onQueryChange={onQueryChange}
      loadOptions={loadOptions}
      placeholder="Serial, cliente, fabricante, modelo, estado ou solicitante"
      ariaLabel="Adicionar filtros aos diagnósticos"
      optionsId="diagnostic-filter-options"
      showFreeSearch
      onFreeSearch={onFreeSearch}
      showClear={filters.length > 0 || Boolean(query)}
    />
  );
}
