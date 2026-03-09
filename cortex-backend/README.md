# CORTEX Backend (Microservices)

This backend follows the CORTEX backend API standards. Each service runs independently and uses PostgreSQL. The shared database name is **cortex-main** with separate schemas per service.

## Services
- `auth-service` (Node/Express + Prisma)
- `inventory-service` (Node/Express + Prisma + WebSocket)
- `pos-service` (Node/Express + Prisma)
- `chat-service` (Node/Express + Gemini orchestration)
- `notification-service` (Node/Express centralized mail + WhatsApp dispatch)
- `vision-service` (Python/FastAPI placeholder)
- `forecasting-service` (Python/FastAPI placeholder)
- `causal-service` (Python/FastAPI + DoWhy/EconML/CausalNex)

## Database
Create a PostgreSQL database named `cortex-main`, then use schema-scoped URLs in each `.env` file, for example:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cortex-main?schema=auth
```

Other services use `schema=inventory`, `schema=pos`, etc.
