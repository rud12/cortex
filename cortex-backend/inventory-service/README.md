# Inventory Service

Inventory, product, supplier, purchase order, and settings service.

## Base URL

`https://<host>:3002`

## Endpoints

- `GET /api/v1/health`

- Products:
- `POST /api/v1/products`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `PATCH /api/v1/products/:id`
- `DELETE /api/v1/products/:id`
- `GET /api/v1/products/:id/stock-summary`

- Inventory:
- `GET /api/v1/inventory`
- `POST /api/v1/inventory/receipts`
- `POST /api/v1/inventory/manual-entry`
- `POST /api/v1/inventory/consume`
- `GET /api/v1/inventory/batches`
- `GET /api/v1/inventory/products/:id/stock-summary`

- Alerts:
- `GET /api/v1/alerts`

- Purchase Orders:
- `POST /api/v1/purchase-orders`
- `GET /api/v1/purchase-orders`
- `GET /api/v1/purchase-orders/:id`
- `PATCH /api/v1/purchase-orders/:id/status`

- Suppliers:
- `POST /api/v1/suppliers`
- `GET /api/v1/suppliers`

- Settings:
- `GET /api/v1/settings`
- `PUT /api/v1/settings/business`
- `PUT /api/v1/settings/tax-defaults`
- `PUT /api/v1/settings/payment`
- `PUT /api/v1/settings/theme`
