import prisma from '../utils/prisma.js';
import { success, error } from '../utils/response.js';

export const createSupplier = async (req, res, next) => {
  try {
    const { name, contactName: cN, email: e, phone: p, address: a } = req.body || {};
    if (!name) return error(res, 400, 'INV', 'Name req');
    success(res, await prisma.supplier.create({ data: { name, contactName: cN, email: e, phone: p, address: a } }), 'Created');
  } catch (err) { next(err); }
};

export const listSuppliers = async (req, res, next) => {
  try { success(res, await prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } }), 'Fetched'); } catch (err) { next(err); }
};

export const updateSupplier = async (req, res, next) => {
  try {
    const { id } = req.params, ex = await prisma.supplier.findUnique({ where: { id } });
    if (!ex) return error(res, 404, 'NOT_FOUND', 'Not found');
    const { name, contactName: cN, email: e, phone: p, address: a } = req.body || {}, nN = String(name||'').trim();
    if (!nN) return error(res, 400, 'INV', 'Name req');
    success(res, await prisma.supplier.update({ where: { id }, data: { name: nN, contactName: cN==null?null:String(cN).trim()||null, email: e==null?null:String(e).trim()||null, phone: p==null?null:String(p).trim()||null, address: a==null?null:String(a).trim()||null } }), 'Updated');
  } catch (err) { next(err); }
};
