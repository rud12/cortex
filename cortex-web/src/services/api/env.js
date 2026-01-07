const normalize = (value) => String(value ?? '').trim();
const browserLocation = typeof window !== 'undefined' ? window.location : null;
const runtimeProtocol = browserLocation?.protocol === 'https:' ? 'https' : 'http';

const configuredProtocol = normalize(import.meta.env.VITE_API_PROTOCOL).replace(/:$/, '').toLowerCase();
const fallbackProtocol = configuredProtocol === 'https' || configuredProtocol === 'http'
  ? configuredProtocol
  : runtimeProtocol;
const fallbackHost = normalize(import.meta.env.VITE_API_HOST) || browserLocation?.hostname || 'localhost';

const fallbackUrl = (port) => `${fallbackProtocol}://${fallbackHost}:${port}`;

const ensureAbsoluteUrl = (value) => {
  const trimmed = normalize(value);
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed;
  if (/^[a-z][a-z\d+\-.]*:\/\//i.test(trimmed)) return trimmed;
  return `${fallbackProtocol}://${trimmed}`;
};

const resolveServiceUrl = (rawValue, port) => {
  const configured = ensureAbsoluteUrl(rawValue) || fallbackUrl(port);
  if (configured.startsWith('/')) return configured.replace(/\/$/, '');

  try {
    const url = new URL(configured);
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
};

const resolveWebUrl = (rawValue) => {
  const configured = ensureAbsoluteUrl(rawValue) || browserLocation?.origin || fallbackUrl(5173);
  try {
    const url = new URL(configured);
    return url.toString().replace(/\/$/, '');
  } catch {
    return configured;
  }
};

const resolveWsUrl = (baseHttpUrl, overrideWsUrl, wsPath) => {
  if (overrideWsUrl) return overrideWsUrl.replace(/\/$/, '');
  if (baseHttpUrl.startsWith('/')) {
    const wsProtocol = browserLocation?.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = browserLocation?.host || `${fallbackHost}:5173`;
    return `${wsProtocol}//${wsHost}${baseHttpUrl.replace(/\/$/, '')}${wsPath}`;
  }
  try {
    const url = new URL(baseHttpUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = wsPath;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return `${baseHttpUrl}`.replace(/^http/, 'ws').replace(/\/$/, '') + wsPath;
  }
};

const useDevProxy = String(import.meta.env.VITE_USE_DEV_PROXY ?? 'false').toLowerCase() === 'true';
const DEV_PROXY_URLS = {
  auth: '/svc/auth',
  inventory: '/svc/inventory',
  pos: '/svc/pos',
  vision: '/svc/vision',
  forecast: '/svc/forecast',
  chat: '/svc/chat'
};

export const AUTH_URL = resolveServiceUrl(import.meta.env.VITE_AUTH_URL, 3001);
export const INVENTORY_URL = resolveServiceUrl(import.meta.env.VITE_INVENTORY_URL, 3002);
export const POS_URL = resolveServiceUrl(import.meta.env.VITE_POS_URL, 3003);
export const VISION_URL = resolveServiceUrl(import.meta.env.VITE_VISION_URL, 3004);
export const FORECAST_URL = resolveServiceUrl(import.meta.env.VITE_FORECAST_URL, 3005);
export const CHAT_URL = resolveServiceUrl(import.meta.env.VITE_CHAT_URL, 3006);
export const WEB_URL = resolveWebUrl(import.meta.env.VITE_WEB_URL);

export const AUTH_API_URL = useDevProxy ? DEV_PROXY_URLS.auth : AUTH_URL;
export const INVENTORY_API_URL = useDevProxy ? DEV_PROXY_URLS.inventory : INVENTORY_URL;
export const POS_API_URL = useDevProxy ? DEV_PROXY_URLS.pos : POS_URL;
export const VISION_API_URL = useDevProxy ? DEV_PROXY_URLS.vision : VISION_URL;
export const FORECAST_API_URL = useDevProxy ? DEV_PROXY_URLS.forecast : FORECAST_URL;
export const CHAT_API_URL = useDevProxy ? DEV_PROXY_URLS.chat : CHAT_URL;

export const VISION_V2_ENABLED = String(import.meta.env.VITE_VISION_V2_ENABLED ?? 'true').toLowerCase() === 'true';

export const inventoryWsUrl = resolveWsUrl(INVENTORY_API_URL, import.meta.env.VITE_INVENTORY_WS_URL, '/ws');
export const visionWsBaseUrl = resolveWsUrl(VISION_API_URL, import.meta.env.VITE_VISION_WS_URL, '');
