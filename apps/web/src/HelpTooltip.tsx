import { useEffect, useId, useRef, useState } from "react";
import { CircleHelp } from "lucide-react";

export function HelpTooltip({
  term,
  description,
}: {
  term: string;
  description: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="help-tooltip"
      data-open={open ? "true" : undefined}
    >
      <button
        type="button"
        aria-label={`Ajuda sobre ${term}`}
        aria-describedby={id}
        aria-expanded={open}
        aria-controls={id}
        title={`Ver explicação de ${term}`}
        onClick={() => setOpen((current) => !current)}
      >
        <CircleHelp size={14} aria-hidden="true" />
      </button>
      <span id={id} className="help-tooltip-content" role="tooltip">
        <strong>{term}</strong>
        {description}
      </span>
    </span>
  );
}
