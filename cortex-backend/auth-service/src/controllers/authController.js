import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { issueTokens, rotateRefreshToken, revokeRefreshToken } from '../services/tokenService.js';

const getUser = async id => {
  const user = await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
  if (!user) return null;
  const role = user.roles[0]?.role?.name;
  return { ...user, role, roles: [role] };
};

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body || {};
   
    if (!identifier || !password) return error(res, 400, 'INVALID_INPUT', 'Required fields missing');
   
    const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { username: identifier }] } });
   
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return error(res, 401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    if (user.status === 'INACTIVE') return error(res, 403, 'ACCOUNT_INACTIVE', 'Account inactive');
   
    const updatedUser = await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const tokens = await issueTokens(updatedUser, { ipAddress: req.ip, userAgent: req.get('user-agent') });
    success(res, { user: { id: user.id, email: user.email, username: user.username, fullName: user.fullName, roles: tokens.roles }, ...tokens }, 'Login successful');
  } catch (e) { next(e); }
};

export const refresh = async (req, res, next) => {
  try {
    if (!req.body?.refreshToken) return error(res, 400, 'INVALID_INPUT', 'Refresh token required');
    const { tokens, error: err } = await rotateRefreshToken(req.body.refreshToken, { ipAddress: req.ip, userAgent: req.get('user-agent') });
    return err ? error(res, err === 'ACCOUNT_INACTIVE' ? 403 : 401, err, 'Token invalid') : success(res, tokens, 'Token refreshed');
  } catch (e) { next(e); }
};

export const logout = async (req, res, next) => {
  try {
    if (!req.body?.refreshToken) return error(res, 400, 'INVALID_INPUT', 'Refresh token required');
    await revokeRefreshToken(req.body.refreshToken);
    success(res, { revoked: true }, 'Logged out');
  } catch (e) { next(e); }
};

export const validateAccessToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return error(res, 401, 'NO_TOKEN', 'No token');
    let decoded;
    try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return error(res, 403, 'INVALID_TOKEN', 'Invalid token'); }
    const user = await getUser(decoded.id);
    if (!user) return error(res, 403, 'USER_NOT_FOUND', 'User not found');
    if (user.status === 'INACTIVE') return error(res, 403, 'ACCOUNT_INACTIVE', 'Account inactive');
    success(res, { user }, 'Token valid');
  } catch (e) { 
    next(e);
  }
};
