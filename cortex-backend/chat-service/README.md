# Chat Service

Admin-only chat router for LLM (n8n) and causal inference.

## Endpoints

- `GET /api/v1/chat/health`
- `POST /api/v1/chat/query` (`{ "sessionId"?: string, "question": string }`)
