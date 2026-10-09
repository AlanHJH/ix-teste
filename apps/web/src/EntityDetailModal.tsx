import { ReactNode, useId } from "react";
import { HelpTooltip } from "./HelpTooltip";
import { technicalHintForLabel } from "./ProviderGlossary";
import { SideDrawer } from "./SideDrawer";

export type EntityDetailItem = {
  label: string;
  value: ReactNode;
  hint?: string;
  wide?: boolean;
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

  return (
    <SideDrawer
      className={`entity-modal ${variant}`}
      labelledBy={titleId}
      closeLabel="Fechar detalhes"
      onClose={onClose}
    >
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
              <div
                key={detail.label}
                className={detail.wide ? "entity-detail-wide" : undefined}
              >
                <dt>
                  {detail.label}
                  {(detail.hint ?? technicalHintForLabel(detail.label)) && (
                    <HelpTooltip
                      term={detail.label}
                      description={
                        detail.hint ?? technicalHintForLabel(detail.label) ?? ""
                      }
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
    </SideDrawer>
  );
}
