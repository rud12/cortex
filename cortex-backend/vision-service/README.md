# Vision Service

Minimal vision service for dataset management and backend-hosted mobile streaming.

## Endpoints

- `GET /health`
- `POST /api/v1/vision/sessions/start`
- `GET /api/v1/vision/sessions/{sessionId}`
- `GET /api/v1/vision/sessions/{sessionId}/latest-frame`
- `GET /api/v1/vision/sessions/{sessionId}/stream.mjpeg`
- `POST /api/v1/vision/sessions/{sessionId}/stop`

- `POST /api/v1/vision/mobile/token`
- `GET /mobile/{token}`
- `GET /api/v1/vision/mobile/{token}/status`
- `POST /api/v1/vision/mobile/{token}`
- `POST /api/v1/vision/mobile/{token}/revoke`

- `GET /api/v1/vision/products/reference-status`
- `GET /api/v1/vision/products/{productId}/reference-images`
- `POST /api/v1/vision/products/{productId}/reference-images`
- `DELETE /api/v1/vision/products/{productId}/reference-images/{imageId}`
