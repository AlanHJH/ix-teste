import { useCallback } from "react";
import { api } from "./api";
import { FacetFilterSelect } from "./FacetFilterSelect";
import type { TicketFilter } from "./types";

export function TicketFilterSelect({
  filters,
  onChange,
  query,
  onQueryChange,
  onFreeSearch,
}: {
  filters: TicketFilter[];
  onChange: (filters: TicketFilter[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onFreeSearch: (query: string) => void;
}) {
  const loadOptions = useCallback(
    (currentQuery: string) => api.ticketFilterOptions(currentQuery),
    [],
  );

  return (
    <FacetFilterSelect
      filters={filters}
      onChange={onChange}
      query={query}
      onQueryChange={onQueryChange}
      loadOptions={loadOptions}
      placeholder="Ticket, cliente, categoria, resolução ou canal"
      ariaLabel="Adicionar filtros aos tickets"
      optionsId="ticket-filter-options"
      showFreeSearch
      onFreeSearch={onFreeSearch}
      showClear={filters.length > 0 || Boolean(query)}
    />
  );
}
