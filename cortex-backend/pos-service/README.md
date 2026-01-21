# POS Service

Point-of-sale transaction and customer lookup service.

## Base URL

`https://<host>:3003`

## Endpoints

- `GET /api/v1/health`

- Transactions:
- `POST /api/v1/transactions`
- `GET /api/v1/transactions`
- `GET /api/v1/transactions/:id`
- `GET /api/v1/transactions/:id/bill.pdf`

- Customers:
- `GET /api/v1/customers/by-phone`
