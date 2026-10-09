import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import type { AuthenticatedUser, AuthTokenPayload } from "./auth.types";

const TOKEN_ISSUER = "ondaluz-ops";
const TOKEN_TTL_SECONDS = 8 * 60 * 60;
const DEV_SECRET = "ondaluz-local-jwt-secret-change-in-production";

type UserRecord = AuthenticatedUser & {
  passwordSalt: string;
  passwordHash: string;
};

const users: readonly UserRecord[] = [
  {
    id: "admin-marina",
    username: "marina",
    name: "Marina Costa",
    role: "admin",
    roleLabel: "Administradora",
    passwordSalt: "ondaluz-admin",
    passwordHash:
      "8eec84520870aa13e1d0acc6e72dbc33152f2a6cdb0d5ecb7975a8b566b7c8ee",
  },
  {
    id: "n1-lucas",
    username: "lucas",
    name: "Lucas Ferreira",
    role: "n1",
    roleLabel: "Atendimento N1",
    passwordSalt: "ondaluz-n1",
    passwordHash:
      "50b43fad898dfabe0bd9066238cc7299a67108b7cb048cc714fc27ab2a498fdf",
  },
  {
    id: "noc-renata",
    username: "renata",
    name: "Renata Alves",
    role: "noc",
    roleLabel: "Analista NOC",
    passwordSalt: "ondaluz-noc",
    passwordHash:
      "9cf69ddd973f5c8ccc89e7402094400070d1e704f3110c3cd94bdbc159963a42",
  },
];

function encodeBase64Url(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(
    normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    ),
    "base64",
  );
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET ?? DEV_SECRET;

  login(username: string, password: string) {
    const normalizedUsername = username.trim().toLocaleLowerCase("pt-BR");
    const user = users.find(
      (candidate) =>
        candidate.username === normalizedUsername ||
        candidate.id === normalizedUsername,
    );

    if (!user) {
      throw new UnauthorizedException("Usuário ou senha inválidos.");
    }

    const passwordHash = scryptSync(password, user.passwordSalt, 32).toString(
      "hex",
    );
    if (!safeEqualHex(passwordHash, user.passwordHash)) {
      throw new UnauthorizedException("Usuário ou senha inválidos.");
    }

    const accessToken = this.signToken(user);
    return {
      accessToken,
      tokenType: "Bearer",
      expiresIn: TOKEN_TTL_SECONDS,
      user: this.publicUser(user),
    };
  }

  verifyToken(token: string): AuthenticatedUser | null {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const expectedSignature = encodeBase64Url(
      createHmac("sha256", this.secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest(),
    );
    if (
      !safeEqualHex(
        Buffer.from(encodedSignature).toString("hex"),
        Buffer.from(expectedSignature).toString("hex"),
      )
    ) {
      return null;
    }

    try {
      const header = JSON.parse(
        decodeBase64Url(encodedHeader).toString("utf8"),
      ) as {
        alg?: string;
        typ?: string;
      };
      const payload = JSON.parse(
        decodeBase64Url(encodedPayload).toString("utf8"),
      ) as Partial<AuthTokenPayload>;
      const now = Math.floor(Date.now() / 1000);
      if (
        header.alg !== "HS256" ||
        header.typ !== "JWT" ||
        payload.iss !== TOKEN_ISSUER ||
        typeof payload.sub !== "string" ||
        typeof payload.exp !== "number" ||
        payload.exp <= now
      ) {
        return null;
      }

      const user = users.find((candidate) => candidate.id === payload.sub);
      return user ? this.publicUser(user) : null;
    } catch {
      return null;
    }
  }

  private signToken(user: UserRecord): string {
    const now = Math.floor(Date.now() / 1000);
    const header = encodeBase64Url(
      JSON.stringify({ alg: "HS256", typ: "JWT" }),
    );
    const payload = encodeBase64Url(
      JSON.stringify({
        sub: user.id,
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLabel: user.roleLabel,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
        iss: TOKEN_ISSUER,
      }),
    );
    const signature = encodeBase64Url(
      createHmac("sha256", this.secret).update(`${header}.${payload}`).digest(),
    );
    return `${header}.${payload}.${signature}`;
  }

  private publicUser(user: UserRecord): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      roleLabel: user.roleLabel,
    };
  }
}
