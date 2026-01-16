import { Agent } from 'undici';
import { error } from '../utils/response.js';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'https://localhost:3001';
const insecureDispatcher = new Agent({ connect: { rejectUnauthorized: false } });

const getToken = (req) => {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(' ');
  return parts.length === 2 ? parts[1] : null;
};

export const authenticateToken = async (req, res, next) => {
  const token = getToken(req);
  if (!token) return error(res, 401, 'NO_TOKEN', 'No token provided');

  try {
    const response = await fetch(`${AUTH_SERVICE_URL}/api/v1/auth/validate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: '{}',
      dispatcher: insecureDispatcher
    });
    const payload = await response.json().catch(() => null);
    const user = payload?.data?.user;
    if (!user) return error(res, 403, 'INVALID_TOKEN', 'Invalid token');
    req.user = user;
    return next();
  } catch (_err) {
    return error(res, 503, 'AUTH_VALIDATION_UNAVAILABLE', 'Authentication service unavailable');
  }
};
