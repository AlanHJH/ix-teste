export type UserRole = "admin" | "n1" | "noc";

export type AuthenticatedUser = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  roleLabel: string;
};

export type AuthTokenPayload = AuthenticatedUser & {
  sub: string;
  iat: number;
  exp: number;
  iss: string;
};
