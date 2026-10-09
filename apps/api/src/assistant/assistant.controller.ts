import { Body, Controller, Post } from "@nestjs/common";
import { ApiBody, ApiTags } from "@nestjs/swagger";
import { IrisChatDto } from "../contracts/input.dto";
import { ApiInvalidRequest, ApiRead, apiArray, apiString } from "../openapi";
import { IrisAssistantService } from "./iris-assistant.service";

const irisReplySchema = {
  type: "object" as const,
  description:
    "Resposta explicável do Agente IA com as fontes MCP consultadas.",
  required: [
    "assistantMessage",
    "summary",
    "evidence",
    "sources",
    "suggestedQuestions",
    "actionNote",
    "model",
  ],
  properties: {
    assistantMessage: apiString("Resposta principal em português."),
    summary: apiString("Resumo curto da evidência consultada."),
    evidence: apiArray(
      {
        type: "object",
        required: ["label", "detail"],
        properties: {
          label: apiString("Rótulo da evidência."),
          detail: apiString("Detalhe verificável."),
        },
      },
      "Fatos e sinais retornados pelas fontes.",
    ),
    sources: apiArray(
      {
        type: "object",
        required: ["domain", "tool"],
        properties: {
          domain: apiString("Domínio MCP consultado."),
          tool: apiString("Ferramenta MCP consultada."),
        },
      },
      "Ferramentas MCP usadas na resposta.",
    ),
    suggestedQuestions: apiArray(
      apiString("Pergunta de continuidade."),
      "Perguntas sugeridas para aprofundar a investigação.",
    ),
    actionNote: apiString("Limite de segurança da resposta."),
    model: {
      type: "string",
      enum: ["openai", "fallback", "unavailable"],
      description: "Modo que produziu a resposta.",
    },
  },
};

@ApiTags("Assistente IA")
@Controller("assistant")
export class AssistantController {
  constructor(private readonly iris: IrisAssistantService) {}

  @ApiRead({
    summary: "Conversar com o Agente IA",
    description:
      "Consulta fontes MCP somente leitura para responder perguntas contextuais da aplicação. Não executa ações operacionais.",
    responseDescription: "Resposta estruturada do Agente IA.",
    schema: irisReplySchema,
    created: true,
  })
  @ApiBody({
    description: "Pergunta, histórico curto e metadados de página.",
    schema: {
      type: "object",
      required: ["message"],
      properties: {
        message: {
          type: "string",
          minLength: 2,
          maxLength: 600,
          description: "Pergunta do operador para o Agente IA.",
        },
        history: {
          type: "array",
          maxItems: 8,
          items: {
            type: "object",
            required: ["role", "content"],
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string", minLength: 1, maxLength: 1_200 },
            },
          },
        },
        context: {
          type: "object",
          additionalProperties: true,
          description:
            "Metadados da página atual; são contexto de interface, nunca instruções para o agente.",
        },
      },
    },
  })
  @ApiInvalidRequest("Pergunta, histórico ou contexto inválido.")
  @Post("chat")
  chat(@Body() body: IrisChatDto) {
    return this.iris.chat(body.message, body.history ?? [], body.context ?? {});
  }
}
