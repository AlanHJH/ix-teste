import React, { Fragment, useId } from "react";

export const providerGlossary = {
  noc: {
    label: "NOC",
    description:
      "Centro de Operações de Rede: equipe que monitora falhas coletivas e coordena a recuperação da rede.",
    aliases: ["NOC"],
  },
  n1: {
    label: "N1",
    description:
      "Primeiro nível de suporte: confirma dados, orienta o cliente e escala o caso quando necessário.",
    aliases: ["N1"],
  },
  olt: {
    label: "OLT",
    description:
      "Equipamento central do provedor que concentra as portas ópticas e conecta os clientes à rede.",
    aliases: ["OLTs", "OLT"],
  },
  pon: {
    label: "PON",
    description:
      "Porta óptica compartilhada da OLT. Uma falha nela pode afetar várias CTOs e clientes ao mesmo tempo.",
    aliases: ["PONs", "PON"],
  },
  cto: {
    label: "CTO",
    description:
      "Caixa de distribuição óptica que divide a fibra para atender um grupo de clientes.",
    aliases: ["CTOs", "CTO"],
  },
  cpe: {
    label: "CPE",
    description:
      "Equipamento instalado no cliente, como o equipamento óptico ou o roteador gerenciado pelo provedor.",
    aliases: ["CPEs", "CPE"],
  },
  acs: {
    label: "ACS",
    description:
      "Servidor que gerencia CPEs remotamente, recebe telemetria e solicita diagnósticos.",
    aliases: ["ACS"],
  },
  mcp: {
    label: "MCP",
    description:
      "Protocolo que permite ao agente consultar ferramentas e dados da aplicação com permissões controladas.",
    aliases: ["MCP"],
  },
  tr069: {
    label: "TR-069",
    description:
      "Protocolo usado pelo ACS para configurar a CPE e receber eventos e telemetria remotamente.",
    aliases: ["TR‑069", "TR‐069", "TR-069"],
  },
  tr143: {
    label: "TR-143",
    description:
      "Teste remoto de download e upload entre a CPE e um servidor de diagnóstico.",
    aliases: ["TR‑143", "TR‐143", "TR-143"],
  },
  fec: {
    label: "FEC",
    description:
      "Contagem de erros corrigidos na transmissão. Crescimento anormal pode indicar degradação da fibra.",
    aliases: ["FEC"],
  },
  opticalSignal: {
    label: "Sinal óptico",
    description:
      "Potência da luz recebida pela CPE; valores muito negativos indicam sinal fraco ou perda na fibra.",
    aliases: ["potência óptica", "sinal óptico"],
  },
  dbm: {
    label: "dBm",
    description:
      "Unidade de potência usada no sinal óptico. Quanto mais negativo, mais fraco é o sinal recebido.",
    aliases: ["dBm"],
  },
  lan: {
    label: "LAN",
    description:
      "Rede local do cliente. A velocidade negociada na porta Ethernet pode limitar o plano entregue.",
    aliases: ["porta LAN", "LAN"],
  },
  wifi: {
    label: "Wi-Fi",
    description:
      "Rede sem fio dentro do imóvel; interferência e distância podem reduzir a velocidade percebida.",
    aliases: ["Wi‑Fi", "Wi‐Fi", "Wi-Fi", "WiFi"],
  },
  mbps: {
    label: "Mbps",
    description:
      "Megabits por segundo: unidade usada para informar a velocidade do plano ou de uma medição.",
    aliases: ["Mbps"],
  },
  firmware: {
    label: "Firmware",
    description:
      "Software interno da CPE. Uma versão pode alterar estabilidade, desempenho e recursos do equipamento.",
    aliases: ["firmware", "fw"],
  },
  hardware: {
    label: "Hardware",
    description:
      "Parte física do equipamento; modelo e revisão podem limitar portas, memória e desempenho.",
    aliases: ["hardware"],
  },
  serial: {
    label: "Serial",
    description:
      "Identificador único gravado no equipamento e usado para relacionar inventário, telemetria e diagnósticos.",
    aliases: ["serial"],
  },
  telemetry: {
    label: "Telemetria",
    description:
      "Medições enviadas pelo equipamento, como memória, reinícios, sinal óptico e erros de transmissão.",
    aliases: ["telemetria"],
  },
  reboot: {
    label: "Reboot",
    description:
      "Reinicialização da CPE. Repetições podem indicar instabilidade e interrompem a conexão do cliente.",
    aliases: [
      "reinicializações",
      "reinicialização",
      "reinícios",
      "reinício",
      "reboot",
    ],
  },
  rollback: {
    label: "Rollback canário",
    description:
      "Retorno controlado a uma versão anterior em poucos equipamentos antes de ampliar a mudança.",
    aliases: ["rollback canário", "rollback", "canário"],
  },
  rollout: {
    label: "Rollout",
    description:
      "Distribuição gradual de uma nova versão de firmware para o parque de equipamentos.",
    aliases: ["rollout"],
  },
  drop: {
    label: "Drop",
    description:
      "Trecho final da fibra entre a caixa de distribuição e o endereço do cliente.",
    aliases: ["drop lógico", "drop"],
  },
  uplink: {
    label: "Uplink",
    description:
      "Conexão que leva o tráfego da OLT para a rede principal do provedor.",
    aliases: ["uplink"],
  },
  chassis: {
    label: "Chassi",
    description:
      "Estrutura da OLT que acomoda placas, portas e fontes de alimentação.",
    aliases: ["chassi"],
  },
  speedTest: {
    label: "Speed test",
    description:
      "Medição de velocidade em um ponto específico; sozinha não localiza todos os gargalos da conexão.",
    aliases: ["speed test"],
  },
  timeout: {
    label: "Timeout",
    description:
      "O teste não respondeu dentro do tempo esperado; isso não equivale a uma medição de velocidade zero.",
    aliases: ["timeout"],
  },
  download: {
    label: "Download",
    description: "Velocidade de recebimento de dados da rede para o cliente.",
    aliases: ["download"],
  },
  upload: {
    label: "Upload",
    description: "Velocidade de envio de dados do cliente para a rede.",
    aliases: ["upload"],
  },
  logicalTopology: {
    label: "Topologia",
    description:
      "Mapa de como OLTs, portas PON, CTOs e CPEs se conectam e compartilham a infraestrutura.",
    aliases: ["topologia"],
  },
  inventory: {
    label: "Inventário",
    description:
      "Cadastro que relaciona cliente, equipamento, plano, localidade e ponto de conexão na rede.",
    aliases: ["inventário", "inventory"],
  },
} as const;

export type ProviderTermKey = keyof typeof providerGlossary;

export function ProviderTerm({
  term,
  children,
}: {
  term: ProviderTermKey;
  children?: string;
}) {
  const id = useId();
  const entry = providerGlossary[term];
  function explainWithAgent(event?: {
    preventDefault(): void;
    stopPropagation(): void;
  }) {
    event?.preventDefault();
    event?.stopPropagation();
    if (typeof window === "undefined") return;
    window.dispatchEvent(
      new CustomEvent("ondaluz:agent-explain", {
        detail: {
          technicalTerm: entry.label,
          technicalDescription: entry.description,
        },
      }),
    );
  }

  return (
    <span
      className="provider-term"
      role="button"
      tabIndex={0}
      aria-describedby={id}
      aria-label={`${entry.label}. Clique para explicar com o Agente IA.`}
      title="Clique para explicar com o Agente IA"
      onClick={explainWithAgent}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          explainWithAgent(event);
        }
      }}
    >
      {children ?? entry.label}
      <span id={id} className="provider-term-tooltip" role="tooltip">
        <strong>{entry.label}</strong>
        {entry.description}
        <small className="provider-term-ai-hint">
          Clique para explicar com o Agente IA
        </small>
      </span>
    </span>
  );
}

const aliasToTerm = new Map<string, ProviderTermKey>();
const rawAliases: string[] = [];
for (const [term, entry] of Object.entries(providerGlossary) as Array<
  [ProviderTermKey, (typeof providerGlossary)[ProviderTermKey]]
>) {
  for (const alias of entry.aliases) {
    aliasToTerm.set(normalizeAlias(alias), term);
    rawAliases.push(alias);
  }
}

const technicalTermPattern = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${rawAliases
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|")})(?![\\p{L}\\p{N}_])`,
  "giu",
);

function normalizeAlias(value: string) {
  return value.toLocaleLowerCase("pt-BR").replace(/[\u2010\u2011]/g, "-");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function TechnicalText({ text }: { text: string }) {
  const parts = text.split(technicalTermPattern);
  return (
    <>
      {parts.map((part, index) => {
        const term = aliasToTerm.get(normalizeAlias(part));
        return term ? (
          <ProviderTerm key={`${part}-${index}`} term={term}>
            {part}
          </ProviderTerm>
        ) : (
          <Fragment key={`${part}-${index}`}>{part}</Fragment>
        );
      })}
    </>
  );
}
