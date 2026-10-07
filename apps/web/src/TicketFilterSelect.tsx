import { useCallback, useState } from "react";
import { api } from "./api";
import { FacetFilterSelect } from "./FacetFilterSelect";
import type {
  TicketFilter,
  TicketFilterKind,
  TicketFilterOption,
} from "./types";

type TicketFilterGroup = {
  key: string;
  label: string;
  placeholder: string;
  kinds: readonly TicketFilterKind[];
};

const groups: readonly TicketFilterGroup[] = [
  {
    key: "ticket",
    label: "Ticket",
    placeholder: "ID, origem ou responsável",
    kinds: ["ticket", "source", "openedBy"],
  },
  {
    key: "customer",
    label: "Cliente e origem",
    placeholder: "Cliente ou canal",
    kinds: ["customer", "channel"],
  },
  {
    key: "reason",
    label: "Motivo relatado",
    placeholder: "Categoria",
    kinds: ["category"],
  },
  {
    key: "resolution",
    label: "Resolução e rede",
    placeholder: "Resolução, situação NOC ou rede",
    kinds: ["resolution", "nocStatus", "olt", "pon", "cto"],
  },
] as const;

function TicketColumnFilter({
  group,
  filters,
  onChange,
}: {
  group: TicketFilterGroup;
  filters: TicketFilter[];
  onChange: (filters: TicketFilter[]) => void;
}) {
  const [query, setQuery] = useState("");
  const groupFilters = filters.filter((filter) =>
    group.kinds.includes(filter.kind),
  );
  const loadOptions = useCallback(
    async (currentQuery: string) => {
      const options = await Promise.all(
        group.kinds.map((kind) => api.ticketFilterOptions(currentQuery, kind)),
      );
      return options.flat() as TicketFilterOption[];
    },
    [group],
  );

  function replaceGroup(nextGroupFilters: TicketFilter[]) {
    onChange([
      ...filters.filter((filter) => !group.kinds.includes(filter.kind)),
      ...nextGroupFilters,
    ]);
  }

  return (
    <div className="column-filter-field">
      <span>{group.label}</span>
      <FacetFilterSelect
        filters={groupFilters}
        onChange={replaceGroup}
        query={query}
        onQueryChange={setQuery}
        loadOptions={loadOptions}
        placeholder={group.placeholder}
        ariaLabel={`Filtrar ${group.label.toLocaleLowerCase("pt-BR")}`}
        optionsId={`ticket-filter-${group.key}-options`}
        compact
        showClear={groupFilters.length > 0 || Boolean(query)}
      />
    </div>
  );
}

export function TicketFilterSelect({
  filters,
  onChange,
}: {
  filters: TicketFilter[];
  onChange: (filters: TicketFilter[]) => void;
}) {
  return (
    <div className="column-filter-grid" aria-label="Filtros por coluna">
      {groups.map((group) => (
        <TicketColumnFilter
          key={group.key}
          group={group}
          filters={filters}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
