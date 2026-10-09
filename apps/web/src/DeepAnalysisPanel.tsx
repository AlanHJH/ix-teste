import { Bot, CheckCircle2, CircleAlert, Compass } from "lucide-react";
import { TechnicalText } from "./ProviderGlossary";
import type { N1DeepAnalysis } from "./types";
import "./DeepAnalysisPanel.css";

export const DEEP_ANALYSIS_PROMPT =
  "Faça uma análise profunda deste caso e mostre o caminho das pedras para o atendente. Cruze todo o contexto disponível antes de responder.";

export function DeepAnalysisPanel({
  analysis,
  loading = false,
  error = "",
  compact = false,
}: {
  analysis: N1DeepAnalysis | null;
  loading?: boolean;
  error?: string;
  compact?: boolean;
}) {
  return (
    <section className={`deep-analysis-panel ${compact ? "compact" : ""}`}>
      <header className="deep-analysis-header">
        <div className="deep-analysis-title-icon" aria-hidden="true">
          <Bot size={19} />
        </div>
        <div>
          <span className="section-label">Análise profunda do caso</span>
          <h2>O caminho das pedras</h2>
          <p>
            Hipóteses, evidências e decisões possíveis reunidas em uma única
            leitura para orientar o próximo passo.
          </p>
        </div>
        <span className="deep-analysis-badge">
          <Compass size={14} />
          {analysis?.model === "openai"
            ? "IA + evidências"
            : "Evidências consolidadas"}
        </span>
      </header>

      {loading && (
        <div className="deep-analysis-loading" role="status" aria-live="polite">
          <span className="deep-analysis-loading-spinner" aria-hidden="true" />
          <div className="deep-analysis-loading-copy">
            <strong>Preparando análise com IA</strong>
            <span>
              Cruzando cadastro, equipamento, histórico e medições. Isso pode
              levar alguns segundos.
            </span>
          </div>
          <div className="deep-analysis-loading-progress" aria-hidden="true">
            <span />
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="deep-analysis-error" role="alert">
          <CircleAlert size={16} /> {error}
        </div>
      )}

      {analysis && !loading && (
        <>
          <div className="deep-analysis-conclusion">
            <span>Leitura inicial</span>
            <h3>
              <TechnicalText text={analysis.headline} />
            </h3>
            <p>{analysis.summary}</p>
          </div>

          <div className="deep-analysis-grid">
            <section className="deep-analysis-block">
              <div className="deep-analysis-block-heading">
                <div>
                  <span className="section-label">
                    O que pode ter acontecido
                  </span>
                  <h3>Hipóteses comparadas</h3>
                  <p className="deep-analysis-block-help">
                    Compare as causas possíveis. “Alta probabilidade” prioriza a
                    investigação, mas não confirma a causa física.
                  </p>
                </div>
              </div>
              <div className="deep-analysis-causes">
                {analysis.causes.map((cause) => (
                  <article key={cause.title}>
                    <div className="deep-analysis-cause-title">
                      <strong>
                        <TechnicalText text={cause.title} />
                      </strong>
                      <span className={`likelihood ${cause.likelihood}`}>
                        {cause.likelihood} probabilidade
                      </span>
                    </div>
                    <ul>
                      {cause.evidence.map((item) => (
                        <li key={item}>
                          <CheckCircle2 size={13} /> {item}
                        </li>
                      ))}
                    </ul>
                    {cause.counterEvidence.length > 0 && (
                      <small>
                        Ainda não prova a causa:{" "}
                        {cause.counterEvidence.join(" ")}
                      </small>
                    )}
                  </article>
                ))}
              </div>
            </section>

            <section className="deep-analysis-block path">
              <div className="deep-analysis-block-heading">
                <div>
                  <span className="section-label">Sequência recomendada</span>
                  <h3>Como conduzir</h3>
                  <p className="deep-analysis-block-help">
                    Siga estes passos para validar o sinal sem executar ações
                    automáticas na rede.
                  </p>
                </div>
              </div>
              <ol className="deep-analysis-path">
                {analysis.path.map((step) => (
                  <li key={`${step.step}-${step.title}`}>
                    <span className="deep-analysis-step-number">
                      {step.step}
                    </span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.action}</p>
                      <small>
                        <b>Decida assim:</b> {step.decision}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="deep-analysis-facts">
            <div>
              <span className="section-label">Fatos confirmados</span>
              <p className="deep-analysis-facts-help">
                Dados observados nos registros consultados e usados na análise.
              </p>
              <ul>
                {analysis.confirmed.map((item) => (
                  <li key={item}>
                    <CheckCircle2 size={13} /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <span className="section-label">Ainda falta confirmar</span>
              <p className="deep-analysis-facts-help">
                Informações que o técnico ou o NOC ainda precisam validar.
              </p>
              <ul>
                {analysis.unknowns.map((item) => (
                  <li key={item}>
                    <CircleAlert size={13} /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="deep-analysis-footer-grid">
            <div className="deep-analysis-script">
              <span>Fala sugerida para o cliente</span>
              <p>“{analysis.customerScript}”</p>
            </div>
            <div className="deep-analysis-escalation">
              <span>Regra de encaminhamento</span>
              <p>{analysis.escalation}</p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
