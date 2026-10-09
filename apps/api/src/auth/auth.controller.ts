import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { IsString, Length } from "class-validator";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import type { AuthenticatedUser } from "./auth.types";

export class LoginDto {
  @ApiProperty({ example: "marina", description: "Usuário do operador." })
  @IsString()
  @Length(1, 80)
  username!: string;

  @ApiProperty({ example: "Teste@123", description: "Senha do operador." })
  @IsString()
  @Length(1, 200)
  password!: string;
}

type AuthenticatedRequest = { user: AuthenticatedUser };

@ApiTags("Autenticação")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Autenticar operador e emitir JWT",
    description:
      "Os três usuários de demonstração usam a senha Teste@123. O token expira em oito horas.",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Token JWT e perfil autenticado.",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Credenciais inválidas.",
  })
  login(@Body() input: LoginDto) {
    return this.auth.login(input.username, input.password);
  }

  @Get("me")
  @ApiBearerAuth("access-token")
  @ApiOperation({ summary: "Consultar o operador do token atual" })
  me(@Req() request: AuthenticatedRequest) {
    return request.user;
  }
}
