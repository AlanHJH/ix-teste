export type UserRole = "admin" | "n1" | "noc";

export type AppView =
  | "dashboard"
  | "noc"
  | "support"
  | "offline-diagnosis"
  | "tickets"
  | "diagnostics"
  | "topology"
  | "inventory"
  | "customers"
  | "agent-config";

export type DemoUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  roleLabel: string;
  description: string;
  initials: string;
};

export const demoUsers: DemoUser[] = [
  {
    id: "admin-marina",
    username: "marina",
    name: "Marina Costa",
    role: "admin",
    roleLabel: "Administradora",
    description: "Acesso completo à operação, atendimento e configurações.",
    initials: "MC",
  },
  {
    id: "n1-lucas",
    username: "lucas",
    name: "Lucas Ferreira",
    role: "n1",
    roleLabel: "Atendimento N1",
    description: "Consulta clientes, conduz atendimentos e registra chamados.",
    initials: "LF",
  },
  {
    id: "noc-renata",
    username: "renata",
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
    "offline-diagnosis",
    "agent-config",
    "tickets",
    "diagnostics",
    "topology",
    "inventory",
    "customers",
  ],
  n1: [
    "support",
    "offline-diagnosis",
    "tickets",
    "diagnostics",
    "inventory",
    "customers",
  ],
  noc: [
    "dashboard",
    "noc",
    "offline-diagnosis",
    "tickets",
    "diagnostics",
    "topology",
    "inventory",
    "customers",
  ],
};

const defaultViewByRole: Record<UserRole, AppView> = {
  admin: "dashboard",
  n1: "support",
  noc: "noc",
};

export const AUTH_SESSION_KEY = "ondaluz.demo-user";

export type AuthSession = {
  user: DemoUser;
  accessToken: string;
};

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

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: unknown; accessToken?: unknown };
    const user = demoUsers.find((candidate) => candidate.id === parsed.id);
    if (
      !user ||
      typeof parsed.accessToken !== "string" ||
      !parsed.accessToken
    ) {
      return null;
    }
    return { user, accessToken: parsed.accessToken };
  } catch {
    return null;
  }
}

export function loadAccessToken() {
  return loadAuthSession()?.accessToken ?? null;
}

export function saveSession(user: DemoUser, accessToken = "") {
  try {
    window.localStorage.setItem(
      AUTH_SESSION_KEY,
      JSON.stringify({ id: user.id, accessToken }),
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
