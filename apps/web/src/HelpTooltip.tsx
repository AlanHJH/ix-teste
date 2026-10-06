import { useId } from "react";
import { CircleHelp } from "lucide-react";

export function HelpTooltip({
  term,
  description,
}: {
  term: string;
  description: string;
}) {
  const id = useId();
  return (
    <span
      className="help-tooltip"
      tabIndex={0}
      aria-label={`Ajuda sobre ${term}`}
      aria-describedby={id}
    >
      <CircleHelp size={14} aria-hidden="true" />
      <span id={id} className="help-tooltip-content" role="tooltip">
        <strong>{term}</strong>
        {description}
      </span>
    </span>
  );
}
