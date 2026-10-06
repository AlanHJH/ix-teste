import { useEffect, useMemo, useState } from "react";
import { Boxes, Database, GitBranch, Network, Waypoints } from "lucide-react";
import { PhysicalTopology } from "./PhysicalTopology";
import { TechnicalText } from "./ProviderGlossary";

type Scope = "all" | "network" | "data";
type Category = "network" | "domain" | "signal" | "derived" | "interface";

type MapNode = {
  id: string;
  name: string;
  type: string;
  category: Category;
  scopes: Scope[];
  x: number;
  y: number;
  compact: [number, number];
  description: string;
  relations: string;
};

type MapEdge = {
  from: string;
  to: string;
  kind: "flow" | "join";
  curve?: number;
};

const categoryLabel: Record<Category, string> = {
  network: "Rede física",
  domain: "Cliente e produto",
  signal: "Sinais persistidos",
  derived: "Derivação e regra",
  interface: "Consumo operacional",
};

const nodes: MapNode[] = [
  {
    id: "olt",
    name: "OLT",
    type: "Dimensão topológica",
    category: "network",
    scopes: ["all", "network"],
    x: 8,
    y: 9,
    compact: [25, 5],
    description:
      "Origem da rede PON. No protótipo é um campo do inventário, não uma tabela isolada.",
    relations:
      "Contém portas PON e é usada para delimitar o alcance de uma falha coletiva.",
  },
  {
    id: "pon",
    name: "Porta PON",
    type: "Dimensão topológica",
    category: "network",
    scopes: ["all", "network"],
    x: 28,
    y: 9,
    compact: [75, 5],
    description:
      "Segmento compartilhado por várias CPEs; é a dimensão principal do incidente de fibra em OLT-2.",
    relations:
      "Pertence à OLT, alimenta CTOs e agrupa CPEs com FEC e quedas comuns.",
  },
  {
    id: "cto",
    name: "CTO",
    type: "Dimensão topológica",
    category: "network",
    scopes: ["all", "network"],
    x: 48,
    y: 9,
    compact: [25, 15],
    description:
      "Ponto de distribuição que aproxima a rede do cliente. Também é um atributo do inventário.",
    relations: "É alimentada por uma PON e atende uma ou mais CPEs.",
  },
  {
    id: "cpe",
    name: "CPE / inventory",
    type: "Tabela · PK serial",
    category: "network",
    scopes: ["all", "network", "data"],
    x: 68,
    y: 9,
    compact: [75, 15],
    description:
      "Pivô relacional do protótipo: uma linha por serial reúne cliente, equipamento, plano, topologia, localização e estado.",
    relations:
      "Une Inform e diagnóstico por serial; conecta cliente e chamados por customer_id; enriquece a métrica diária.",
  },
  {
    id: "customer",
    name: "Cliente",
    type: "Entidade conceitual",
    category: "domain",
    scopes: ["all", "network", "data"],
    x: 88,
    y: 9,
    compact: [25, 25],
    description:
      "Não há tabela customer: customer_id está em inventory e tickets; o N1 busca o equipamento ativo mais recente.",
    relations:
      "Possui CPE, plano e chamados; é a chave de entrada da jornada N1.",
  },
  {
    id: "location",
    name: "Cidade / bairro",
    type: "Atributo embutido",
    category: "domain",
    scopes: ["all", "network"],
    x: 25,
    y: 30,
    compact: [75, 25],
    description:
      "Contexto geográfico armazenado no inventário e repetido na visão materializada diária.",
    relations: "Localiza a CPE e ajuda a reconhecer concentração espacial.",
  },
  {
    id: "hardware",
    name: "Hardware / firmware",
    type: "Atributo embutido",
    category: "domain",
    scopes: ["all", "network", "data"],
    x: 53,
    y: 30,
    compact: [25, 35],
    description:
      "Fabricante, modelo, revisão e versão de software caracterizam a CPE; não são tabelas normalizadas no protótipo.",
    relations:
      "Explica a regressão Kestrel 2.4.1 e o limite do Norvik NV-G1 revisão A.",
  },
  {
    id: "plan",
    name: "Plano contratado",
    type: "Atributo embutido",
    category: "domain",
    scopes: ["all", "network", "data"],
    x: 82,
    y: 30,
    compact: [75, 35],
    description:
      "Plano atual, plano anterior e data da mudança ficam no inventário.",
    relations:
      "Liga o cliente à capacidade esperada e identifica upgrades acima do limite da porta LAN.",
  },
  {
    id: "inform",
    name: "Inform TR-069",
    type: "Tabela UNLOGGED",
    category: "signal",
    scopes: ["all", "data"],
    x: 18,
    y: 51,
    compact: [25, 46],
    description:
      "Telemetria bruta por serial e timestamp: memória, boots, óptica, FEC, tráfego, LAN e Wi-Fi.",
    relations:
      "Muitos eventos pertencem a uma CPE; com o inventory, produzem a métrica diária.",
  },
  {
    id: "diagnostic",
    name: "Diagnóstico TR-143",
    type: "Tabela diagnostics",
    category: "signal",
    scopes: ["all", "data"],
    x: 40,
    y: 51,
    compact: [75, 46],
    description:
      "Teste solicitado para uma CPE, com estado, download, upload e servidor.",
    relations:
      "Usa serial e complementa a decisão N1, mas não elimina gargalos depois da CPE.",
  },
  {
    id: "ticket",
    name: "Chamado",
    type: "Tabela tickets",
    category: "signal",
    scopes: ["all", "data"],
    x: 82,
    y: 51,
    compact: [25, 56],
    description:
      "Histórico de atendimento por customer_id, categoria, descrição, resolução e datas.",
    relations:
      "Muitos chamados pertencem a um cliente e ajudam a medir tendência, recorrência e custo.",
  },
  {
    id: "metrics",
    name: "Métrica diária",
    type: "Visão materializada",
    category: "derived",
    scopes: ["all", "data"],
    x: 30,
    y: 73,
    compact: [75, 56],
    description:
      "Agregado por dia, serial e firmware. Resume memória, boots, LAN, FEC, óptica e Wi-Fi após normalização.",
    relations:
      "Deriva de Inform + inventory e alimenta regras por CPE, firmware, PON e localização.",
  },
  {
    id: "rules",
    name: "Regras explicáveis",
    type: "Código de decisão",
    category: "derived",
    scopes: ["all", "data"],
    x: 55,
    y: 73,
    compact: [25, 68],
    description:
      "Consultas e precedências determinísticas cruzam métricas, inventário, diagnóstico e chamados.",
    relations:
      "Detectam fibra compartilhada, firmware instável, incompatibilidade de capacidade e óptica isolada.",
  },
  {
    id: "incident",
    name: "Incidente",
    type: "DTO calculado",
    category: "derived",
    scopes: ["all", "data"],
    x: 76,
    y: 73,
    compact: [75, 68],
    description:
      "Grupo operacional calculado em tempo de consulta; ele não é persistido como tabela no protótipo.",
    relations:
      "Consolida alcance, severidade, confiança, evidências, custo, responsável e próxima ação.",
  },
  {
    id: "noc",
    name: "Visão NOC",
    type: "Interface React",
    category: "interface",
    scopes: ["all", "data"],
    x: 65,
    y: 92,
    compact: [25, 80],
    description:
      "Fila priorizada de incidentes coletivos e individuais para atuação operacional.",
    relations:
      "Consome incidentes agregados e orienta rede externa, fornecedor, campo ou comercial.",
  },
  {
    id: "n1",
    name: "Jornada N1",
    type: "Interface React",
    category: "interface",
    scopes: ["all", "data"],
    x: 87,
    y: 92,
    compact: [75, 80],
    description:
      "Resposta por cliente com causa provável, evidência, fala sugerida e encaminhamento.",
    relations:
      "Consulta o perfil do cliente e aplica as precedências das regras explicáveis.",
  },
];

const edges: MapEdge[] = [
  { from: "olt", to: "pon", kind: "flow" },
  { from: "pon", to: "cto", kind: "flow" },
  { from: "cto", to: "cpe", kind: "flow" },
  { from: "customer", to: "cpe", kind: "join", curve: -2 },
  { from: "location", to: "cpe", kind: "join", curve: 2 },
  { from: "hardware", to: "cpe", kind: "join", curve: -1 },
  { from: "customer", to: "plan", kind: "join" },
  { from: "cpe", to: "inform", kind: "join", curve: 2 },
  { from: "cpe", to: "diagnostic", kind: "join", curve: 1 },
  { from: "customer", to: "ticket", kind: "join", curve: 2 },
  { from: "inform", to: "metrics", kind: "flow" },
  { from: "cpe", to: "metrics", kind: "join", curve: 3 },
  { from: "metrics", to: "rules", kind: "flow" },
  { from: "diagnostic", to: "rules", kind: "flow" },
  { from: "ticket", to: "rules", kind: "flow", curve: -2 },
  { from: "rules", to: "incident", kind: "flow" },
  { from: "incident", to: "noc", kind: "flow" },
  { from: "rules", to: "n1", kind: "flow", curve: 2 },
  { from: "customer", to: "n1", kind: "join", curve: -4 },
];

const nodeById = new Map(nodes.map((node) => [node.id, node]));

function coordinates(
  node: Pick<MapNode, "x" | "y" | "compact">,
  compact: boolean,
) {
  return compact ? node.compact : [node.x, node.y];
}

function edgePath(edge: MapEdge, compact: boolean) {
  const from = nodeById.get(edge.from)!;
  const to = nodeById.get(edge.to)!;
  const [fromX, fromY] = coordinates(from, compact);
  const [toX, toY] = coordinates(to, compact);
  const curve = edge.curve ?? 0;
  const mx = (fromX + toX) / 2;
  const my = (fromY + toY) / 2;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const controlX = mx - (dy / distance) * curve;
  const controlY = my + (dx / distance) * curve;
  return `M ${fromX * 10} ${fromY * 6.4} Q ${controlX * 10} ${controlY * 6.4} ${toX * 10} ${toY * 6.4}`;
}

type HardwareNode = Omit<MapNode, "scopes">;

const hardwareNodes: HardwareNode[] = [
  {
    id: "hardware-inventory",
    name: "CPE / inventory",
    type: "Tabela · PK serial",
    category: "network",
    x: 10,
    y: 11,
    compact: [25, 5],
    description:
      "Registro que liga uma CPE física ao cliente, fabricante, modelo, revisão, firmware e plano contratado.",
    relations: "É a origem do contexto de hardware e une os sinais por serial.",
  },
  {
    id: "physical-hardware",
    name: "Hardware físico",
    type: "vendor · model · revisão",
    category: "domain",
    x: 32,
    y: 11,
    compact: [75, 5],
    description:
      "Fabricante, modelo e revisão definem a capacidade física da CPE. No protótipo, são atributos do inventory.",
    relations:
      "Explica por que o Norvik NV-G1 revisão A não pode entregar um plano acima de 100 Mbps pela LAN.",
  },
  {
    id: "firmware-version",
    name: "Firmware",
    type: "software_version",
    category: "domain",
    x: 55,
    y: 11,
    compact: [25, 18],
    description:
      "Versão instalada na CPE. Ela integra o grão da métrica diária porque uma CPE pode mudar de firmware no mesmo dia.",
    relations:
      "Kestrel 2.4.1 é confrontado com memória e boots antes de uma ação de rollback.",
  },
  {
    id: "lan-port",
    name: "Porta LAN1",
    type: "lan_min_mbps",
    category: "signal",
    x: 79,
    y: 11,
    compact: [75, 18],
    description:
      "Negociação mínima da porta LAN observada nos Informs. É a evidência física de entrega limitada dentro da residência.",
    relations:
      "No Norvik NV-G1 revisão A, a negociação em 100 Mbps conflita objetivamente com o Turbo 500.",
  },
  {
    id: "hardware-inform",
    name: "Inform TR-069",
    type: "Tabela UNLOGGED",
    category: "signal",
    x: 15,
    y: 42,
    compact: [25, 32],
    description:
      "Telemetria bruta por serial: memória livre, eventos de boot, bit rate LAN e a versão de software reportada.",
    relations:
      "Alimenta o agregado diário e permite observar regressões de firmware sem depender de um chamado isolado.",
  },
  {
    id: "hardware-metrics",
    name: "Métrica diária",
    type: "Visão materializada",
    category: "derived",
    x: 36,
    y: 42,
    compact: [75, 32],
    description:
      "Resumo por dia, serial e firmware com memória mínima, boots e menor negociação LAN.",
    relations:
      "Transforma muitos Informs em sinais comparáveis por versão e por grupo de equipamento.",
  },
  {
    id: "plan-upgrade",
    name: "Plano / upgrade",
    type: "plan_mbps · previous_plan_mbps",
    category: "domain",
    x: 60,
    y: 42,
    compact: [25, 47],
    description:
      "Plano atual, plano anterior e data de mudança definem a capacidade prometida e a exposição após uma campanha comercial.",
    relations:
      "É comparado à LAN negociada para impedir upgrades incompatíveis.",
  },
  {
    id: "hardware-diagnostic",
    name: "Diagnóstico TR-143",
    type: "Tabela diagnostics",
    category: "signal",
    x: 85,
    y: 42,
    compact: [75, 47],
    description:
      "Mede download e upload entre a CPE e um servidor ACS, com a razão calculada sobre o plano.",
    relations:
      "Complementa a leitura, mas não prova a capacidade da porta LAN ou do dispositivo do cliente.",
  },
  {
    id: "firmware-rule",
    name: "Regra de firmware",
    type: "memória + boots",
    category: "derived",
    x: 42,
    y: 70,
    compact: [25, 62],
    description:
      "Identifica Kestrel 2.4.1 com memória mínima abaixo de 10% ou múltiplos boots e compara com a versão de controle.",
    relations:
      "Produz o incidente de firmware e orienta congelamento do rollout com rollback canário.",
  },
  {
    id: "capacity-rule",
    name: "Regra de capacidade",
    type: "LAN × plano × revisão",
    category: "derived",
    x: 70,
    y: 70,
    compact: [75, 62],
    description:
      "Cruza Norvik NV-G1 revisão A, upgrade e plano acima de 100 Mbps com a negociação da porta LAN.",
    relations:
      "No recorte, identifica 377 clientes em Turbo 500 incompatível; não trata isso como hipótese de Wi-Fi.",
  },
  {
    id: "firmware-action",
    name: "Rollback canário",
    type: "Ação · NOC + fornecedor",
    category: "interface",
    x: 30,
    y: 92,
    compact: [25, 78],
    description:
      "Congela o rollout Kestrel 2.4.1 e valida o retorno para 2.3.8 com memória e boots por 72 horas.",
    relations:
      "Só amplia a correção depois de confirmar melhora no grupo canário.",
  },
  {
    id: "capacity-action",
    name: "Bloqueio e troca",
    type: "Ação · comercial + campo",
    category: "interface",
    x: 78,
    y: 92,
    compact: [75, 78],
    description:
      "Bloqueia novos Turbo 500 nesse hardware, avisa os afetados e prioriza a troca de equipamento por risco.",
    relations:
      "Evita novas combinações incompatíveis e separa o gargalo físico de uma reclamação genérica de lentidão.",
  },
];

const hardwareEdges: MapEdge[] = [
  { from: "hardware-inventory", to: "physical-hardware", kind: "join" },
  { from: "hardware-inventory", to: "firmware-version", kind: "join" },
  { from: "physical-hardware", to: "lan-port", kind: "flow" },
  { from: "hardware-inventory", to: "hardware-inform", kind: "join", curve: 2 },
  { from: "hardware-inform", to: "hardware-metrics", kind: "flow" },
  { from: "firmware-version", to: "hardware-metrics", kind: "join", curve: -2 },
  { from: "hardware-inventory", to: "plan-upgrade", kind: "join", curve: 2 },
  { from: "plan-upgrade", to: "hardware-diagnostic", kind: "join" },
  { from: "hardware-metrics", to: "firmware-rule", kind: "flow" },
  { from: "firmware-version", to: "firmware-rule", kind: "flow", curve: 2 },
  { from: "lan-port", to: "capacity-rule", kind: "flow", curve: -2 },
  { from: "plan-upgrade", to: "capacity-rule", kind: "flow" },
  { from: "hardware-diagnostic", to: "capacity-rule", kind: "join", curve: 2 },
  { from: "firmware-rule", to: "firmware-action", kind: "flow" },
  { from: "capacity-rule", to: "capacity-action", kind: "flow" },
];

const hardwareNodeById = new Map(hardwareNodes.map((node) => [node.id, node]));

function hardwareEdgePath(edge: MapEdge, compact: boolean) {
  const from = hardwareNodeById.get(edge.from)!;
  const to = hardwareNodeById.get(edge.to)!;
  const [fromX, fromY] = coordinates(from, compact);
  const [toX, toY] = coordinates(to, compact);
  const curve = edge.curve ?? 0;
  const mx = (fromX + toX) / 2;
  const my = (fromY + toY) / 2;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.max(Math.hypot(dx, dy), 1);
  const controlX = mx - (dy / distance) * curve;
  const controlY = my + (dx / distance) * curve;
  return `M ${fromX * 10} ${fromY * 6.4} Q ${controlX * 10} ${controlY * 6.4} ${toX * 10} ${toY * 6.4}`;
}

function HardwareTopology() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 700);
  const selectedNode = selectedId ? hardwareNodeById.get(selectedId) : null;
  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(
      hardwareEdges.flatMap((edge) => {
        if (edge.from === selectedId) return [edge.to];
        if (edge.to === selectedId) return [edge.from];
        return [];
      }),
    );
  }, [selectedId]);

  useEffect(() => {
    const updateCompactMode = () => setCompact(window.innerWidth <= 700);
    window.addEventListener("resize", updateCompactMode);
    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  return (
    <section className="topology-panel hardware-panel">
      <div className="hardware-heading">
        <div>
          <span className="section-label">Foco em equipamento</span>
          <h2>Mapa topográfico do hardware e da capacidade entregue</h2>
        </div>
        <span>
          <TechnicalText text="Firmware, revisão, LAN e plano na mesma cadeia de decisão" />
        </span>
      </div>
      <div className="topology-legend hardware-legend" aria-label="Legenda">
        <span>
          <i className="domain" />
          Hardware e contrato
        </span>
        <span>
          <i className="signal" />
          Telemetria e diagnóstico
        </span>
        <span>
          <i className="derived" />
          Regra de decisão
        </span>
        <span>
          <i className="interface" />
          Ação operacional
        </span>
        <span>
          <b />
          Atributo ou join
        </span>
      </div>
      <div
        className="topology-map hardware-map"
        aria-label="Grafo do hardware, firmware e capacidade"
      >
        <svg
          className="topology-edges"
          viewBox="0 0 1000 640"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <marker
              id="hardware-arrow"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,4 L0,8 Z" />
            </marker>
          </defs>
          {hardwareEdges.map((edge) => {
            const connected =
              selectedId === edge.from || selectedId === edge.to;
            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={hardwareEdgePath(edge, compact)}
                markerEnd="url(#hardware-arrow)"
                className={`topology-edge ${edge.kind} ${connected ? "connected" : ""}`}
              />
            );
          })}
        </svg>
        {hardwareNodes.map((node) => {
          const related =
            !selectedId || selectedId === node.id || relatedIds.has(node.id);
          const [x, y] = coordinates(node, compact);
          return (
            <button
              key={node.id}
              type="button"
              className={`topology-node ${node.category} hardware-node ${y > 70 ? "tooltip-above" : ""} ${selectedId === node.id ? "selected" : ""} ${related ? "related" : ""}`}
              style={{ left: `${x}%`, top: `${y}%` }}
              aria-pressed={selectedId === node.id}
              aria-label={`${node.name}. ${node.type}. ${node.description}`}
              onClick={() =>
                setSelectedId(node.id === selectedId ? null : node.id)
              }
            >
              <span>{node.type}</span>
              <strong>{node.name}</strong>
              <span className="topology-node-tooltip" role="tooltip">
                {node.description}
              </span>
            </button>
          );
        })}
      </div>
      <aside className="topology-detail" aria-live="polite">
        {selectedNode ? (
          <>
            <div className="topology-detail-icon">
              {selectedNode.category === "signal" ? (
                <Database size={21} />
              ) : selectedNode.category === "derived" ? (
                <Waypoints size={21} />
              ) : (
                <Boxes size={21} />
              )}
            </div>
            <div>
              <span>
                {categoryLabel[selectedNode.category]} · {selectedNode.type}
              </span>
              <h2>{selectedNode.name}</h2>
            </div>
            <p>
              <TechnicalText text={selectedNode.description} />
            </p>
            <p className="topology-relation">
              <strong>Relações:</strong>{" "}
              <TechnicalText text={selectedNode.relations} />
            </p>
          </>
        ) : (
          <>
            <div className="topology-detail-icon">
              <Boxes size={21} />
            </div>
            <div>
              <span>Leitura do hardware</span>
              <h2>Do componente à ação</h2>
            </div>
            <p>
              <TechnicalText text="O mapa separa uma regressão de firmware de uma limitação física de capacidade." />{" "}
              Selecione qualquer nó para destacar a cadeia específica.
            </p>
            <p className="topology-relation">
              <strong>Casos demonstrados:</strong>{" "}
              <TechnicalText text="Kestrel 2.4.1 orienta rollback canário; Norvik NV-G1 revisão A em Turbo 500 orienta bloqueio e troca." />
            </p>
          </>
        )}
      </aside>
    </section>
  );
}

export function TopologyMap() {
  const [mapMode, setMapMode] = useState<
    "relations" | "hardware" | "infrastructure"
  >("relations");
  const [scope, setScope] = useState<Scope>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 700);
  const selectedNode = selectedId ? nodeById.get(selectedId) : null;
  const relatedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    return new Set(
      edges.flatMap((edge) => {
        if (edge.from === selectedId) return [edge.to];
        if (edge.to === selectedId) return [edge.from];
        return [];
      }),
    );
  }, [selectedId]);

  useEffect(() => {
    const updateCompactMode = () => setCompact(window.innerWidth <= 700);
    window.addEventListener("resize", updateCompactMode);
    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  function isInScope(node: MapNode) {
    return scope === "all" || node.scopes.includes(scope);
  }

  function selectScope(nextScope: Scope) {
    setScope(nextScope);
    if (
      selectedNode &&
      !(nextScope === "all" || selectedNode.scopes.includes(nextScope))
    ) {
      setSelectedId(null);
    }
  }

  return (
    <section className="topology-page">
      <section className="topology-hero">
        <div>
          <span className="section-label">Mapa de relacionamento</span>
          <h1>Do sinal da rede à decisão operacional.</h1>
          <p>
            <TechnicalText text="A topologia evidencia como o inventário conecta cliente, rede física, telemetria e as telas usadas pelo NOC e pelo atendimento N1." />
          </p>
        </div>
        <div className="topology-hero-mark" aria-hidden="true">
          <GitBranch size={28} />
          <span>Relações auditáveis</span>
        </div>
      </section>

      <div
        className="topology-view-switch"
        role="tablist"
        aria-label="Mapa exibido"
      >
        <button
          role="tab"
          aria-selected={mapMode === "relations"}
          className={mapMode === "relations" ? "active" : ""}
          onClick={() => setMapMode("relations")}
          title="Mostra como rede, clientes, telemetria e decisões operacionais se relacionam."
        >
          Mapa de entidades
        </button>
        <button
          role="tab"
          aria-selected={mapMode === "hardware"}
          className={mapMode === "hardware" ? "active" : ""}
          onClick={() => setMapMode("hardware")}
          title="Mostra o caminho entre hardware, firmware, capacidade e ações operacionais."
        >
          Hardware e capacidade
        </button>
        <button
          role="tab"
          aria-selected={mapMode === "infrastructure"}
          className={mapMode === "infrastructure" ? "active" : ""}
          onClick={() => setMapMode("infrastructure")}
          title="Mostra a conexão física entre OLT, PON, CTO e CPE."
        >
          Infraestrutura física
        </button>
      </div>

      {mapMode === "relations" ? (
        <section className="topology-panel">
          <div className="topology-toolbar">
            <div
              className="topology-tabs"
              role="tablist"
              aria-label="Camada do mapa"
            >
              {[
                ["all", "Visão completa"],
                ["network", "Topologia de rede"],
                ["data", "Dados e decisão"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={scope === id}
                  className={scope === id ? "active" : ""}
                  onClick={() => selectScope(id as Scope)}
                  title={
                    id === "all"
                      ? "Exibe todas as entidades e relações."
                      : id === "network"
                        ? "Destaca a infraestrutura óptica e seus equipamentos."
                        : "Destaca dados, métricas e regras de decisão."
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="topology-legend" aria-label="Legenda">
              <span>
                <i className="network" />
                Rede física
              </span>
              <span>
                <i className="domain" />
                Cliente e produto
              </span>
              <span>
                <i className="signal" />
                Sinais persistidos
              </span>
              <span>
                <i className="derived" />
                Derivação e regra
              </span>
              <span>
                <i className="interface" />
                Consumo operacional
              </span>
              <span>
                <b />
                Join ou atributo embutido
              </span>
            </div>
          </div>

          <div
            className="topology-map"
            aria-label="Grafo das entidades do sistema Ondaluz"
          >
            <svg
              className="topology-edges"
              viewBox="0 0 1000 640"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="topology-arrow"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L8,4 L0,8 Z" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const visible =
                  isInScope(nodeById.get(edge.from)!) &&
                  isInScope(nodeById.get(edge.to)!);
                const connected =
                  selectedId === edge.from || selectedId === edge.to;
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={edgePath(edge, compact)}
                    markerEnd="url(#topology-arrow)"
                    className={`topology-edge ${edge.kind} ${!visible ? "muted" : ""} ${connected ? "connected" : ""}`}
                  />
                );
              })}
            </svg>
            {nodes.map((node) => {
              const inScope = isInScope(node);
              const related =
                !selectedId ||
                selectedId === node.id ||
                relatedIds.has(node.id);
              const [x, y] = coordinates(node, compact);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`topology-node ${node.category} ${y > 70 ? "tooltip-above" : ""} ${!inScope ? "muted" : ""} ${selectedId === node.id ? "selected" : ""} ${related ? "related" : ""}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                  aria-pressed={selectedId === node.id}
                  aria-label={`${node.name}. ${node.type}. ${node.description}`}
                  onClick={() =>
                    setSelectedId(node.id === selectedId ? null : node.id)
                  }
                >
                  <span>{node.type}</span>
                  <strong>{node.name}</strong>
                  <span className="topology-node-tooltip" role="tooltip">
                    {node.description}
                  </span>
                </button>
              );
            })}
          </div>

          <aside className="topology-detail" aria-live="polite">
            {selectedNode ? (
              <>
                <div className="topology-detail-icon">
                  {selectedNode.category === "network" ? (
                    <Network size={21} />
                  ) : selectedNode.category === "signal" ? (
                    <Database size={21} />
                  ) : selectedNode.category === "derived" ? (
                    <Waypoints size={21} />
                  ) : (
                    <Boxes size={21} />
                  )}
                </div>
                <div>
                  <span>
                    {categoryLabel[selectedNode.category]} · {selectedNode.type}
                  </span>
                  <h2>{selectedNode.name}</h2>
                </div>
                <p>
                  <TechnicalText text={selectedNode.description} />
                </p>
                <p className="topology-relation">
                  <strong>Relações:</strong>{" "}
                  <TechnicalText text={selectedNode.relations} />
                </p>
              </>
            ) : (
              <>
                <div className="topology-detail-icon">
                  <GitBranch size={21} />
                </div>
                <div>
                  <span>Leitura do mapa</span>
                  <h2>Selecione uma entidade</h2>
                </div>
                <p>
                  As setas mostram a passagem entre as camadas. Linhas
                  tracejadas representam joins por chave ou atributos que
                  permanecem embutidos no inventory.
                </p>
                <p className="topology-relation">
                  <strong>Ponto de partida:</strong> o{" "}
                  <code>
                    <TechnicalText text="CPE / inventory" />
                  </code>{" "}
                  é o pivô que liga <TechnicalText text="topologia" />, cliente
                  e sinais.
                </p>
              </>
            )}
          </aside>
        </section>
      ) : mapMode === "hardware" ? (
        <HardwareTopology />
      ) : (
        <PhysicalTopology />
      )}
    </section>
  );
}
