import { Agent } from 'undici';
import { error } from '../utils/response.js';

const disp = new Agent({ connect: { rejectUnauthorized: false } });

export const authenticateToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return error(res, 401, 'NO_TOKEN', 'No token provided');

  const response = await fetch(`${process.env.AUTH_SERVICE_URL || 'https://localhost:3001'}/api/v1/auth/validate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}', dispatcher: disp
  });

  const payload = await response.json().catch(() => null);
  if (!payload?.data?.user) return error(res, 403, 'INVALID_TOKEN', 'Invalid token');
  req.user = payload.data.user;
  next();
};
