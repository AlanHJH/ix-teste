import { MessageCircle, Sparkles } from "lucide-react";

export function OpenIrisChatButton({
  onClick,
  label = "Abrir chat com a Íris",
  compact = false,
}: {
  onClick: () => void;
  label?: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`open-iris-context-button ${compact ? "compact" : ""}`}
      onClick={onClick}
      title={label}
    >
      {compact ? <MessageCircle size={14} /> : <Sparkles size={15} />}
      {label}
    </button>
  );
}
