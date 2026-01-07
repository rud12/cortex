import { createApiClient } from './axiosConfig';
import {
  AUTH_API_URL,
  INVENTORY_API_URL,
  POS_API_URL,
  VISION_API_URL,
  FORECAST_API_URL,
  CHAT_API_URL
} from './env';

export const authApi = createApiClient(AUTH_API_URL);
export const inventoryApi = createApiClient(`${INVENTORY_API_URL}/api/v1`);
export const posApi = createApiClient(`${POS_API_URL}/api/v1`);
export const visionApi = createApiClient(VISION_API_URL);
export const forecastApi = createApiClient(FORECAST_API_URL, { timeout: 45000 });
export const chatApi = createApiClient(`${CHAT_API_URL}/api/v1`, { timeout: 30000 });
