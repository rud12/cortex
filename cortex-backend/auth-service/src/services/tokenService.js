import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma.js';

export const issueTokens = async (user, metadata = {}) => {
  const roleRecord = await prisma.userRole.findFirst({ where: { userId: user.id }, include: { role: true }, orderBy: { roleId: 'asc' } });
  const roles = [roleRecord?.role?.name || 'WarehouseStaff'];
  const accessToken = jwt.sign({ id: user.id, email: user.email, role: roles[0], roles }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const refreshToken = crypto.randomUUID();
  await prisma.refreshToken.create({ data: { userId: user.id, token: refreshToken, expiresAt, ipAddress: metadata.ipAddress, userAgent: metadata.userAgent } });
  return { accessToken, refreshToken, refreshExpiresAt: expiresAt, roles };
};

export const revokeAllRefreshTokensForUser = async userId => userId && prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });

export const rotateRefreshToken = async (token, metadata = {}) => {
  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored) return { error: 'INVALID_REFRESH_TOKEN' };
  if (stored.revokedAt) return { error: 'REFRESH_TOKEN_REVOKED' };
  if (stored.expiresAt < new Date()) return { error: 'REFRESH_TOKEN_EXPIRED' };

  await prisma.refreshToken.update({ where: { token }, data: { revokedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) return { error: 'USER_NOT_FOUND' };
  if (user.status === 'INACTIVE') { await revokeAllRefreshTokensForUser(user.id); return { error: 'ACCOUNT_INACTIVE' }; }

  return { tokens: await issueTokens(user, metadata) };
};

export const revokeRefreshToken = async token => { await prisma.refreshToken.updateMany({ where: { token }, data: { revokedAt: new Date() } }); };
