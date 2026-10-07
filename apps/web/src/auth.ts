export type UserRole = "admin" | "n1" | "noc";

export type AppView =
  | "dashboard"
  | "noc"
  | "support"
  | "tickets"
  | "diagnostics"
  | "topology"
  | "inventory"
  | "agent-config";

export type DemoUser = {
  id: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  description: string;
  initials: string;
};

export const demoUsers: DemoUser[] = [
  {
    id: "admin-marina",
    name: "Marina Costa",
    role: "admin",
    roleLabel: "Administradora",
    description: "Acesso completo à operação, atendimento e configurações.",
    initials: "MC",
  },
  {
    id: "n1-lucas",
    name: "Lucas Ferreira",
    role: "n1",
    roleLabel: "Atendimento N1",
    description: "Consulta clientes, conduz atendimentos e registra chamados.",
    initials: "LF",
  },
  {
    id: "noc-renata",
    name: "Renata Alves",
    role: "noc",
    roleLabel: "Analista NOC",
    description: "Monitora a rede, revisa alertas e coordena incidentes.",
    initials: "RA",
  },
];

const viewsByRole: Record<UserRole, readonly AppView[]> = {
  admin: [
    "dashboard",
    "noc",
    "support",
    "agent-config",
    "tickets",
    "diagnostics",
    "topology",
    "inventory",
  ],
  n1: ["support", "tickets", "diagnostics", "inventory"],
  noc: ["dashboard", "noc", "tickets", "diagnostics", "topology", "inventory"],
};

const defaultViewByRole: Record<UserRole, AppView> = {
  admin: "dashboard",
  n1: "support",
  noc: "noc",
};

export const AUTH_SESSION_KEY = "ondaluz.demo-user";

export function canAccessView(role: UserRole, view: AppView) {
  return viewsByRole[role].includes(view);
}

export function defaultViewFor(role: UserRole) {
  return defaultViewByRole[role];
}

export function parseSession(value: string | null): DemoUser | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { id?: unknown };
    return demoUsers.find((user) => user.id === parsed.id) ?? null;
  } catch {
    return null;
  }
}

export function loadSession() {
  try {
    return parseSession(window.localStorage.getItem(AUTH_SESSION_KEY));
  } catch {
    return null;
  }
}

export function saveSession(user: DemoUser) {
  try {
    window.localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: user.id }),
    );
  } catch {
    // A sessão continua válida em memória se o armazenamento estiver indisponível.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(AUTH_SESSION_KEY);
  } catch {
    // Nada a limpar quando o armazenamento estiver indisponível.
  }
}
