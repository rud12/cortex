import jwt from 'jsonwebtoken';
import { error } from '../utils/response.js';
import prisma from '../utils/prisma.js';

const loadUser = async req => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await prisma.user.findUnique({ where: { id: decoded.id }, include: { roles: { include: { role: true } } } });
  
  if (!user || user.status === 'INACTIVE') throw new Error(user ? 'ACCOUNT_INACTIVE' : 'USER_NOT_FOUND');
  
  const role = user.roles[0]?.role?.name || 'WarehouseStaff';
  return { id: user.id, email: user.email, username: user.username, fullName: user.fullName, role, roles: [role] };
};

export const authenticateToken = async (req, res, next) => {
  try {
    req.user = await loadUser(req);
    return req.user ? next() : error(res, 401, 'NO_TOKEN', 'No token');
  } catch (err) {
    return error(res, 403, err.message || 'INVALID_TOKEN', err.message || 'Invalid token');
  }
};

export const optionalAuthenticateToken = async (req, res, next) => {
  try { req.user = await loadUser(req); } catch {}
  next();
};
