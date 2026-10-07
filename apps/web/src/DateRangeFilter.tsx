import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type DateRange = { from: string; to: string };

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function shiftMonth(date: Date, amount: number) {
  const targetMonth = new Date(
    date.getFullYear(),
    date.getMonth() + amount,
    1,
    12,
  );
  const lastDay = new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth() + 1,
    0,
    12,
  ).getDate();
  return new Date(
    targetMonth.getFullYear(),
    targetMonth.getMonth(),
    Math.min(date.getDate(), lastDay),
    12,
  );
}

function sameMonth(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth()
  );
}

function rangeLabel(value: DateRange) {
  if (!value.from && !value.to) return "Selecionar período";

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
  const format = (date: string) =>
    formatter.format(parseLocalDate(date)).replaceAll(".", "");

  if (value.from && value.to)
    return `${format(value.from)} – ${format(value.to)}`;
  return format(value.from || value.to);
}

function fullDateLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function monthLabel(date: Date) {
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function calendarDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstVisibleDay = addDays(firstDay, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) =>
    addDays(firstVisibleDay, index),
  );
}

function dateRange(start: Date, end: Date): DateRange {
  const ordered =
    start.getTime() <= end.getTime() ? [start, end] : [end, start];
  return { from: localDate(ordered[0]), to: localDate(ordered[1]) };
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() =>
    value.from ? parseLocalDate(value.from) : today,
  );
  const [draftStart, setDraftStart] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [pendingFocusDate, setPendingFocusDate] = useState<string | null>(null);

  const days = useMemo(() => calendarDays(month), [month]);
  const selectedStart = value.from ? parseLocalDate(value.from) : null;
  const selectedEnd = value.to ? parseLocalDate(value.to) : selectedStart;

  useEffect(() => {
    if (!open) return;

    function handleOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !pendingFocusDate) return;
    const frame = requestAnimationFrame(() => {
      rootRef.current
        ?.querySelector<HTMLButtonElement>(`[data-date="${pendingFocusDate}"]`)
        ?.focus();
      setPendingFocusDate(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [month, open, pendingFocusDate]);

  function openPicker() {
    const initialDate = value.from ? parseLocalDate(value.from) : today;
    setMonth(
      new Date(initialDate.getFullYear(), initialDate.getMonth(), 1, 12),
    );
    setDraftStart(null);
    setHoveredDate(null);
    setPendingFocusDate(localDate(initialDate));
    setOpen(true);
  }

  function togglePicker() {
    if (open) {
      setOpen(false);
      return;
    }
    openPicker();
  }

  function applyRange(from: Date, to: Date) {
    onChange(dateRange(from, to));
    setDraftStart(null);
    setHoveredDate(null);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function applyPreset(from: Date, to = today) {
    applyRange(startOfDay(from), startOfDay(to));
  }

  function selectDate(date: Date) {
    if (!draftStart) {
      setDraftStart(date);
      setHoveredDate(date);
      return;
    }
    applyRange(draftStart, date);
  }

  function focusDate(next: Date) {
    setPendingFocusDate(localDate(next));
    if (!sameMonth(next, month)) {
      setMonth(new Date(next.getFullYear(), next.getMonth(), 1, 12));
    }
  }

  function handleDayKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    date: Date,
  ) {
    let next: Date | null = null;
    if (event.key === "ArrowLeft") next = addDays(date, -1);
    if (event.key === "ArrowRight") next = addDays(date, 1);
    if (event.key === "ArrowUp") next = addDays(date, -7);
    if (event.key === "ArrowDown") next = addDays(date, 7);
    if (event.key === "Home") next = addDays(date, -((date.getDay() + 6) % 7));
    if (event.key === "End")
      next = addDays(date, 6 - ((date.getDay() + 6) % 7));
    if (event.key === "PageUp") next = shiftMonth(date, -1);
    if (event.key === "PageDown") next = shiftMonth(date, 1);
    if (!next) return;
    event.preventDefault();
    focusDate(next);
  }

  const previewStart = draftStart ?? selectedStart;
  const previewEnd = draftStart ? (hoveredDate ?? draftStart) : selectedEnd;
  const previewRange =
    previewStart && previewEnd
      ? dateRange(previewStart, previewEnd)
      : { from: "", to: "" };

  const previousMonthEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    0,
    12,
  );
  const previousMonthStart = new Date(
    previousMonthEnd.getFullYear(),
    previousMonthEnd.getMonth(),
    1,
    12,
  );
  const currentQuarter = Math.floor(today.getMonth() / 3);
  const previousQuarterEnd = new Date(
    today.getFullYear(),
    currentQuarter * 3,
    0,
    12,
  );
  const previousQuarterStart = new Date(
    previousQuarterEnd.getFullYear(),
    previousQuarterEnd.getMonth() - 2,
    1,
    12,
  );

  return (
    <div className="date-range-filter" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="date-range-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={togglePicker}
      >
        <CalendarDays size={16} aria-hidden="true" />
        <span>{rangeLabel(value)}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="date-range-popover"
          role="dialog"
          aria-label="Selecionar período"
        >
          <div className="date-range-shortcuts">
            <strong>Atalhos</strong>
            <button type="button" onClick={() => applyPreset(today)}>
              Hoje
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset(addDays(today, -1), addDays(today, -1))
              }
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => applyPreset(addDays(today, -6))}
            >
              Últimos 7 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(addDays(today, -29))}
            >
              Últimos 30 dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset(previousMonthStart, previousMonthEnd)}
            >
              Mês passado
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset(previousQuarterStart, previousQuarterEnd)
              }
            >
              Trimestre passado
            </button>
            <button
              type="button"
              className="date-range-reset"
              onClick={() => {
                onChange({ from: "", to: "" });
                setOpen(false);
                triggerRef.current?.focus();
              }}
            >
              Limpar período
            </button>
          </div>

          <div className="date-range-calendar">
            <header>
              <button
                type="button"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1, 12),
                  )
                }
                aria-label="Mês anterior"
              >
                <ChevronLeft size={18} />
              </button>
              <strong aria-live="polite">{monthLabel(month)}</strong>
              <button
                type="button"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1, 12),
                  )
                }
                aria-label="Próximo mês"
              >
                <ChevronRight size={18} />
              </button>
            </header>

            <div className="date-range-weekdays" aria-hidden="true">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>
            <div className="date-range-days">
              {days.map((date) => {
                const key = localDate(date);
                const isOutside = !sameMonth(date, month);
                const isToday = key === localDate(today);
                const isStart = key === previewRange.from;
                const isEnd = key === previewRange.to;
                const isInRange =
                  Boolean(previewRange.from && previewRange.to) &&
                  key >= previewRange.from &&
                  key <= previewRange.to;

                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      isOutside ? "outside" : "",
                      isToday ? "today" : "",
                      isInRange ? "in-range" : "",
                      isStart ? "range-start" : "",
                      isEnd ? "range-end" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    data-date={key}
                    aria-label={fullDateLabel(date)}
                    aria-pressed={isInRange}
                    tabIndex={key === (value.from || localDate(today)) ? 0 : -1}
                    onClick={() => selectDate(date)}
                    onFocus={() => setHoveredDate(date)}
                    onMouseEnter={() => setHoveredDate(date)}
                    onKeyDown={(event) => handleDayKeyDown(event, date)}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <p className="date-range-hint">
              {draftStart
                ? "Escolha a data final do período"
                : "Escolha a data inicial do período"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
