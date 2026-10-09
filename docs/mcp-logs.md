# Logs estruturados do MCP

O gateway MCP escreve uma linha JSON por evento em `stdout`. Em Docker, os
registros podem ser consultados com:

```bash
docker compose logs -f api | jq 'select(.event | startswith("mcp."))'
```

Cada requisição pode ser reconstruída pelo `request_id` ou agrupada com outros
componentes pelo `correlation_id`. Os eventos principais são:

- `mcp.request.received`: rota, método HTTP, método RPC, ferramenta, recurso,
  entrada resumida, cliente e sessão.
- `mcp.tool.result`: resultado estruturado retornado pela ferramenta, duração e
  correlação da chamada.
- `mcp.request.completed`: status HTTP, tipo de resposta, duração e tamanho do
  corpo recebido.
- `mcp.request.rejected`: host/origem inválidos ou rota MCP inexistente.
- `mcp.request.failed`: exceção não tratada, duração e detalhes do erro.

Exemplo de uma chamada bem-sucedida:

```json
{
  "timestamp": "2026-10-09T15:00:00.000Z",
  "level": "info",
  "service": "ondaluz-api",
  "event": "mcp.tool.result",
  "request_id": "7d3…",
  "correlation_id": "7d3…",
  "session_id": "mcp-session…",
  "route": "/mcp/customers",
  "rpc_method": "tools/call",
  "rpc_id": 4,
  "tool": "customers_get",
  "outcome": "success",
  "duration_ms": 18.42,
  "result": {
    "customer_id": "C545968",
    "customer_status": "active"
  }
}
```

Credenciais, cookies, tokens, chaves e senhas são substituídos por
`[REDACTED]`. Entradas e resultados grandes são limitados e marcados com
`truncated: true`, preservando o diagnóstico sem transformar o log em uma
segunda base de dados operacional.
