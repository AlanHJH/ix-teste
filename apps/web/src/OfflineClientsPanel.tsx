import {
  AlertTriangle,
  ArrowRight,
  LoaderCircle,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import type { OfflineAlert, OfflineAlertPage } from "./types";

type Props = {
  page: OfflineAlertPage | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onDiagnose: (customerId: string) => void;
};

const statusLabel: Record<OfflineAlert["alert_status"], string> = {
  in_noc: "Em análise pelo NOC",
  open: "Relato em aberto",
  recent: "Relato recente",
};

function reportedAt(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OfflineClientsPanel({
  page,
  loading,
  error,
  onRefresh,
  onDiagnose,
}: Props) {
  const [diagnosingCustomerId, setDiagnosingCustomerId] = useState<
    string | null
  >(null);

  return (
    <section
      className="offline-alert-panel panel"
      aria-labelledby="offline-alert-title"
    >
      <header className="offline-alert-header">
        <div>
          <span className="section-label">Entrada operacional</span>
          <h2 id="offline-alert-title">Clientes com sinal de sem conexão</h2>
          <p>
            Últimos relatos associados a CPEs ativas. Abra o diagnóstico para
            confirmar o estado e entender o problema antes de agir.
          </p>
        </div>
        <button
          className="offline-alert-refresh"
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Atualizar alertas de sem conexão"
          title="Atualizar alertas"
        >
          <RefreshCw size={16} className={loading ? "spin" : undefined} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="offline-alert-error" role="alert">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading && !page ? (
        <div className="offline-alert-loading" role="status">
          <span className="spin" />
          <p>Verificando os relatos recentes…</p>
        </div>
      ) : page && page.data.length > 0 ? (
        <div className="offline-alert-list">
          {page.data.map((alert) => (
            <article className="offline-alert-card" key={alert.customer_id}>
              <div className="offline-alert-card-icon" aria-hidden="true">
                <WifiOff size={17} />
              </div>
              <div className="offline-alert-card-copy">
                <div className="offline-alert-card-title">
                  <strong>{alert.customer_id}</strong>
                  <span
                    className={`offline-alert-status ${alert.alert_status}`}
                  >
                    {statusLabel[alert.alert_status]}
                  </span>
                </div>
                <p>
                  {alert.vendor} {alert.model} · {alert.neighborhood} ·{" "}
                  {alert.city}
                </p>
                <small>
                  Relato {reportedAt(alert.reported_at)} · {alert.ticket_id}
                </small>
              </div>
              <button
                className="offline-alert-open"
                type="button"
                onClick={() => {
                  setDiagnosingCustomerId(alert.customer_id);
                  onDiagnose(alert.customer_id);
                }}
                disabled={diagnosingCustomerId === alert.customer_id}
              >
                {diagnosingCustomerId === alert.customer_id ? (
                  <>
                    <LoaderCircle size={15} className="spin" /> Buscando…
                  </>
                ) : (
                  <>
                    Diagnosticar
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="offline-alert-empty">
          <WifiOff size={20} />
          <div>
            <strong>Nenhum relato recente encontrado</strong>
            <p>
              A operação não tem, neste momento, um alerta de sem conexão para
              triagem.
            </p>
          </div>
        </div>
      )}

      {page && page.totalItems > page.data.length && (
        <small className="offline-alert-total">
          Mostrando {page.data.length} de {page.totalItems} alertas priorizados.
        </small>
      )}
    </section>
  );
}
