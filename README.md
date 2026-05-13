# SAI Tools — Dashboard Centralizado de Logs

Dashboard full-stack para visualizar logs, leads e execuções de chatbots.

- Stack: Express + Prisma + PostgreSQL + React + Vite + Tailwind
- Auth: senha mestre via env `MASTER_PASSWORD`
- Deploy: Docker Swarm via Traefik em `tools.strategicai.com.br`

## Quickstart Local

```bash
docker-compose up --build
```

Acesse http://localhost:5173

## Endpoints

- `POST /auth/login` — login com senha
- `GET /api/logs/clients` — lista clientes (auth)
- `POST /api/logs/register-webhook` — auto-registro de chatbots (público)
- `GET /api/logs/:clientId/leads` — leads (auth)
- `GET /api/logs/:clientId/history/:phone` — mensagens (auth)
- `GET /api/logs/:clientId/events` — execuções (auth)
