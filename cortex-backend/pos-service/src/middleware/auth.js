import { Agent } from 'undici';
import { error } from '../utils/response.js';

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'https://localhost:3001';
const dispatcher = new Agent({ connect: { rejectUnauthorized: false } });

export const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return error(res, 401, 'NO_TOKEN', 'No token provided');

  try {
    const r = await fetch(`${AUTH_URL}/api/v1/auth/validate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, dispatcher
    });
    const user = (await r.json().catch(() => {}))?.data?.user;
    if (!user) return error(res, 403, 'INVALID_TOKEN', 'Invalid token');
    req.user = user;
    return next();
  } catch {
    return error(res, 503, 'AUTH_UNAVAILABLE', 'Auth service unavailable');
  }
};
