import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';
import { revokeAllRefreshTokensForUser } from '../services/tokenService.js';

export const syncSystemRoles = async () => {
  await Promise.all(['Administrator', 'WarehouseManager', 'WarehouseStaff', 'Cashier'].map(name => prisma.role.upsert({ where: { name }, update: {}, create: { name } })));
  const [customer, fallback] = await Promise.all([prisma.role.findUnique({ where: { name: 'Customer' } }), prisma.role.findUnique({ where: { name: 'WarehouseStaff' } })]);
  if (customer && fallback) {
    await prisma.$executeRaw`INSERT INTO "UserRole" ("userId", "roleId") SELECT ur."userId", ${fallback.id} FROM "UserRole" ur WHERE ur."roleId" = ${customer.id} AND NOT EXISTS (SELECT 1 FROM "UserRole" ur2 WHERE ur2."userId" = ur."userId" AND ur2."roleId" = ${fallback.id})`;
    await prisma.userRole.deleteMany({ where: { roleId: customer.id } });
    await prisma.role.delete({ where: { id: customer.id } });
  }
};

const formatUser = user => user ? { ...user, role: user.roles?.[0]?.role?.name || null, roles: user.roles?.map(e => e.role.name).slice(0, 1) || [] } : null;
const getUserById = async id => formatUser(await prisma.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } }));

export const createUser = async (req, res, next) => {
  try {
    const { username, email, fullName, phone, password, role, roles } = req.body || {};
    if (roles?.length > 1) return error(res, 400, 'SINGLE_ROLE_ONLY', 'Only one role allowed');
    if (!username || !email || !fullName || !password) return error(res, 400, 'INVALID_INPUT', 'Missing fields');
    await syncSystemRoles();
    if (await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } })) return error(res, 409, 'USER_EXISTS', 'User exists');
    
    const isBootstrap = (await prisma.user.count()) === 0;
    if (!isBootstrap && !req.user?.roles?.includes('Administrator')) return error(res, 403, 'FORBIDDEN', 'Admins only');
    
    const roleName = (role || roles?.[0] || (isBootstrap ? 'Administrator' : 'WarehouseStaff')).trim();
    const roleRecord = await prisma.role.findUnique({ where: { name: roleName } });
    if (!roleRecord) return error(res, 400, 'INVALID_ROLE', 'Invalid role');

    const user = await prisma.user.create({ data: { username, email, fullName, phone, status: 'ACTIVE', passwordHash: await bcrypt.hash(password, 10), roles: { create: { roleId: roleRecord.id } } } });
    success(res, await getUserById(user.id), 'User created');
  } catch (e) { next(e); }
};

export const listUsers = async (req, res, next) => {
  try { success(res, (await prisma.user.findMany({ include: { roles: { include: { role: true } } }, orderBy: { createdAt: 'desc' } })).map(formatUser), 'Users fetched'); } catch (e) { next(e); }
};

export const getUser = async (req, res, next) => {
  try { const u = await getUserById(req.params.id); u ? success(res, u, 'Fetched') : error(res, 404, 'NOT_FOUND', 'Not found'); } catch (e) { next(e); }
};

export const updateUser = async (req, res, next) => {
  try {
    const { fullName, phone, status, role, roles } = req.body || {};
    if (roles?.length > 1) return error(res, 400, 'SINGLE_ROLE_ONLY', 'One role allowed');
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return error(res, 404, 'NOT_FOUND', 'Not found');

    const newRole = (role || roles?.[0])?.trim();
    if (newRole) {
      const roleRec = await prisma.role.findUnique({ where: { name: newRole } });
      if (!roleRec) return error(res, 400, 'INVALID_ROLE', 'Invalid role');
      await prisma.userRole.deleteMany({ where: { userId: user.id } });
      await prisma.userRole.create({ data: { userId: user.id, roleId: roleRec.id } });
    }
    
    const updated = await prisma.user.update({ where: { id: user.id }, data: { fullName: fullName ?? user.fullName, phone: phone ?? user.phone, status: status ?? user.status } });
    if (updated.status === 'INACTIVE' && user.status !== 'INACTIVE') await revokeAllRefreshTokensForUser(user.id);
    success(res, await getUserById(user.id), 'User updated');
  } catch (e) { next(e); }
};

export const deleteUser = async (req, res, next) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) return error(res, 404, 'NOT_FOUND', 'Not found');
    if (user.roles.includes('Administrator')) return error(res, 403, 'FORBIDDEN', 'Cannot delete admin');
    await prisma.user.delete({ where: { id: user.id } });
    success(res, { deleted: true }, 'User deleted');
  } catch (e) { next(e); }
};
