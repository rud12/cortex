# CORTEX

CORTEX is a retail inventory, point-of-sale, computer vision, and demand forecasting system for small and medium retail stores. The repository is organized as a monorepo with a React/Vite web app and multiple backend microservices.

The current codebase includes authentication and role management, inventory and purchase order workflows, POS transactions with bill generation, real-time inventory updates, vision-assisted receiving and dataset management, demand forecasting, causal analysis for the admin chatbot, notification dispatch, and an n8n chatbot workflow runner.

## Repository Structure

```text
.
|-- cortex-web/                         # React 18 + Vite web frontend
|-- cortex-backend/
|   |-- auth-service/                   # Node/Express auth and users service
|   |-- inventory-service/              # Node/Express inventory, products, suppliers, POs, WebSocket
|   |-- pos-service/                    # Node/Express POS, customers, transactions, bill PDFs
|   |-- chat-service/                   # Node/Express admin chat router for n8n and causal analysis
|   |-- notification-service/           # Node/Express email notification gateway
|   |-- vision-service/                 # Python/FastAPI vision sessions, mobile camera, dataset APIs
|   |-- forecasting-service/            # Python/FastAPI demand forecasting and recommendations
|   |-- causal-service/                 # Python/FastAPI causal inference API
|   |-- n8n/                            # n8n workflow runtime
|   `-- data/                           # Runtime uploads, generated bills, datasets, model artifacts
|-- package.json                        # Root scripts for installing/running all modules
`-- .gitignore                          # Monorepo ignore rules
```

## Modules

| Module | Stack | Default port | Purpose |
| --- | --- | ---: | --- |
| `cortex-web` | React 18, Vite, MUI, Tailwind, Chart.js | `5173` | Web UI for dashboard, inventory, POS, receiving, forecasting, admin users, settings |
| `auth-service` | Node.js, Express, Prisma | `3001` | Login, token refresh/logout, user and role management |
| `inventory-service` | Node.js, Express, Prisma, WebSocket | `3002` | Products, stock, batches, suppliers, purchase orders, alerts, settings |
| `pos-service` | Node.js, Express, Prisma, PDFKit | `3003` | POS checkout, customers, transactions, generated bill PDFs |
| `vision-service` | Python, FastAPI, OpenCV, Ultralytics, Torch | `3004` | Vision sessions, mobile camera upload, product reference images |
| `forecasting-service` | Python, FastAPI, pandas, statsmodels, APScheduler | `3005` | Forecasts, metrics, training, reorder recommendations |
| `chat-service` | Node.js, Express | `3006` | Admin chatbot gateway to n8n and causal service |
| `notification-service` | Node.js, Express, Nodemailer | `3007` | Central mail notification endpoint |
| `causal-service` | Python, FastAPI, DoWhy, EconML, CausalNex | `3010` | Causal analysis endpoint for chatbot workflows |
| `n8n` | n8n | `5678` | Chatbot workflow automation runtime |

## Prerequisites

- Node.js and npm
- Python 3.10+
- PostgreSQL 15+
- Local HTTPS certificates for services that run over HTTPS
- Optional: n8n account/configuration for chatbot workflow execution

## Environment Configuration

Each service has its own `.env` file. These files contain local secrets and should stay untracked.

Important environment variables used across the repository:

- `DATABASE_URL` for Prisma and Python database access
- `JWT_SECRET` for auth/token validation in Node services
- `HOST` and `PORT` for service binding
- `SSL_FILE_PATH` for Node/Python HTTPS certificate lookup
- `AUTH_SERVICE_URL`, `INVENTORY_SERVICE_URL`, `NOTIFICATION_SERVICE_URL`, `CAUSAL_SERVICE_URL` for service-to-service calls
- `N8N_CHAT_WEBHOOK_URL`, `N8N_BEARER_TOKEN`, `N8N_TIMEOUT_MS` for chatbot orchestration
- `GOOGLE_APP_EMAIL`, `GOOGLE_APP_PASSWORD` for notification mail dispatch
- `WEATHER_API_KEY`, `USE_WEATHER_API`, `FORECAST_LOCATION` for forecasting external factors
- `VITE_AUTH_URL`, `VITE_INVENTORY_URL`, `VITE_POS_URL`, `VITE_VISION_URL`, `VITE_FORECAST_URL`, `VITE_CHAT_URL` for the web app
- `VITE_USE_DEV_PROXY=true` to let Vite proxy `/svc/*` requests to local HTTPS services

The backend documentation expects one PostgreSQL database, commonly named `cortex-main`, with schema-scoped connection URLs:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cortex-main?schema=auth
```

Use a different `schema=` value per service, such as `auth`, `inventory`, `pos`, `forecasting`, `vision`, or `causal`.

## Install Dependencies

Install root and JavaScript module dependencies:

```bash
npm install
```

The root install script installs dependencies for the Node/Vite/n8n modules. Python services still need their own virtual environments:

```bash
cd cortex-backend/forecasting-service
python3 -m venv venv
venv/bin/pip install -r requirements.txt

cd ../causal-service
python3 -m venv venv
venv/bin/pip install -r requirements.txt

cd ../vision-service
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

## Database Setup

For Prisma-backed services, generate clients and apply migrations from each service directory:

```bash
cd cortex-backend/auth-service
npx prisma generate
npx prisma migrate deploy

cd ../inventory-service
npx prisma generate
npx prisma migrate deploy

cd ../pos-service
npx prisma generate
npx prisma migrate deploy
```

The auth service seeds/synchronizes system roles when it starts.

## Run Locally

Run every module concurrently from the repository root:

```bash
npm run dev
```

Run a single module:

```bash
npm run dev:web
npm run dev:auth
npm run dev:inventory
npm run dev:pos
npm run dev:vision
npm run dev:forecast
npm run dev:causal
npm run dev:chat
npm run dev:notification
npm run dev:n8n
```

The Vite app runs at:

```text
https://localhost:5173
```

Most backend services use HTTPS locally. If a service cannot find `key.pem` or `cert.pem`, either place certificates at the configured `SSL_FILE_PATH` or update that service's `.env`.

## Main API Entry Points

Health checks:

- Auth: `GET /api/v1/health`
- Inventory: `GET /api/v1/health`
- POS: `GET /api/v1/health`
- Notification: `GET /api/v1/health`
- Chat: `GET /api/v1/chat/health`
- Vision: `GET /health`
- Forecasting: `GET /health`
- Causal: `GET /health`

Primary service routes:

- Auth: `/api/v1/auth`, `/api/v1/users`
- Inventory: `/api/v1/products`, `/api/v1/inventory`, `/api/v1/alerts`, `/api/v1/purchase-orders`, `/api/v1/suppliers`, `/api/v1/settings`
- POS: `/api/v1/transactions`, `/api/v1/customers`
- Notification: `/api/v1/notifications/mail`
- Chat: `/api/v1/chat/query`
- Vision: `/api/v1/vision/sessions/*`, `/api/v1/vision/mobile/*`, `/api/v1/vision/products/*`
- Forecasting: `/forecast`, `/forecasts`, `/forecast/diagnostics`, `/metrics`, `/recommendations`, `/train`
- Causal: `/api/v1/causal/analyze`

Each backend service also has a service-level README with a more focused endpoint list.

## Web App Routes

The web frontend includes:

- `/login` and `/business-signup`
- `/dashboard`
- `/inventory/products`, `/inventory/stock`, `/inventory/alerts`
- `/suppliers`
- `/purchase-orders`
- `/receiving`
- `/vision/dataset`
- `/forecasting`
- `/admin/users`
- `/settings`
- `/pos`

Routes are protected by authentication and role gates. Main roles in the UI include `Administrator`, `WarehouseManager`, `WarehouseStaff`, and `Cashier`.

## Runtime Data

The backend writes runtime data under `cortex-backend/data/`, including product assets, datasets, model files, and generated bill PDFs. These are intentionally ignored by Git because they are local/generated artifacts.

Local virtual environments, generated frontend builds, cache folders, local certificates, `.env` files, model weights, and logs are also ignored.

## Useful Notes

- The inventory service exposes a WebSocket endpoint at `/ws` for real-time inventory updates.
- The web dev server can proxy local services through `/svc/*` when `VITE_USE_DEV_PROXY=true`.
- The forecasting service schedules background training/factor refresh work on startup.
- The chat service can call both n8n and the causal service, depending on the chatbot request path.
- Keep service `.env` files and local certificate keys out of commits.
