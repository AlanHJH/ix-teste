import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const number = new Intl.NumberFormat("pt-BR");

export type FacetFilter = {
  kind: string;
  value: string;
  label: string;
  detail: string;
};

export type FacetFilterOption = FacetFilter & { count: number };

export function FacetFilterSelect<
  Filter extends FacetFilter,
  Option extends Filter & FacetFilterOption,
>({
  filters,
  onChange,
  query,
  onQueryChange,
  loadOptions,
  placeholder,
  ariaLabel,
  optionsId,
  compact = false,
  showFreeSearch = false,
  onFreeSearch,
  showClear = true,
}: {
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
  query: string;
  onQueryChange: (query: string) => void;
  loadOptions: (query: string) => Promise<Option[]>;
  placeholder: string;
  ariaLabel: string;
  optionsId: string;
  compact?: boolean;
  showFreeSearch?: boolean;
  onFreeSearch?: (query: string) => void;
  showClear?: boolean;
}) {
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      loadOptions(query)
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
  }, [loadOptions, open, query]);

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

  const hasFreeSearch = Boolean(showFreeSearch && query.trim() && onFreeSearch);
  const navigableOptionCount = visibleOptions.length + (hasFreeSearch ? 1 : 0);

  useEffect(() => {
    if (!open || loading || navigableOptionCount === 0) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex(0);
  }, [loading, navigableOptionCount, open, query]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document
      .getElementById(`${optionsId}-option-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open, optionsId]);

  function select(option: Option) {
    onChange([...filters, option]);
    onQueryChange("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function remove(filter: Filter) {
    onChange(
      filters.filter(
        (item) => !(item.kind === filter.kind && item.value === filter.value),
      ),
    );
  }

  function activateOption(index: number) {
    if (index < visibleOptions.length) {
      select(visibleOptions[index]);
      return;
    }
    if (hasFreeSearch && onFreeSearch) {
      onFreeSearch(query.trim());
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  function moveActiveOption(direction: 1 | -1) {
    if (!open) setOpen(true);
    if (navigableOptionCount === 0) return;
    setActiveIndex((current) => {
      if (current < 0) return direction === 1 ? 0 : navigableOptionCount - 1;
      return (
        (current + direction + navigableOptionCount) % navigableOptionCount
      );
    });
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
            onClick={() => setOpen(true)}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && open) {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                setActiveIndex(-1);
                return;
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                moveActiveOption(1);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                moveActiveOption(-1);
                return;
              }
              if (event.key === "Home" && open && navigableOptionCount > 0) {
                event.preventDefault();
                setActiveIndex(0);
                return;
              }
              if (event.key === "End" && open && navigableOptionCount > 0) {
                event.preventDefault();
                setActiveIndex(navigableOptionCount - 1);
                return;
              }
              if (event.key === "Enter" && open && navigableOptionCount > 0) {
                event.preventDefault();
                activateOption(activeIndex >= 0 ? activeIndex : 0);
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
            aria-activedescendant={
              open && activeIndex >= 0
                ? `${optionsId}-option-${activeIndex}`
                : undefined
            }
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
            visibleOptions.map((option, index) => (
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={activeIndex === index ? "active" : undefined}
                id={`${optionsId}-option-${index}`}
                key={`${option.kind}:${option.value}`}
                tabIndex={-1}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
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
          {hasFreeSearch && onFreeSearch && (
            <button
              className={`inventory-free-search ${
                activeIndex === visibleOptions.length ? "active" : ""
              }`}
              type="button"
              role="option"
              aria-selected={activeIndex === visibleOptions.length}
              id={`${optionsId}-option-${visibleOptions.length}`}
              tabIndex={-1}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(visibleOptions.length)}
              onClick={() => {
                onFreeSearch(query.trim());
                setOpen(false);
                setActiveIndex(-1);
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
