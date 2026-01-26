import { Agent } from 'undici';
import { error } from '../utils/response.js';

const extractToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2) return null;
  if (parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
};

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://localhost:3001';
const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

const validateToken = async (token) => {
  const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/validate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: '{}',
    signal: AbortSignal.timeout(4000),
    dispatcher: insecureDispatcher
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_err) {
    payload = null;
  }

  return { response, payload };
};

export const authenticateToken = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return error(res, 401, 'NO_TOKEN', 'No token provided');

  try {
    const { response, payload } = await validateToken(token);

    if (!response.ok || !payload?.success || !payload?.data?.user) {
      const code = payload?.error?.code || (response.status === 401 ? 'INVALID_TOKEN' : 'AUTH_VALIDATION_FAILED');
      const message = payload?.error?.message || 'Token validation failed';
      return error(res, response.status === 401 ? 401 : 403, code, message);
    }

    req.user = payload.data.user;
    return next();
  } catch (_err) {
    return error(res, 503, 'AUTH_VALIDATION_UNAVAILABLE', 'Authentication service unavailable');
  }
};
