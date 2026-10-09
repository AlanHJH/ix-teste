import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

export function SideDrawer({
  children,
  className = "",
  backdropClassName = "",
  labelledBy,
  ariaLabel,
  closeLabel = "Fechar painel lateral",
  closeDisabled = false,
  onClose,
}: {
  children: ReactNode;
  className?: string;
  backdropClassName?: string;
  labelledBy?: string;
  ariaLabel?: string;
  closeLabel?: string;
  closeDisabled?: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !closeDisabled) onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDisabled, onClose]);

  return (
    <div
      className={`side-drawer-backdrop ${backdropClassName}`.trim()}
      role="presentation"
      onMouseDown={() => !closeDisabled && onClose()}
    >
      <section
        className={`side-drawer ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="entity-modal-close side-drawer-close"
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          title={closeLabel}
          disabled={closeDisabled}
          autoFocus
        >
          <X size={19} aria-hidden="true" />
        </button>
        {children}
      </section>
    </div>
  );
}
