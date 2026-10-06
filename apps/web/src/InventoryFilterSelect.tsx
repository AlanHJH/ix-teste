import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type { InventoryFilter, InventoryFilterOption } from "./types";

const number = new Intl.NumberFormat("pt-BR");

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
  filters,
  onChange,
  query,
  onQueryChange,
  status = "active",
  placeholder,
  ariaLabel,
  optionsId,
  compact = false,
  showFreeSearch = false,
  onFreeSearch,
  showClear = true,
}: InventoryFilterSelectProps) {
  const [options, setOptions] = useState<InventoryFilterOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      api
        .inventoryFilterOptions(query, status)
        .then((nextOptions) => {
          if (!cancelled) setOptions(nextOptions);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query, status]);

  const visibleOptions = useMemo(
    () =>
      options.filter(
        (option) =>
          !filters.some(
            (filter) =>
              filter.kind === option.kind && filter.value === option.value,
          ),
      ),
    [filters, options],
  );

  function select(option: InventoryFilterOption) {
    onChange([...filters, option]);
    onQueryChange("");
    setOpen(false);
  }

  function remove(filter: InventoryFilter) {
    onChange(
      filters.filter(
        (item) => !(item.kind === filter.kind && item.value === filter.value),
      ),
    );
  }

  return (
    <div
      className={`inventory-filter-select ${compact ? "compact" : ""}`}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
    >
      <div className="inventory-filter-input-row">
        <Search size={compact ? 14 : 18} />
        <div className="inventory-filter-combobox">
          {filters.map((filter) => (
            <span
              className="inventory-filter-chip"
              key={`${filter.kind}:${filter.value}`}
            >
              {filter.label}
              <button
                type="button"
                onClick={() => remove(filter)}
                aria-label={`Remover filtro ${filter.label}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                return;
              }
              if (
                event.key === "Enter" &&
                visibleOptions.length > 0 &&
                query.trim()
              ) {
                event.preventDefault();
                select(visibleOptions[0]);
              }
            }}
            placeholder={
              filters.length > 0 ? "Adicionar outro filtro…" : placeholder
            }
            aria-label={ariaLabel}
            role="combobox"
            aria-expanded={open}
            aria-controls={optionsId}
            aria-autocomplete="list"
          />
        </div>
        {showClear && (filters.length > 0 || Boolean(query.trim())) && (
          <button
            className="inventory-filter-clear"
            type="button"
            onClick={() => {
              onChange([]);
              onQueryChange("");
            }}
          >
            Limpar
          </button>
        )}
      </div>
      {open && (
        <div
          className="inventory-filter-options"
          id={optionsId}
          role="listbox"
          aria-label="Sugestões de filtro"
        >
          {loading ? (
            <p>Buscando opções…</p>
          ) : visibleOptions.length > 0 ? (
            visibleOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={`${option.kind}:${option.value}`}
                onClick={() => select(option)}
              >
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
                <span className="inventory-option-count">
                  {number.format(option.count)}
                </span>
              </button>
            ))
          ) : (
            <p>Nenhuma opção encontrada.</p>
          )}
          {showFreeSearch && query.trim() && onFreeSearch && (
            <button
              className="inventory-free-search"
              type="button"
              onClick={() => {
                onFreeSearch(query.trim());
                setOpen(false);
              }}
            >
              <Search size={14} /> Buscar “{query.trim()}” em todos os campos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
