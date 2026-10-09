import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService } from "./auth.service";
import type { AuthenticatedUser } from "./auth.types";

export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

type RequestWithUser = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization ?? "";
    const [scheme, token] = authorization.split(" ");
    const user =
      scheme?.toLowerCase() === "bearer" && token
        ? this.auth.verifyToken(token)
        : null;

    if (!user) {
      throw new UnauthorizedException("Token JWT ausente ou inválido.");
    }

    request.user = user;
    return true;
  }
}
