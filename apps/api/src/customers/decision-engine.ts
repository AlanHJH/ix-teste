export type CustomerSignals = {
  vendor: string;
  model: string;
  hwRevision: string;
  softwareVersion: string;
  planMbps: number;
  previousPlanMbps: number | null;
  olt: string;
  ponPort: string;
  memMinPct: number | null;
  rebootCount: number;
  lanMinMbps: number | null;
  opticalRxMinDbm: number | null;
  opticalLowDays: number;
  wifiSignalRaw: number | null;
  diagnosticRatio: number | null;
};

export type SupportDecision = {
  issue: string;
  confidence: "Alta" | "Média" | "Baixa";
  action: "escalar_noc" | "agendar_visita" | "resolver_telefone";
  actionLabel: string;
  sayToCustomer: string;
  operatorSteps: string[];
  reasons: string[];
  relatedProblemId: string | null;
  relatedProblemTitle: string | null;
  relatedProblemKind: "incident" | "signal" | null;
};

function observedReboots(count: number): string {
  return `${count} ${count === 1 ? "reinício observado" : "reinícios observados"} em 7 dias`;
}

export function decideSupport(signals: CustomerSignals): SupportDecision {
  if (signals.olt === "OLT-2" && ["1/7", "1/8"].includes(signals.ponPort)) {
    return {
      issue: "Instabilidade coletiva no trecho de fibra do Jardim Aurora",
      confidence: "Alta",
      action: "escalar_noc",
      actionLabel: "Escalar para o NOC — padrão coletivo detectado",
      sayToCustomer:
        "Identificamos sinais de uma instabilidade na rede que atende sua região. Vou encaminhar o caso ao NOC para confirmar o alcance; não é necessário reiniciar novamente nem agendar visita individual agora.",
      operatorSteps: [
        "Registrar o sinal coletivo em OLT-2 / CE-JA-03",
        "Não solicitar novo reboot",
        "Não agendar visita residencial neste momento",
      ],
      reasons: [
        "Cliente está nas portas PON 1/7 ou 1/8",
        "O grupo apresenta crescimento conjunto de FEC e chamados",
      ],
      relatedProblemId: "pon-olt2-ja",
      relatedProblemTitle: "Degradação coletiva na fibra — Jardim Aurora",
      relatedProblemKind: "signal",
    };
  }

  if (
    signals.vendor === "Kestrel" &&
    signals.softwareVersion === "2.4.1" &&
    ((signals.memMinPct ?? 100) < 10 || signals.rebootCount >= 2)
  ) {
    return {
      issue: "Instabilidade conhecida do firmware Kestrel 2.4.1",
      confidence: "Alta",
      action: "escalar_noc",
      actionLabel: "Escalar para rollback remoto pelo NOC",
      sayToCustomer:
        "Seu equipamento apresenta uma instabilidade de software já identificada. Vou encaminhar para uma correção remota; não é preciso marcar visita neste momento.",
      operatorSteps: [
        "Registrar como firmware Kestrel 2.4.1",
        "Escalar para fila de rollback",
        "Evitar reboot repetido: o alívio é apenas temporário",
      ],
      reasons: [
        `Memória mínima: ${signals.memMinPct?.toFixed(1) ?? "n/d"}%`,
        observedReboots(signals.rebootCount),
      ],
      relatedProblemId: "firmware-kestrel-241",
      relatedProblemTitle: "Instabilidade do firmware Kestrel 2.4.1",
      relatedProblemKind: "signal",
    };
  }

  if (
    signals.vendor === "Norvik" &&
    signals.hwRevision === "A" &&
    signals.planMbps > 100 &&
    signals.lanMinMbps === 100
  ) {
    return {
      issue: `Equipamento limita o plano de ${signals.planMbps} Mbps a 100 Mbps`,
      confidence: "Alta",
      action: "agendar_visita",
      actionLabel: "Agendar troca do equipamento",
      sayToCustomer:
        "O plano foi atualizado, mas identificamos que o equipamento instalado limita a velocidade. Vou agendar a troca; novos testes ou reinícios não corrigirão essa limitação.",
      operatorSteps: [
        "Agendar visita com motivo “troca por incompatibilidade de plano”",
        "Não escalar teste de velocidade ao NOC",
        "Marcar cliente na campanha corretiva Turbo 500",
      ],
      reasons: [
        "Norvik revisão A",
        `LAN negociada em ${signals.lanMinMbps} Mbps para plano de ${signals.planMbps} Mbps`,
      ],
      relatedProblemId: "capacity-norvik-a",
      relatedProblemTitle: "Turbo 500 limitado a 100 Mbps",
      relatedProblemKind: "signal",
    };
  }

  if ((signals.opticalRxMinDbm ?? 0) < -27 && signals.opticalLowDays >= 2) {
    return {
      issue: "Sinal óptico fora da especificação",
      confidence: "Alta",
      action: "agendar_visita",
      actionLabel: "Agendar visita técnica",
      sayToCustomer:
        "O sinal da fibra está abaixo da faixa esperada. Vou agendar uma visita para verificar o conector e o cabo até sua residência.",
      operatorSteps: [
        "Confirmar luz LOS",
        "Agendar visita com leitura óptica registrada",
        "Não repetir teste de Wi-Fi",
      ],
      reasons: [
        `Rx abaixo de -27 dBm em ${signals.opticalLowDays} dias`,
        `Mínimo observado: ${signals.opticalRxMinDbm?.toFixed(1)} dBm`,
      ],
      relatedProblemId: "optical-isolated",
      relatedProblemTitle: "Sinal óptico fora da especificação",
      relatedProblemKind: "signal",
    };
  }

  const weakWifi =
    signals.vendor === "Tuim"
      ? (signals.wifiSignalRaw ?? 100) < 35
      : (signals.wifiSignalRaw ?? 0) < -70;
  if (weakWifi && (signals.diagnosticRatio ?? 0) >= 0.85) {
    return {
      issue: "Cobertura Wi‑Fi dentro da residência",
      confidence: "Média",
      action: "resolver_telefone",
      actionLabel: "Resolver por telefone",
      sayToCustomer:
        "A conexão até o equipamento está entregando a velocidade esperada, mas o sinal Wi‑Fi dos dispositivos está fraco. Vamos ajustar a posição e testar a rede de 5 GHz.",
      operatorSteps: [
        "Orientar posicionamento aberto e central",
        "Testar próximo ao roteador em 5 GHz",
        "Registrar resultado antes de escalar",
      ],
      reasons: [
        "Diagnóstico remoto compatível com o plano",
        "Sinal médio dos dispositivos indica cobertura fraca",
      ],
      relatedProblemId: null,
      relatedProblemTitle: null,
      relatedProblemKind: null,
    };
  }

  return {
    issue: "Sem causa conclusiva nos sinais disponíveis",
    confidence: "Baixa",
    action: "escalar_noc",
    actionLabel: "Escalar para investigação do NOC",
    sayToCustomer:
      "Os sinais básicos não mostram uma causa conclusiva. Vou encaminhar o caso para uma verificação técnica mais detalhada.",
    operatorSteps: [
      "Confirmar cabos e LEDs com o cliente",
      "Registrar o sintoma sem sobrescrever a categoria",
      "Escalar com os dados anexados",
    ],
    reasons: ["Não há anomalia dominante nas últimas leituras"],
    relatedProblemId: null,
    relatedProblemTitle: null,
    relatedProblemKind: null,
  };
}
