import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  MapPin,
  Network,
  RefreshCw,
  ShieldCheck,
  TicketCheck,
  WifiOff,
} from "lucide-react";
import { api } from "./api";
import { n1GuidanceEnabled, useAgentPolicy } from "./agentPolicy";
import { N1AdvisorChat } from "./N1AdvisorChat";
import type { SupportProfile } from "./types";
import { TechnicalText } from "./ProviderGlossary";

type Props = {
  customerId?: string;
  onBack: () => void;
  backLabel?: string;
  onOpenSupport: (customerId: string) => void;
};

export function OfflineDiagnosis({
  customerId,
  onBack,
  backLabel = "Voltar ao dashboard",
  onOpenSupport,
}: Props) {
  const policy = useAgentPolicy();
  const [profile, setProfile] = useState<SupportProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(customerId));
  const [error, setError] = useState("");
  const [documentation, setDocumentation] = useState("");

  useEffect(() => {
    if (!customerId) {
      setProfile(null);
      setLoading(false);
      setError("Selecione um cliente com alerta para iniciar o diagnóstico.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");
    setProfile(null);
    void api
      .support(customerId)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível montar o contexto do cliente.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <section className="offline-diagnosis-page">
      <header className="offline-diagnosis-hero">
        <div>
          <button className="back-button" type="button" onClick={onBack}>
            <ArrowLeft size={16} /> {backLabel}
          </button>
          <span className="section-label">Investigação orientada</span>
          <h1>Diagnóstico de sem conexão</h1>
          <p>
            Confira o contexto do cliente, compare os sinais disponíveis e
            escolha o próximo passo com evidência.
          </p>
        </div>
        <div className="offline-diagnosis-hero-icon" aria-hidden="true">
          <WifiOff size={27} />
        </div>
      </header>

      {loading && (
        <div className="offline-diagnosis-loading" role="status">
          <RefreshCw size={18} className="spin" />
          <span>Consolidando cadastro, medições, rede e histórico…</span>
        </div>
      )}

      {error && (
        <div className="offline-diagnosis-error" role="alert">
          <WifiOff size={17} />
          <span>{error}</span>
          <button type="button" onClick={onBack}>
            Voltar
          </button>
        </div>
      )}

      {profile && (
        <>
          <section className="offline-diagnosis-summary">
            <div>
              <span className="section-label">Cliente selecionado</span>
              <h2>{profile.customer.id}</h2>
              <p>
                <MapPin size={14} /> {profile.customer.neighborhood} ·{" "}
                {profile.customer.city}
              </p>
            </div>
            <div className="offline-diagnosis-decision">
              <span>Hipótese atual</span>
              <strong>
                <TechnicalText text={profile.decision.issue} />
              </strong>
              <small>
                Confiança {profile.decision.confidence.toLowerCase()} ·{" "}
                {profile.decision.actionLabel}
              </small>
            </div>
            <button
              className="offline-diagnosis-support"
              type="button"
              onClick={() => onOpenSupport(profile.customer.id)}
            >
              <TicketCheck size={16} /> Abrir atendimento N1
            </button>
          </section>

          <section className="offline-diagnosis-context-grid">
            <article className="panel offline-diagnosis-context-card">
              <div className="panel-heading">
                <div>
                  <span className="section-label">CPE ativa</span>
                  <h2>Equipamento e caminho</h2>
                </div>
                <Network size={20} />
              </div>
              <dl className="offline-diagnosis-dl">
                <div>
                  <dt>Equipamento</dt>
                  <dd>
                    {profile.equipment.vendor} {profile.equipment.model}
                  </dd>
                </div>
                <div>
                  <dt>Serial</dt>
                  <dd>{profile.equipment.serial}</dd>
                </div>
                <div>
                  <dt>Firmware</dt>
                  <dd>{profile.equipment.firmware}</dd>
                </div>
                <div>
                  <dt>Rede</dt>
                  <dd>{profile.equipment.network}</dd>
                </div>
              </dl>
            </article>

            <article className="panel offline-diagnosis-context-card">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Pré-diagnóstico</span>
                  <h2>Sinais verificados</h2>
                </div>
                <CheckCircle2 size={20} />
              </div>
              <ul className="offline-diagnosis-checks">
                <li>
                  <CheckCircle2 size={14} /> Caminho de infraestrutura
                  consultado
                </li>
                <li>
                  <CheckCircle2 size={14} /> Medições recentes consultadas
                </li>
                <li>
                  <CheckCircle2 size={14} /> Histórico NOC consultado
                </li>
                <li>
                  <CheckCircle2 size={14} /> {profile.recentTickets.length}{" "}
                  chamado(s) recente(s) no contexto
                </li>
              </ul>
              <p className="offline-diagnosis-advice">
                <strong>Orientação atual:</strong>{" "}
                {profile.preflight.mainAdvice}
              </p>
            </article>
          </section>

          {profile.activeIncidents.length > 0 && (
            <section className="panel offline-diagnosis-incidents">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Correlação operacional</span>
                  <h2>Incidentes que alcançam este cliente</h2>
                </div>
                <ShieldCheck size={20} />
              </div>
              {profile.activeIncidents.slice(0, 3).map((incident) => (
                <div
                  className="offline-diagnosis-incident"
                  key={incident.incidentId}
                >
                  <strong>
                    {incident.incidentId} ·{" "}
                    <TechnicalText text={incident.title} />
                  </strong>
                  <span>
                    {incident.affectedCpes.toLocaleString("pt-BR")} CPEs ·{" "}
                    {incident.probableCause}
                  </span>
                </div>
              ))}
            </section>
          )}

          {n1GuidanceEnabled(policy) ? (
            <>
              <section className="offline-ai-scope panel">
                <div>
                  <span className="section-label">Copiloto de diagnóstico</span>
                  <h2>
                    <Bot size={18} /> Contexto disponível para a IA
                  </h2>
                  <p>
                    A IA pode consultar o cadastro, CPE ativa, caminho de rede,
                    telemetria, medições, histórico de chamados e incidentes do
                    NOC deste cliente.
                  </p>
                </div>
                <small>
                  Consulta somente leitura. A IA recomenda; não altera a rede, o
                  cadastro ou o chamado automaticamente.
                </small>
              </section>
              <N1AdvisorChat
                customerId={profile.customer.id}
                profile={profile}
                onDocumentationChange={setDocumentation}
                onOutcomeChange={() => undefined}
              />
              {documentation && (
                <section className="offline-diagnosis-documentation panel">
                  <span className="section-label">
                    Rascunho de documentação
                  </span>
                  <p>{documentation}</p>
                </section>
              )}
            </>
          ) : (
            <section className="panel offline-manual-next-step">
              <span className="section-label">Próximo passo operacional</span>
              <h2>Conduza a confirmação pelo atendimento</h2>
              <p>{profile.decision.sayToCustomer}</p>
              <button
                type="button"
                onClick={() => onOpenSupport(profile.customer.id)}
              >
                Abrir atendimento N1 <ArrowLeft size={15} />
              </button>
            </section>
          )}
        </>
      )}
    </section>
  );
}
