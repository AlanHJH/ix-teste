import { useEffect, useMemo, useState } from "react";
import {
  Database,
  Download,
  Info,
  LoaderCircle,
  Play,
  Trash2,
} from "lucide-react";
import { api, type DataLabInput, type DataLabJob } from "./api";

const scenarioOptions: Array<{
  value: DataLabInput["scenario"];
  label: string;
  description: string;
}> = [
  {
    value: "mixed",
    label: "Operação mista · N1 → NOC",
    description:
      "Mantém a maioria dos chamados no N1 e concentra sinais compartilhados para o NOC.",
  },
  {
    value: "baseline",
    label: "Baseline saudável",
    description: "Sinais normais para comparar falsos positivos.",
  },
  {
    value: "optical",
    label: "Degradação óptica",
    description: "RX baixo e chamados de sem conexão em múltiplos pontos.",
  },
  {
    value: "fec",
    label: "FEC disseminado",
    description: "Erros FEC crescentes em PONs compartilhadas.",
  },
  {
    value: "firmware",
    label: "Firmware instável",
    description: "Memória baixa e reinícios concentrados na versão 2.4.1.",
  },
  {
    value: "capacity",
    label: "Capacidade incompatível",
    description: "Plano de 500 Mbps negociando em 100 Mbps.",
  },
  {
    value: "missing-inform",
    label: "Ausência de Inform",
    description: "Janelas sem telemetria para validar o temporizador.",
  },
];

const defaultInput: DataLabInput = {
  scenario: "mixed",
  cpeCount: 2_000,
  days: 7,
  informsPerDay: 4,
  batchSize: 500,
  includeTickets: true,
  includeDiagnostics: true,
  routeTicketsThroughN1: true,
};

const integer = new Intl.NumberFormat("pt-BR");

function formatStatus(status: DataLabJob["status"]) {
  return {
    queued: "Na fila",
    running: "Gerando",
    completed: "Concluído",
    failed: "Falhou",
    cancelled: "Cancelado",
  }[status];
}

function percent(job: DataLabJob) {
  if (!job.cpeCount) return 0;
  return Math.min(100, Math.round((job.processedCpes / job.cpeCount) * 100));
}

function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <span className="data-lab-field-label">
      {label}
      <span
        className="data-lab-tooltip-trigger"
        aria-label={`Ajuda: ${hint}`}
        title={hint}
      >
        <Info size={13} aria-hidden="true" />
        <span className="data-lab-tooltip-content" role="tooltip">
          {hint}
        </span>
      </span>
    </span>
  );
}

export function DataLabPage() {
  const [input, setInput] = useState<DataLabInput>(defaultInput);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof api.dataLabPreview>
  > | null>(null);
  const [job, setJob] = useState<DataLabJob | null>(null);
  const [jobs, setJobs] = useState<DataLabJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const estimatedRows = useMemo(
    () => input.cpeCount * input.days * input.informsPerDay,
    [input.cpeCount, input.days, input.informsPerDay],
  );
  const selectedScenario = scenarioOptions.find(
    (option) => option.value === input.scenario,
  );

  useEffect(() => {
    api
      .dataLabJobs()
      .then((response) => setJobs(response.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!job || (job.status !== "queued" && job.status !== "running")) return;
    const timer = window.setInterval(() => {
      api
        .dataLabJob(job.jobId)
        .then(setJob)
        .catch(() => undefined);
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [job]);

  useEffect(() => {
    if (job?.status === "completed" || job?.status === "failed") {
      api
        .dataLabJobs()
        .then((response) => setJobs(response.data))
        .catch(() => undefined);
    }
  }, [job?.status]);

  function update<K extends keyof DataLabInput>(
    key: K,
    value: DataLabInput[K],
  ) {
    setInput((current) => ({ ...current, [key]: value }));
    setPreview(null);
    setError("");
  }

  async function handlePreview() {
    setBusy(true);
    setError("");
    try {
      setPreview(await api.dataLabPreview(input));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível calcular o plano.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setError("");
    try {
      const nextPreview = preview ?? (await api.dataLabPreview(input));
      if (!nextPreview.accepted) {
        setPreview(nextPreview);
        setError(
          "O plano excede o limite local. Reduza o volume antes de gerar.",
        );
        return;
      }
      const nextJob = await api.dataLabCreateJob(input);
      setJob(nextJob);
      setJobs((current) => [
        nextJob,
        ...current.filter((item) => item.jobId !== nextJob.jobId),
      ]);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível iniciar o job.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(jobId: string) {
    if (!window.confirm("Remover os dados sintéticos produzidos por este job?"))
      return;
    try {
      await api.dataLabRemoveJob(jobId);
      setJobs((current) => current.filter((item) => item.jobId !== jobId));
      if (job?.jobId === jobId) setJob(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível remover o job.",
      );
    }
  }

  return (
    <section className="data-lab-page">
      <header className="data-lab-hero">
        <div>
          <span className="section-label">Validação controlada</span>
          <h1>Laboratório de dados</h1>
          <p>
            Gere cenários reproduzíveis da arquitetura, acompanhe a ingestão em
            lotes e valide NOC/N1 sem editar o dataset original.
          </p>
        </div>
        <Database size={32} aria-hidden="true" />
      </header>

      <div className="data-lab-grid">
        <section className="panel data-lab-form-panel">
          <div className="panel-heading">
            <div>
              <span className="section-label">Cenário sintético</span>
              <h2>O que você quer provocar?</h2>
            </div>
            <span className="data-lab-badge">Data Lab</span>
          </div>
          <label className="data-lab-field data-lab-wide-field">
            <FieldLabel
              label="Cenário"
              hint="Escolha o padrão de sinais que será reproduzido no job."
            />
            <select
              title="Escolha o padrão de sinais que será reproduzido no job."
              value={input.scenario}
              onChange={(event) =>
                update(
                  "scenario",
                  event.target.value as DataLabInput["scenario"],
                )
              }
            >
              {scenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <small>{selectedScenario?.description}</small>
          </label>
          <div className="data-lab-fields-grid">
            <label className="data-lab-field">
              <FieldLabel
                label="CPEs sintéticas"
                hint="Quantidade de equipamentos isolados que serão criados para este job."
              />
              <input
                type="number"
                min="1"
                max="300000"
                title="Quantidade de equipamentos isolados que serão criados para este job."
                value={input.cpeCount}
                onChange={(event) =>
                  update("cpeCount", Number(event.target.value) || 1)
                }
              />
              <small>Inventário isolado por job.</small>
            </label>
            <label className="data-lab-field">
              <FieldLabel
                label="Dias simulados"
                hint="Janela histórica usada no event_time; não altera o relógio atual."
              />
              <input
                type="number"
                min="1"
                max="30"
                title="Janela histórica usada no event_time; não altera o relógio atual."
                value={input.days}
                onChange={(event) =>
                  update("days", Number(event.target.value) || 1)
                }
              />
              <small>Usa event_time, não o relógio atual.</small>
            </label>
            <label className="data-lab-field">
              <FieldLabel
                label="Informs por dia"
                hint="Frequência de telemetria sintética por CPE, limitada a 24 eventos diários."
              />
              <input
                type="number"
                min="1"
                max="24"
                title="Frequência de telemetria sintética por CPE, limitada a 24 eventos diários."
                value={input.informsPerDay}
                onChange={(event) =>
                  update("informsPerDay", Number(event.target.value) || 1)
                }
              />
              <small>Até 24 por CPE/dia.</small>
            </label>
            <label className="data-lab-field">
              <FieldLabel
                label="CPEs por lote"
                hint="Tamanho dos lotes de processamento; reduza para observar mais etapas e backpressure."
              />
              <input
                type="number"
                min="100"
                max="5000"
                title="Tamanho dos lotes de processamento; reduza para observar mais etapas e backpressure."
                value={input.batchSize}
                onChange={(event) =>
                  update("batchSize", Number(event.target.value) || 100)
                }
              />
              <small>Backpressure do processamento.</small>
            </label>
          </div>
          <div className="data-lab-checks">
            <label>
              <input
                type="checkbox"
                title="Gera chamados sintéticos correlacionados aos sinais do cenário."
                checked={input.includeTickets}
                onChange={(event) =>
                  update("includeTickets", event.target.checked)
                }
              />{" "}
              Criar chamados correlatos
            </label>
            <label>
              <input
                type="checkbox"
                title="Gera diagnósticos sintéticos para enriquecer a validação N1/NOC."
                checked={input.includeDiagnostics}
                onChange={(event) =>
                  update("includeDiagnostics", event.target.checked)
                }
              />{" "}
              Criar medições de diagnóstico
            </label>
            <label>
              <input
                type="checkbox"
                title="Coloca os chamados sintéticos na fila do N1 para a triagem automática decidir quais devem seguir ao NOC."
                checked={input.routeTicketsThroughN1}
                onChange={(event) =>
                  update("routeTicketsThroughN1", event.target.checked)
                }
              />{" "}
              Enviar chamados para triagem N1/NOC
            </label>
          </div>
          <p className="data-lab-routing-note">
            Com a triagem habilitada, cada chamado nasce no N1. Casos
            individuais permanecem como atendimento; sinais compartilhados e
            confiáveis são encaminhados automaticamente ao NOC para agrupamento.
          </p>
          <div className="data-lab-plan">
            <div>
              <span>Volume estimado</span>
              <strong>{integer.format(estimatedRows)} Informs</strong>
            </div>
            <div>
              <span>Escopos cobertos</span>
              <strong>cliente · firmware · PON · OLT · região</strong>
            </div>
          </div>
          <div className="data-lab-actions">
            <button
              className="button-secondary"
              type="button"
              onClick={handlePreview}
              disabled={busy}
            >
              <Download size={15} /> Pré-visualizar plano
            </button>
            <button
              className="button-primary"
              type="button"
              onClick={handleGenerate}
              disabled={
                busy ||
                Boolean(
                  job && (job.status === "queued" || job.status === "running"),
                )
              }
            >
              <Play size={15} />{" "}
              {busy ? "Preparando…" : "Gerar e ingerir dados"}
            </button>
          </div>
          {preview && (
            <div
              className={`data-lab-preview ${preview.accepted ? "accepted" : "rejected"}`}
            >
              <strong>
                {preview.accepted ? "Plano aceito" : "Plano acima do limite"}
              </strong>
              <span>
                {integer.format(preview.targetRows)} eventos · limite local{" "}
                {integer.format(preview.maxRows)}
              </span>
              <small>{preview.recommendation}</small>
            </div>
          )}
          {error && (
            <p className="data-lab-error" role="alert">
              {error}
            </p>
          )}
        </section>

        <section className="panel data-lab-progress-panel">
          <div className="panel-heading">
            <div>
              <span className="section-label">Processamento</span>
              <h2>Acompanhe o job</h2>
            </div>
            {job && (
              <span className={`data-lab-status ${job.status}`}>
                {formatStatus(job.status)}
              </span>
            )}
          </div>
          {!job ? (
            <div className="data-lab-empty">
              <Database size={23} />
              <p>
                Pré-visualize um cenário e inicie um job para acompanhar a
                geração em lotes.
              </p>
            </div>
          ) : (
            <div className="data-lab-current-job">
              <div className="data-lab-job-title">
                <strong>{selectedScenario?.label ?? job.scenario}</strong>
                <code>{job.jobId.slice(0, 8)}</code>
              </div>
              <div className="data-lab-progress">
                <span style={{ width: `${percent(job)}%` }} />
              </div>
              <div className="data-lab-progress-meta">
                <span>{percent(job)}% das CPEs</span>
                <span>
                  {integer.format(job.generatedRows)} /{" "}
                  {integer.format(job.targetRows)} Informs
                </span>
              </div>
              {job.status === "running" && (
                <p className="data-lab-running">
                  <LoaderCircle size={14} /> O servidor está processando em
                  lotes; a tela pode permanecer aberta.
                </p>
              )}
              {job.status === "completed" && (
                <p className="data-lab-success">
                  Dados sintéticos gravados e agregados disponíveis para as
                  telas NOC/N1.
                </p>
              )}
              {job.error && <p className="data-lab-error">{job.error}</p>}
            </div>
          )}
        </section>
      </div>

      <section className="panel data-lab-history-panel">
        <div className="panel-heading">
          <div>
            <span className="section-label">Rastreabilidade</span>
            <h2>Jobs recentes</h2>
          </div>
          <small>Os dados podem ser removidos por job.</small>
        </div>
        {jobs.length === 0 ? (
          <p className="data-lab-history-empty">
            Nenhum cenário adicional foi gerado.
          </p>
        ) : (
          <div className="data-lab-history-list">
            {jobs.map((item) => (
              <article key={item.jobId} className="data-lab-history-row">
                <div>
                  <strong>
                    {scenarioOptions.find(
                      (option) => option.value === item.scenario,
                    )?.label ?? item.scenario}
                  </strong>
                  <small>
                    {new Date(item.createdAt).toLocaleString("pt-BR")} ·{" "}
                    {integer.format(item.generatedRows)} Informs
                  </small>
                </div>
                <span className={`data-lab-status ${item.status}`}>
                  {formatStatus(item.status)}
                </span>
                <button
                  type="button"
                  aria-label={`Remover job ${item.jobId.slice(0, 8)}`}
                  title="Remover dados deste job"
                  onClick={() => handleRemove(item.jobId)}
                  disabled={
                    item.status === "queued" || item.status === "running"
                  }
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
