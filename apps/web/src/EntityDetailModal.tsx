import { ReactNode, useEffect, useId } from "react";
import { X } from "lucide-react";
import { HelpTooltip } from "./HelpTooltip";

export type EntityDetailItem = {
  label: string;
  value: ReactNode;
  hint?: string;
};

export function EntityDetailModal({
  variant,
  icon,
  eyebrow,
  title,
  subtitle,
  details,
  note,
  children,
  onClose,
}: {
  variant: string;
  icon: ReactNode;
  eyebrow: string;
  title: string;
  subtitle?: string;
  details: EntityDetailItem[];
  note?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="entity-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={`entity-modal ${variant}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="entity-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Fechar detalhes"
          title="Fecha esta janela de detalhes."
          autoFocus
        >
          <X size={19} />
        </button>
        <div>
          <header>
            <span className={`entity-modal-icon ${variant}`}>{icon}</span>
            <div>
              <span className="section-label">{eyebrow}</span>
              <h3 id={titleId}>{title}</h3>
              {subtitle && <p>{subtitle}</p>}
            </div>
          </header>
          {details.length > 0 && (
            <dl>
              {details.map((detail) => (
                <div key={detail.label}>
                  <dt>
                    {detail.label}
                    {detail.hint && (
                      <HelpTooltip
                        term={detail.label}
                        description={detail.hint}
                      />
                    )}
                  </dt>
                  <dd>{detail.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {children}
        {note && <p className="entity-modal-note">{note}</p>}
      </section>
    </div>
  );
}
