import { useCallback, useState } from "react";
import { api } from "./api";
import { FacetFilterSelect } from "./FacetFilterSelect";
import type {
  DiagnosticFilter,
  DiagnosticFilterKind,
  DiagnosticFilterOption,
} from "./types";

type DiagnosticFilterGroup = {
  key: string;
  label: string;
  placeholder: string;
  kinds: readonly DiagnosticFilterKind[];
};

const groups: readonly DiagnosticFilterGroup[] = [
  {
    key: "execution",
    label: "Execução",
    placeholder: "Solicitante",
    kinds: ["requestedBy"],
  },
  {
    key: "equipment",
    label: "CPE e cliente",
    placeholder: "Serial, cliente, fabricante ou modelo",
    kinds: ["serial", "customer", "vendor", "model"],
  },
  {
    key: "result",
    label: "Resultado",
    placeholder: "Estado, tipo ou servidor",
    kinds: ["state", "diagnostic", "testServer"],
  },
  {
    key: "network",
    label: "Rede",
    placeholder: "OLT, PON ou CTO",
    kinds: ["olt", "pon", "cto"],
  },
] as const;

function DiagnosticColumnFilter({
  group,
  filters,
  onChange,
}: {
  group: DiagnosticFilterGroup;
  filters: DiagnosticFilter[];
  onChange: (filters: DiagnosticFilter[]) => void;
}) {
  const [query, setQuery] = useState("");
  const groupFilters = filters.filter((filter) =>
    group.kinds.includes(filter.kind),
  );
  const loadOptions = useCallback(
    async (currentQuery: string) => {
      const options = await Promise.all(
        group.kinds.map((kind) =>
          api.diagnosticFilterOptions(currentQuery, kind),
        ),
      );
      return options.flat() as DiagnosticFilterOption[];
    },
    [group],
  );

  function replaceGroup(nextGroupFilters: DiagnosticFilter[]) {
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
        optionsId={`diagnostic-filter-${group.key}-options`}
        compact
        showClear={groupFilters.length > 0 || Boolean(query)}
      />
    </div>
  );
}

export function DiagnosticFilterSelect({
  filters,
  onChange,
}: {
  filters: DiagnosticFilter[];
  onChange: (filters: DiagnosticFilter[]) => void;
}) {
  return (
    <div className="column-filter-grid" aria-label="Filtros por coluna">
      {groups.map((group) => (
        <DiagnosticColumnFilter
          key={group.key}
          group={group}
          filters={filters}
          onChange={onChange}
        />
      ))}
    </div>
  );
}
