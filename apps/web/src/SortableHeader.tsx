import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";

export function SortableHeader<Sort extends string>({
  label,
  ascending,
  descending,
  current,
  onChange,
  children,
}: {
  label: string;
  ascending: Sort;
  descending: Sort;
  current: Sort;
  onChange: (sort: Sort) => void;
  children?: ReactNode;
}) {
  const direction =
    current === ascending
      ? "ascending"
      : current === descending
        ? "descending"
        : "none";
  const next = direction === "ascending" ? descending : ascending;
  const Icon =
    direction === "ascending"
      ? ArrowUp
      : direction === "descending"
        ? ArrowDown
        : ChevronsUpDown;

  return (
    <th aria-sort={direction}>
      <span className="sortable-heading">
        <button
          type="button"
          className={direction === "none" ? "" : "active"}
          onClick={() => onChange(next)}
          title={`Ordenar ${label.toLocaleLowerCase("pt-BR")} ${direction === "ascending" ? "de forma decrescente" : "de forma crescente"}`}
        >
          <span>{label}</span>
          <Icon size={13} aria-hidden="true" />
        </button>
        {children}
      </span>
    </th>
  );
}
