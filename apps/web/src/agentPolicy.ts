import { useEffect, useState } from "react";

export type AgentPolicy = {
  capabilities: Record<string, boolean>;
  resources: Record<string, boolean>;
};

export const agentPolicyStorageKey = "ondaluz.agent.configuration.v1";
export const globalAssistantFeatureEnabled = true;

export const defaultAgentPolicy: AgentPolicy = {
  capabilities: {
    detect_grouping_candidates: true,
    propose_grouping: true,
    generate_n1_guidance: true,
    global_assistant: true,
    execute_remote_actions: false,
  },
  resources: {
    customers: true,
    inventory: true,
    telemetry: true,
    diagnostics: true,
    tickets: true,
    operations: true,
    application: true,
  },
};

function booleanMap(
  value: unknown,
  defaults: Record<string, boolean>,
): Record<string, boolean> {
  if (!value || typeof value !== "object") return { ...defaults };
  const candidate = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(defaults).map(([key, defaultValue]) => [
      key,
      typeof candidate[key] === "boolean" ? candidate[key] : defaultValue,
    ]),
  );
}

export function loadAgentPolicy(): AgentPolicy {
  if (typeof window === "undefined") return defaultAgentPolicy;
  try {
    const stored = window.localStorage.getItem(agentPolicyStorageKey);
    if (!stored) return defaultAgentPolicy;
    const parsed = JSON.parse(stored) as Partial<AgentPolicy>;
    return {
      capabilities: booleanMap(
        parsed.capabilities,
        defaultAgentPolicy.capabilities,
      ),
      resources: booleanMap(parsed.resources, defaultAgentPolicy.resources),
    };
  } catch {
    return defaultAgentPolicy;
  }
}

export function saveAgentPolicy(policy: AgentPolicy): void {
  window.localStorage.setItem(agentPolicyStorageKey, JSON.stringify(policy));
  window.dispatchEvent(new Event("ondaluz-agent-config-change"));
}

export function resetAgentPolicy(): void {
  window.localStorage.removeItem(agentPolicyStorageKey);
  window.dispatchEvent(new Event("ondaluz-agent-config-change"));
}

export function useAgentPolicy(): AgentPolicy {
  const [policy, setPolicy] = useState<AgentPolicy>(() => loadAgentPolicy());

  useEffect(() => {
    const refresh = () => setPolicy(loadAgentPolicy());
    window.addEventListener("storage", refresh);
    window.addEventListener("ondaluz-agent-config-change", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("ondaluz-agent-config-change", refresh);
    };
  }, []);

  return policy;
}

export function n1GuidanceEnabled(policy: AgentPolicy): boolean {
  return (
    policy.capabilities.generate_n1_guidance === true &&
    Object.values(policy.resources).every(Boolean)
  );
}

export function groupingAgentEnabled(policy: AgentPolicy): boolean {
  return (
    policy.capabilities.detect_grouping_candidates === true &&
    policy.capabilities.propose_grouping === true &&
    Object.values(policy.resources).every(Boolean)
  );
}

export function globalAssistantEnabled(policy: AgentPolicy): boolean {
  return (
    globalAssistantFeatureEnabled &&
    policy.capabilities.global_assistant === true &&
    Object.values(policy.resources).every(Boolean)
  );
}
